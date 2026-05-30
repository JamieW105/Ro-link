import { NextRequest, NextResponse } from 'next/server';

import { enrichLogRecordsWithLinkedUsers, expandLinkedLogTargets } from '@/lib/logIdentity';
import { canAccessLivePanel, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
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

    const createLogsQuery = () => client
        .from('logs')
        .select('*')
        .eq('server_id', serverId)
        .order('timestamp', { ascending: false })
        .limit(logLimit);

    const linkedTargets = target ? await expandLinkedLogTargets(client, [target]) : [];
    const hasLinkedTargets = linkedTargets.some((value) => value !== target);

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
        logs,
    });
}
