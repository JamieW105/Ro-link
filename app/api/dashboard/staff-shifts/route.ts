import { NextResponse } from 'next/server';
import {
    requireDashboardAccess,
    trimString,
} from '@/lib/serverDashboardAccess';
import {
    canViewStaffShifts,
    canManageStaffShifts,
    isShiftStaff,
    SHIFT_PERIODS,
    shiftPeriodStart,
    type ShiftPeriod,
} from '@/lib/staffShifts';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeLivePlayerList } from '@/lib/livePlayers';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
    const params = new URL(req.url).searchParams;
    const serverId = trimString(params.get('serverId'));
    const self = params.get('self') === 'true';
    const settingsOnly = params.get('settingsOnly') === 'true';
    const period = (params.get('period') || 'latest-wave') as ShiftPeriod;
    const offset = Number(params.get('offset') || 0);
    if (
        !serverId ||
        !SHIFT_PERIODS.includes(period) ||
        !Number.isSafeInteger(offset) ||
        offset < 0
    ) {
        return NextResponse.json(
            { error: 'Invalid shift report parameters.' },
            { status: 400 },
        );
    }
    const access = await requireDashboardAccess(serverId, (perms) =>
        self
            ? isShiftStaff(perms)
            : settingsOnly
              ? canManageStaffShifts(perms)
              : canViewStaffShifts(perms),
    );
    if ('error' in access) return access.error;
    const { data, error } = await getSupabaseAdmin().rpc('staff_shift_report', {
        p_server: serverId,
        p_discord: self || settingsOnly ? access.userId : null,
        p_from: shiftPeriodStart(period, new Date()),
        p_offset: offset,
    });
    if (error) {
        console.error('[Staff Shifts] Report failed', error);
        return NextResponse.json(
            {
                error: 'Could not load staff shifts. Please try again.',
            },
            { status: 500 },
        );
    }
    return NextResponse.json(
        settingsOnly ? { settings: data.settings, wave: data.wave } : data,
        { headers: { 'Cache-Control': 'no-store' } },
    );
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const serverId = trimString(body?.serverId);
    if (!serverId || !['start', 'stop'].includes(body?.action))
        return NextResponse.json(
            { error: 'Invalid shift action.' },
            { status: 400 },
        );
    const access = await requireDashboardAccess(serverId, isShiftStaff);
    if ('error' in access) return access.error;
    const db = getSupabaseAdmin();
    const { data: user, error: userError } = await db
        .from('verified_users')
        .select('roblox_id, roblox_username')
        .eq('discord_id', access.userId)
        .maybeSingle();
    if (userError)
        return NextResponse.json(
            { error: 'Could not load linked account.' },
            { status: 500 },
        );
    if (!user)
        return NextResponse.json(
            { error: 'Link your Roblox account before starting a shift.' },
            { status: 400 },
        );
    let jobId = '';
    if (body.action === 'start') {
        const { data: servers, error } = await db
            .from('live_servers')
            .select('id, players')
            .eq('server_id', serverId)
            .gte('updated_at', new Date(Date.now() - 120_000).toISOString());
        if (error)
            return NextResponse.json(
                { error: 'Could not check game presence.' },
                { status: 500 },
            );
        jobId =
            (servers || []).find((server: { players: unknown }) =>
                normalizeLivePlayerList(server.players).some(
                    (player) => player.userId === String(user.roblox_id),
                ),
            )?.id || '';
        if (!jobId)
            return NextResponse.json(
                { error: 'Join the linked game before starting a shift.' },
                { status: 409 },
            );
    }
    const { error } = await db.rpc('staff_shift_manual', {
        p_server: serverId,
        p_job: jobId,
        p_discord: access.userId,
        p_roblox: String(user.roblox_id),
        p_username: user.roblox_username,
        p_start: body.action === 'start',
    });
    if (error)
        return NextResponse.json(
            {
                error: 'Could not change shift. Manual shifts require staff shifts enabled and automatic start off.',
            },
            { status: 409 },
        );
    return NextResponse.json({ ok: true });
}
