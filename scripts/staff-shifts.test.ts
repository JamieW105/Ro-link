import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
    aggregateDashboardPermissions,
    emptyDashboardPermissions,
} from '../lib/gameAdmin';
import {
    canManageStaffShifts,
    canViewStaffShifts,
    isShiftStaff,
    shiftPeriodStart,
    type ShiftReport,
} from '../lib/staffShifts';

const db = new PGlite();
const staff = [
    {
        discord_id: 'discord-1',
        roblox_user_id: 'roblox-1',
        username: 'StaffOne',
    },
];
async function sync(server = 'server-1', job = 'job-1', roster = staff) {
    await db.query('SELECT public.staff_shift_sync($1, $2, $3)', [
        server,
        job,
        JSON.stringify(roster),
    ]);
}
async function configure(
    enabled = true,
    automatic = true,
    days = 7,
    quota = 5,
) {
    await db.query('SELECT public.staff_shift_configure($1,$2,$3,$4,$5)', [
        'server-1',
        enabled,
        automatic,
        days,
        quota,
    ]);
}
async function report(
    server = 'server-1',
    discord: string | null = null,
    from: string | null = null,
    offset = 0,
) {
    const { rows } = await db.query<{ result: ShiftReport }>(
        'SELECT public.staff_shift_report($1,$2,$3,$4) result',
        [server, discord, from, offset],
    );
    return rows[0].result;
}
async function count() {
    const { rows } = await db.query<{ count: number }>(
        'SELECT count(*)::int count FROM public.staff_shifts',
    );
    return rows[0].count;
}

before(async () => {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE TABLE public.servers(id text PRIMARY KEY);
        CREATE TABLE public.dashboard_roles(id text);`);
    await db.exec(
        await readFile(
            new URL(
                '../supabase/migrations/20261016000137_staff_shifts.sql',
                import.meta.url,
            ),
            'utf8',
        ),
    );
});
beforeEach(async () => {
    await db.exec(
        `TRUNCATE public.servers CASCADE; INSERT INTO public.servers VALUES ('server-1'), ('server-2');`,
    );
});
after(async () => {
    await db.close();
});

test('disabled shifts do not start; repeated heartbeats start only one shift and accrue confirmed time', async () => {
    await sync();
    assert.equal(await count(), 0);
    await configure();
    await sync();
    await db.exec(
        `UPDATE public.staff_shifts SET started_at = now() - interval '1 minute', last_seen_at = now() - interval '20 seconds';`,
    );
    await sync();
    await sync();
    const result = await report('server-1', null, '2000-01-01');
    assert.equal(await count(), 1);
    assert.equal(result.staff[0].active, true);
    assert.ok(result.staff[0].seconds >= 60 && result.staff[0].seconds < 62);
});

test('first enable starts a fresh wave with the chosen length and quota', async () => {
    await report();
    await configure(true, true, 10, 8);
    const result = await report();
    assert.equal(result.wave.quota_hours, 8);
    assert.equal(
        Date.parse(result.wave.ends_at) - Date.parse(result.wave.starts_at),
        10 * 86400_000,
    );
});

test('a leave/shutdown closes only shifts in its own game job', async () => {
    await configure();
    await sync();
    await sync('server-1', 'job-2', [
        {
            discord_id: 'discord-2',
            roblox_user_id: 'roblox-2',
            username: 'StaffTwo',
        },
    ]);
    await sync('server-1', 'job-1', []);
    const result = await report();
    assert.equal(
        result.staff.find((s) => s.discord_id === 'discord-1')?.active,
        false,
    );
    assert.equal(
        result.staff.find((s) => s.discord_id === 'discord-2')?.active,
        true,
    );
});

test('offline servers stop accruing time at their last heartbeat and reconnect as a new shift', async () => {
    await configure();
    await sync();
    await db.exec(
        `UPDATE public.staff_shifts SET started_at = now() - interval '2 hours', last_seen_at = now() - interval '1 hour';`,
    );
    const result = await report();
    assert.equal(result.staff[0].total_seconds, 3600);
    assert.equal(result.staff[0].active, false);
    assert.equal((await report()).staff[0].total_seconds, 3600);
    await sync();
    assert.equal(await count(), 2);
    assert.equal((await report()).staff[0].active, true);
});

test('overlapping game sessions merge and reporting boundaries clip time correctly', async () => {
    await db.exec(`INSERT INTO public.staff_shifts(server_id, job_id, discord_id, roblox_user_id, username, started_at, last_seen_at, ended_at)
        VALUES ('server-1','job-1','discord-1','roblox-1','StaffOne',now()-interval '4 hours',now()-interval '2 hours',now()-interval '2 hours'),
        ('server-1','job-2','discord-1','roblox-1','StaffOne',now()-interval '3 hours',now()-interval '1 hour',now()-interval '1 hour');`);
    const { rows } = await db.query<{
        total: number;
        clipped: number;
    }>(`SELECT staff_shift_seconds('server-1','discord-1',now()-interval '5 hours',now())::float total,
        staff_shift_seconds('server-1','discord-1',now()-interval '2 hours',now())::float clipped`);
    assert.equal(rows[0].total, 10800);
    assert.ok(Math.abs(rows[0].clipped - 3600) < 0.1);
});

test('wave rollover resets current-wave hours, preserves history, and snapshots next-wave quota', async () => {
    await configure();
    await db.exec(`UPDATE public.staff_shift_waves SET starts_at = now()-interval '9 days', ends_at = now()-interval '2 days';
        INSERT INTO public.staff_shifts(server_id,job_id,discord_id,roblox_user_id,username,started_at,last_seen_at,ended_at)
        VALUES ('server-1','old','discord-1','roblox-1','StaffOne',now()-interval '4 days',now()-interval '3 days',now()-interval '3 days');
        UPDATE public.staff_shift_settings SET wave_days = 7, quota_hours = 12 WHERE server_id = 'server-1';`);
    const result = await report();
    assert.equal(result.wave.quota_hours, 12);
    assert.equal(result.staff[0].wave_seconds, 0);
    assert.equal(result.staff[0].total_seconds, 86400);
    assert.equal(result.staff[0].shift_count, 0);
    const { rows } = await db.query<{ count: number }>(
        'SELECT count(*)::int count FROM public.staff_shift_waves',
    );
    assert.equal(rows[0].count, 2);
    await configure(true, true, 3, 8);
    assert.equal((await report()).wave.quota_hours, 12);
    assert.equal((await report()).settings.quota_hours, 8);
});

test('a shift crossing a wave boundary contributes only its time inside the wave', async () => {
    await configure();
    await db.exec(`UPDATE public.staff_shift_waves SET starts_at = now()-interval '1 hour', ends_at = now()+interval '6 days';
        INSERT INTO public.staff_shifts(server_id,job_id,discord_id,roblox_user_id,username,started_at,last_seen_at,ended_at)
        VALUES ('server-1','job','discord-1','roblox-1','StaffOne',now()-interval '2 hours',now(),now());`);
    const result = await report();
    assert.equal(result.staff[0].wave_seconds, 3600);
    assert.equal(result.staff[0].total_seconds, 7200);
});

test('manual shifts require enabled/manual mode; disabling ends active shifts without deleting history', async () => {
    await configure();
    const manual = (start: boolean) =>
        db.query('SELECT staff_shift_manual($1,$2,$3,$4,$5,$6)', [
            'server-1',
            'job-1',
            'discord-1',
            'roblox-1',
            'StaffOne',
            start,
        ]);
    await assert.rejects(manual(true), /Manual shifts require/);
    await configure(true, false);
    await sync();
    assert.equal(await count(), 0);
    await manual(true);
    await manual(true);
    assert.equal(await count(), 1);
    await sync();
    assert.equal((await report()).staff[0].active, true);
    await manual(false);
    assert.equal((await report()).staff[0].active, false);
    await manual(true);
    await configure(false, false);
    assert.equal((await report()).staff[0].active, false);
    assert.equal(await count(), 2);
});

test('reports isolate servers and self scope, paginate history, and include every staff summary', async () => {
    await db.exec(`INSERT INTO public.staff_shifts(server_id,job_id,discord_id,roblox_user_id,username,started_at,last_seen_at,ended_at)
        SELECT 'server-1','job-'||n,'discord-'||(n%2+1),'roblox-'||(n%2+1),'Staff'||(n%2+1),
            now()-make_interval(mins=>n+1),now()-make_interval(mins=>n),now()-make_interval(mins=>n)
        FROM generate_series(1,51) n;`);
    const result = await report('server-1', null, '2000-01-01');
    assert.equal(result.staff.length, 2);
    assert.equal(result.shifts.length, 50);
    assert.equal(result.has_more, true);
    const next = await report('server-1', null, '2000-01-01', 50);
    assert.equal(next.shifts.length, 1);
    assert.equal(next.has_more, false);
    const self = await report('server-1', 'discord-1', '2000-01-01');
    assert.equal(self.staff.length, 1);
    assert.ok(self.shifts.every((s) => s.discord_id === 'discord-1'));
    assert.equal((await report('server-2')).staff.length, 0);
});

test('browser roles cannot read/write shift data or execute privileged RPCs; service role can', async () => {
    for (const role of ['anon', 'authenticated']) {
        await db.exec(`SET ROLE ${role}`);
        try {
            await assert.rejects(
                db.query('SELECT * FROM public.staff_shifts'),
                /permission denied/,
            );
            await assert.rejects(
                db.query("SELECT public.staff_shift_report('server-1')"),
                /permission denied/,
            );
            await assert.rejects(
                db.query(
                    "SELECT public.staff_shift_sync('server-1','job','[]')",
                ),
                /permission denied/,
            );
            await assert.rejects(
                db.query(
                    "SELECT public.staff_shift_configure('server-1',true,true,7,5)",
                ),
                /permission denied/,
            );
        } finally {
            await db.exec('RESET ROLE');
        }
    }
    await db.exec('SET ROLE service_role');
    try {
        assert.equal((await report()).settings.enabled, false);
    } finally {
        await db.exec('RESET ROLE');
    }
});

test('viewing shifts and managing shift settings are independent role permissions', () => {
    const viewer = aggregateDashboardPermissions(false, [
        { can_view_staff_shifts: true },
    ]);
    assert.equal(canViewStaffShifts(viewer), true);
    assert.equal(canManageStaffShifts(viewer), false);
    const manager = aggregateDashboardPermissions(false, [
        { can_manage_staff_shifts: true },
    ]);
    assert.equal(canViewStaffShifts(manager), false);
    assert.equal(canManageStaffShifts(manager), true);
    const admin = aggregateDashboardPermissions(true, []);
    assert.equal(canViewStaffShifts(admin), true);
    assert.equal(canManageStaffShifts(admin), true);
    assert.equal(isShiftStaff(emptyDashboardPermissions()), false);
    assert.equal(isShiftStaff(viewer), true);
});

test('report periods use rolling UTC time and clamp six-month month-end dates', () => {
    const now = new Date('2026-08-31T12:30:00Z');
    assert.equal(shiftPeriodStart('day', now), '2026-08-30T12:30:00.000Z');
    assert.equal(shiftPeriodStart('week', now), '2026-08-24T12:30:00.000Z');
    assert.equal(shiftPeriodStart('30-days', now), '2026-08-01T12:30:00.000Z');
    assert.equal(shiftPeriodStart('6-months', now), '2026-02-28T12:30:00.000Z');
    assert.equal(shiftPeriodStart('latest-wave', now), null);
});
