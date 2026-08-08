import { NextRequest, NextResponse } from 'next/server';

import { buildPlayerPresenceEvents } from '@/lib/playerPresence';
import { canAccessDashboardOrLivePanel, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
) {
    const { data: staleServers, error: staleQueryError } = await client
        .from('live_servers')
        .select('id, players')
        .eq('server_id', serverId)
        .lt('updated_at', staleTime);

    if (staleQueryError) {
        console.error('[Live Servers API] Stale server lookup failed:', staleQueryError);
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
        console.error('[Live Servers API] Stale cleanup failed:', cleanupError);
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
        console.error('[Live Servers API] Failed to store leave events for stale live servers:', presenceError);
    }
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const activeOnly = req.nextUrl.searchParams.get('activeOnly') !== 'false';
    const cleanupStale = req.nextUrl.searchParams.get('cleanupStale') === 'true';

    const access = await requireDashboardAccess(serverId, canAccessDashboardOrLivePanel);
    if ('error' in access) {
        return access.error;
    }

    const client = getSupabaseAdmin();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let query = client
        .from('live_servers')
        .select('*')
        .eq('server_id', serverId)
        .order('updated_at', { ascending: false });

    if (activeOnly) {
        query = query.gte('updated_at', fiveMinutesAgo);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (cleanupStale) {
        await cleanupStaleLiveServers(client, serverId, fiveMinutesAgo);
    }

    return NextResponse.json(data || []);
}
