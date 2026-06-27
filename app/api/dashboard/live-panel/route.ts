import { NextRequest, NextResponse } from 'next/server';

import { enrichLogRecordsWithLinkedUsers, expandLinkedLogTargets } from '@/lib/logIdentity';
import { collectModulePanelCommandsFromLiveServers } from '@/lib/modulePanelCommands';
import { buildPlayerPresenceEvents, PLAYER_PRESENCE_RETENTION_MS, type PlayerPresenceActivity } from '@/lib/playerPresence';
import { canAccessLivePanel, canManageReports, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function parseLimit(value: string | null, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(Math.floor(parsed), max);
}

function sortAndLimitLogs(logs: Record<string, unknown>[], limit: number) {
    const deduped = new Map<string, Record<string, unknown>>();

    for (const log of logs) {
        const id = trimString(log.id) || JSON.stringify(log);
        deduped.set(id, log);
    }

    return Array.from(deduped.values())
        .sort((left, right) => {
            const leftTime = new Date(trimString(left.timestamp)).getTime();
            const rightTime = new Date(trimString(right.timestamp)).getTime();
            return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
        })
        .slice(0, limit);
}

function isMissingPlayerPresenceEventsTable(error: { code?: string } | null) {
    return error?.code === '42P01' || error?.code === 'PGRST205';
}

type LiveServerRoster = {
    id?: unknown;
    players?: unknown;
};

async function cleanupStaleLiveServers(
    client: ReturnType<typeof getSupabaseAdmin>,
    serverId: string,
    staleTime: string,
    canStorePresence: boolean,
) {
    const { data: staleServers, error: staleQueryError } = await client
        .from('live_servers')
        .select('id, players')
        .eq('server_id', serverId)
        .lt('updated_at', staleTime);

    if (staleQueryError) {
        console.error('[Live Panel API] Stale server lookup failed:', staleQueryError);
        return;
    }

    const staleRosters = (staleServers || []) as LiveServerRoster[];
    const staleIds = staleRosters.map((server) => trimString(server.id)).filter(Boolean);
    if (staleIds.length === 0) {
        return;
    }

    const { data: deletedServers, error: cleanupError } = await client
        .from('live_servers')
        .delete()
        .eq('server_id', serverId)
        .lt('updated_at', staleTime)
        .in('id', staleIds)
        .select('id');

    if (cleanupError) {
        console.error('[Live Panel API] Stale cleanup failed:', cleanupError);
        return;
    }

    if (!canStorePresence) {
        return;
    }

    const deletedIds = new Set(((deletedServers || []) as LiveServerRoster[]).map((server) => trimString(server.id)));
    const events = staleRosters
        .filter((server) => deletedIds.has(trimString(server.id)))
        .flatMap((server) => buildPlayerPresenceEvents({
            previousPlayers: server.players,
            currentPlayers: [],
            serverId,
            jobId: trimString(server.id),
        }));

    if (events.length === 0) {
        return;
    }

    const { error: presenceError } = await client
        .from('player_presence_events')
        .insert(events);

    if (presenceError && !isMissingPlayerPresenceEventsTable(presenceError)) {
        console.error('[Live Panel API] Failed to store leave events for stale live servers:', presenceError);
    }
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const target = trimString(req.nextUrl.searchParams.get('target'));
    const cleanupStale = req.nextUrl.searchParams.get('cleanupStale') === 'true';
    const logLimit = parseLimit(req.nextUrl.searchParams.get('logLimit'), 120, 300);

    const access = await requireDashboardAccess(serverId, canAccessLivePanel);
    if ('error' in access) {
        return access.error;
    }

    const client = getSupabaseAdmin();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const playerActivitySince = new Date(Date.now() - PLAYER_PRESENCE_RETENTION_MS).toISOString();
    const canViewReports = canManageReports(access.permissions);

    const createLogsQuery = () => client
        .from('logs')
        .select('*')
        .eq('server_id', serverId)
        .order('timestamp', { ascending: false })
        .limit(logLimit);

    const linkedTargets = target ? await expandLinkedLogTargets(client, [target]) : [];
    const hasLinkedTargets = linkedTargets.some((value) => value !== target);

    const [serverResult, liveServersResult, logsResult, reportsResult, playerActivityResult] = await Promise.all([
        client
            .from('servers')
            .select('id, place_id')
            .eq('id', serverId)
            .maybeSingle(),
        client
            .from('live_servers')
            .select('*')
            .eq('server_id', serverId)
            .gte('updated_at', fiveMinutesAgo)
            .order('updated_at', { ascending: false }),
        target
            ? Promise.all([
                hasLinkedTargets
                    ? createLogsQuery().in('target', linkedTargets)
                    : createLogsQuery().ilike('target', `%${target}%`),
                hasLinkedTargets
                    ? createLogsQuery().in('moderator', linkedTargets)
                    : createLogsQuery().ilike('moderator', `%${target}%`),
            ])
            : createLogsQuery(),
        canViewReports
            ? client
                .from('reports')
                .select('id, reported_roblox_username, reporter_roblox_username, reporter_discord_id, reason, created_at')
                .eq('server_id', serverId)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [], error: null }),
        client
            .from('player_presence_events')
            .select('id, server_id, job_id, roblox_user_id, username, display_name, avatar_url, event_type, occurred_at')
            .eq('server_id', serverId)
            .gte('occurred_at', playerActivitySince)
            .order('occurred_at', { ascending: false })
            .limit(5000),
    ]);

    if (serverResult.error) {
        return NextResponse.json({ error: serverResult.error.message }, { status: 500 });
    }

    if (liveServersResult.error) {
        return NextResponse.json({ error: liveServersResult.error.message }, { status: 500 });
    }

    if (Array.isArray(logsResult)) {
        const [targetLogsResult, moderatorLogsResult] = logsResult;
        if (targetLogsResult.error || moderatorLogsResult.error) {
            return NextResponse.json({ error: targetLogsResult.error?.message || moderatorLogsResult.error?.message }, { status: 500 });
        }
    } else if (logsResult.error) {
        return NextResponse.json({ error: logsResult.error.message }, { status: 500 });
    }

    if (reportsResult.error) {
        return NextResponse.json({ error: reportsResult.error.message }, { status: 500 });
    }

    if (playerActivityResult.error && !isMissingPlayerPresenceEventsTable(playerActivityResult.error)) {
        return NextResponse.json({ error: playerActivityResult.error.message }, { status: 500 });
    }

    if (playerActivityResult.error && isMissingPlayerPresenceEventsTable(playerActivityResult.error)) {
        console.warn('[Live Panel API] player_presence_events is missing; no join/leave activity will be returned until the schema is migrated.');
    }

    if (cleanupStale) {
        await cleanupStaleLiveServers(client, serverId, fiveMinutesAgo, !playerActivityResult.error);

        if (!playerActivityResult.error) {
            const { error: activityCleanupError } = await client
                .from('player_presence_events')
                .delete()
                .eq('server_id', serverId)
                .lt('occurred_at', playerActivitySince);

            if (activityCleanupError) {
                console.error('[Live Panel API] Player activity cleanup failed:', activityCleanupError);
            }
        }
    }

    const rawLogs = Array.isArray(logsResult)
        ? sortAndLimitLogs([...(logsResult[0].data || []), ...(logsResult[1].data || [])], logLimit)
        : logsResult.data || [];
    const logs = await enrichLogRecordsWithLinkedUsers(client, rawLogs);

    return NextResponse.json({
        server: {
            id: serverId,
            placeId: trimString(serverResult.data?.place_id) || null,
        },
        liveServers: liveServersResult.data || [],
        playerActivity: playerActivityResult.error ? [] : (playerActivityResult.data || []) as PlayerPresenceActivity[],
        modulePanelCommands: collectModulePanelCommandsFromLiveServers(liveServersResult.data || []),
        logs,
        pendingReports: reportsResult.data || [],
    });
}
