import { NextRequest, NextResponse } from 'next/server';

import { canAccessLivePanel, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function parseLimit(value: string | null, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(Math.floor(parsed), max);
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

    let logsQuery = client
        .from('logs')
        .select('*')
        .eq('server_id', serverId)
        .order('timestamp', { ascending: false })
        .limit(logLimit);

    if (target) {
        logsQuery = logsQuery.ilike('target', `%${target}%`);
    }

    const [serverResult, liveServersResult, logsResult] = await Promise.all([
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
        logsQuery,
    ]);

    if (serverResult.error) {
        return NextResponse.json({ error: serverResult.error.message }, { status: 500 });
    }

    if (liveServersResult.error) {
        return NextResponse.json({ error: liveServersResult.error.message }, { status: 500 });
    }

    if (logsResult.error) {
        return NextResponse.json({ error: logsResult.error.message }, { status: 500 });
    }

    if (cleanupStale) {
        const { error: cleanupError } = await client
            .from('live_servers')
            .delete()
            .eq('server_id', serverId)
            .lt('updated_at', fiveMinutesAgo);

        if (cleanupError) {
            console.error('[Live Panel API] Stale cleanup failed:', cleanupError);
        }
    }

    return NextResponse.json({
        server: {
            id: serverId,
            placeId: trimString(serverResult.data?.place_id) || null,
        },
        liveServers: liveServersResult.data || [],
        logs: logsResult.data || [],
    });
}
