import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { handleStaffShiftCommand } from '../lib/discordStaffShifts';
import { normalizeLivePlayerList } from '../lib/livePlayers';
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
        CREATE TABLE public.dashboard_roles(id text);
        CREATE TABLE public.verified_users(discord_id text PRIMARY KEY, roblox_id text, roblox_username text);
        CREATE TABLE public.live_servers(id text PRIMARY KEY, server_id text REFERENCES public.servers(id) ON DELETE CASCADE, players jsonb, updated_at timestamptz);`);
    await db.exec(
        await readFile(
            new URL(
                '../supabase/migrations/20261016000137_staff_shifts.sql',
                import.meta.url,
            ),
            'utf8',
        ),
    );
    await db.exec(
        await readFile(
            new URL(
                '../supabase/migrations/20261016002647_staff_shift_commands.sql',
                import.meta.url,
            ),
            'utf8',
        ),
    );
});
beforeEach(async () => {
    await db.exec(
        `TRUNCATE public.servers CASCADE; TRUNCATE public.verified_users; INSERT INTO public.servers VALUES ('server-1'), ('server-2');`,
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

// Exercise the shared Discord handler against the real SQL, with a small
// PostgREST-shaped adapter instead of remote credentials or a live bot.
class CommandQuery {
    fields = '*';
    values: unknown[] = [];
    filters: string[] = [];
    ordering = '';
    constructor(readonly table: string) {}
    select(fields: string) {
        this.fields = fields;
        return this;
    }
    eq(field: string, value: unknown) {
        this.values.push(value);
        this.filters.push(`${field} = $${this.values.length}`);
        return this;
    }
    gte(field: string, value: unknown) {
        this.values.push(value);
        this.filters.push(`${field} >= $${this.values.length}`);
        return this;
    }
    order(field: string, { ascending }: { ascending: boolean }) {
        this.ordering = ` ORDER BY ${field} ${ascending ? 'ASC' : 'DESC'}`;
        return this;
    }
    async execute() {
        const { rows } = await db.query<Record<string, unknown>>(
            `SELECT ${this.fields} FROM public.${this.table}${this.filters.length ? ` WHERE ${this.filters.join(' AND ')}` : ''}${this.ordering}`,
            this.values,
        );
        return { data: rows, error: null };
    }
    async maybeSingle() {
        const result = await this.execute();
        return { data: result.data[0] || null, error: null };
    }
    then<
        TResult1 = Awaited<ReturnType<CommandQuery['execute']>>,
        TResult2 = never,
    >(
        resolve?:
            | ((
                  value: Awaited<ReturnType<CommandQuery['execute']>>,
              ) => TResult1 | PromiseLike<TResult1>)
            | null,
        reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
        return this.execute().then(resolve, reject);
    }
}
const commandDb = {
    from(table: string) {
        return new CommandQuery(table);
    },
    async rpc(name: string, args: Record<string, unknown>) {
        try {
            const keys = Object.keys(args);
            const { rows } = await db.query<{ result: unknown }>(
                `SELECT public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(', ')}) result`,
                Object.values(args),
            );
            return { data: rows[0].result, error: null };
        } catch (error) {
            return { data: null, error: { message: (error as Error).message } };
        }
    },
};
async function command(
    name: string,
    action?: string,
    userId = 'discord-1',
    permissions = aggregateDashboardPermissions(false, [
        { can_access_live_panel: true },
    ]),
    page = 1,
) {
    return handleStaffShiftCommand(
        { serverId: 'server-1', userId, command: name, action, page },
        {
            db: commandDb,
            permissions,
            normalizePlayers: normalizeLivePlayerList,
        },
    );
}
async function linkedInGame() {
    await db.exec(`INSERT INTO public.verified_users VALUES ('discord-1','roblox-1','StaffOne');
        INSERT INTO public.live_servers VALUES ('job-1','server-1','[{"userId":"roblox-1","username":"StaffOne"}]',now());`);
}

test('Discord leaderboard requires View Staff Shifts, independently of settings and staff access', async () => {
    await configure();
    await sync();
    for (const permissions of [
        emptyDashboardPermissions(),
        aggregateDashboardPermissions(false, [
            { can_manage_staff_shifts: true },
        ]),
        aggregateDashboardPermissions(false, [{ can_access_live_panel: true }]),
    ]) {
        const denied = await command(
            'shift-leaderboard',
            undefined,
            'discord-1',
            permissions,
        );
        assert.match(denied.content, /View Staff Shifts permission/);
        assert.equal(denied.embeds, undefined);
    }
    const allowed = await command(
        'shift-leaderboard',
        undefined,
        'discord-1',
        aggregateDashboardPermissions(false, [{ can_view_staff_shifts: true }]),
    );
    assert.match(JSON.stringify(allowed.embeds), /StaffOne/);
    assert.equal(allowed.flags, 64);
    assert.deepEqual(allowed.allowed_mentions, { parse: [] });
});

test('Discord shift start requires staff access, a linked account, and fresh presence in this server', async () => {
    await configure();
    assert.match(
        (
            await command(
                'shift-manage',
                'start',
                'discord-1',
                emptyDashboardPermissions(),
            )
        ).content,
        /staff role/,
    );
    assert.match(
        (await command('shift-manage', 'start')).content,
        /Link your Roblox account/,
    );
    await linkedInGame();
    await db.exec(
        `UPDATE public.live_servers SET updated_at = now()-interval '3 minutes';`,
    );
    assert.match(
        (await command('shift-manage', 'start')).content,
        /Join the linked game/,
    );
    await db.exec(
        `UPDATE public.live_servers SET updated_at = now(), server_id = 'server-2';`,
    );
    assert.match(
        (await command('shift-manage', 'start')).content,
        /Join the linked game/,
    );
    assert.equal(await count(), 0);
});

test('Discord break suppresses automatic starts, excludes break time, and resumes the same logical shift', async () => {
    await configure();
    await linkedInGame();
    assert.match((await command('shift-manage', 'start')).content, /on shift/);
    await db.exec(
        `UPDATE public.staff_shifts SET started_at = now()-interval '1 hour', last_seen_at = now();`,
    );
    assert.match((await command('shift-manage', 'break')).content, /on break/);
    await sync();
    let result = await report('server-1', 'discord-1');
    assert.equal(result.staff[0].active, false);
    assert.match(JSON.stringify((await command('shift')).embeds), /On break/);
    await db.exec(
        `UPDATE public.staff_shifts SET started_at = now()-interval '90 minutes', last_seen_at = now()-interval '30 minutes', ended_at = now()-interval '30 minutes';`,
    );
    await command('shift-manage', 'start');
    await db.exec(
        `UPDATE public.staff_shifts SET started_at = now()-interval '10 minutes', last_seen_at = now() WHERE ended_at IS NULL;`,
    );
    result = await report('server-1', 'discord-1', '2000-01-01');
    assert.equal(result.staff[0].total_seconds, 4200);
    assert.equal(result.staff[0].total_shifts, 1);
    assert.equal(result.staff[0].shift_count, 1);
    const status = await command('shift');
    assert.match(JSON.stringify(status.embeds), /1.17h/);
    assert.match(JSON.stringify(status.embeds), /On shift/);
});

test('Discord stop persists across heartbeats and the next game join can start automatically', async () => {
    await configure();
    await linkedInGame();
    await sync();
    assert.match((await command('shift-manage', 'stop')).content, /has ended/);
    await sync();
    assert.equal((await report()).staff[0].active, false);
    assert.match(JSON.stringify((await command('shift')).embeds), /Off shift/);
    await sync('server-1', 'job-1', []);
    await sync();
    assert.equal((await report()).staff[0].active, true);
    assert.equal((await report()).staff[0].total_shifts, 2);
});

test('Discord shift errors cover disabled shifts, inactive breaks, invalid actions and DMs', async () => {
    await linkedInGame();
    assert.match((await command('shift-manage', 'start')).content, /disabled/);
    await configure();
    assert.match(
        (await command('shift-manage', 'break')).content,
        /Start a shift before/,
    );
    assert.match(
        (await command('shift-manage', 'invalid')).content,
        /Choose start, stop, or break/,
    );
    assert.match(
        (
            await handleStaffShiftCommand(
                { serverId: '', userId: 'discord-1', command: 'shift' },
                {
                    db: commandDb,
                    permissions: emptyDashboardPermissions(),
                    normalizePlayers: normalizeLivePlayerList,
                },
            )
        ).content,
        /Discord server/,
    );
});

test('Discord leaderboard ranks time, paginates, and personal quota output stays scoped to the caller', async () => {
    await configure();
    await db.exec(
        "UPDATE public.staff_shift_waves SET starts_at = now()-interval '1 day', ends_at = now()+interval '6 days'",
    );
    await db.exec(`INSERT INTO public.staff_shifts(server_id,job_id,discord_id,roblox_user_id,username,started_at,last_seen_at,ended_at)
        SELECT 'server-1','job-'||n,'discord-'||n,'roblox-'||n,'Staff'||n,now()-make_interval(hours=>n),now(),now()
        FROM generate_series(1,12) n;`);
    const viewer = aggregateDashboardPermissions(false, [
        { can_view_staff_shifts: true },
    ]);
    const first = JSON.stringify(
        (await command('shift-leaderboard', undefined, 'discord-1', viewer))
            .embeds,
    );
    assert.ok(first.indexOf('Staff12') < first.indexOf('Staff11'));
    assert.match(first, /Page 1\/2/);
    const second = JSON.stringify(
        (await command('shift-leaderboard', undefined, 'discord-1', viewer, 2))
            .embeds,
    );
    assert.match(second, /Staff1/);
    assert.doesNotMatch(second, /Staff12/);
    assert.match(
        (await command('shift-leaderboard', undefined, 'discord-1', viewer, 3))
            .content,
        /does not exist/,
    );
    const personal = JSON.stringify((await command('shift')).embeds);
    assert.match(personal, /1.00 \/ 5h/);
    assert.match(personal, /20%/);
    assert.match(personal, /4.00h remaining/);
    assert.doesNotMatch(personal, /Staff12/);
});

test('break controls and action RPC remain restricted to service-role access', async () => {
    await db.exec('SET ROLE authenticated');
    try {
        await assert.rejects(
            db.query('SELECT * FROM public.staff_shift_controls'),
            /permission denied/,
        );
        await assert.rejects(
            db.query(
                "SELECT staff_shift_action('server-1','job','discord-1','roblox-1','StaffOne','stop')",
            ),
            /permission denied/,
        );
    } finally {
        await db.exec('RESET ROLE');
    }
});
