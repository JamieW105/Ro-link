import { NextRequest, NextResponse } from 'next/server';

import {
    canManageReports,
    canAccessDashboardOrLivePanel,
    requireDashboardAccess,
    trimString,
} from '@/lib/serverDashboardAccess';
import { enrichLogRecordsWithLinkedUsers, expandLinkedLogTargets } from '@/lib/logIdentity';
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
    const allTargets = req.nextUrl.searchParams
        .getAll('target')
        .map(trimString)
        .filter(Boolean);
    const targets = allTargets.length > 1 ? allTargets : [];
    const globalTargets = req.nextUrl.searchParams.get('globalTargets') === 'true';
    const limit = parseLimit(req.nextUrl.searchParams.get('limit'), 100, 500);

    const access = await requireDashboardAccess(
        serverId,
        globalTargets ? canManageReports : canAccessDashboardOrLivePanel,
    );
    if ('error' in access) {
        return access.error;
    }

    const client = getSupabaseAdmin();
    const createBaseQuery = () => {
        let nextQuery = client
            .from('logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (!globalTargets) {
            nextQuery = nextQuery.eq('server_id', serverId);
        }

        return nextQuery;
    };

    let data: Record<string, unknown>[] = [];

    if (targets.length > 0) {
        const targetFilters = await expandLinkedLogTargets(client, targets);
        const [targetResult, moderatorResult] = await Promise.all([
            createBaseQuery().in('target', targetFilters),
            createBaseQuery().in('moderator', targetFilters),
        ]);

        if (targetResult.error || moderatorResult.error) {
            return NextResponse.json({ error: targetResult.error?.message || moderatorResult.error?.message }, { status: 500 });
        }

        data = sortAndLimitLogs([...(targetResult.data || []), ...(moderatorResult.data || [])], limit);
    } else if (target) {
        const targetFilters = await expandLinkedLogTargets(client, [target]);
        if (targetFilters.some((value) => value !== target)) {
            const [targetResult, moderatorResult] = await Promise.all([
                createBaseQuery().in('target', targetFilters),
                createBaseQuery().in('moderator', targetFilters),
            ]);

            if (targetResult.error || moderatorResult.error) {
                return NextResponse.json({ error: targetResult.error?.message || moderatorResult.error?.message }, { status: 500 });
            }

            data = sortAndLimitLogs([...(targetResult.data || []), ...(moderatorResult.data || [])], limit);
        } else {
            const [targetResult, moderatorResult] = await Promise.all([
                createBaseQuery().ilike('target', target),
                createBaseQuery().ilike('moderator', target),
            ]);

            if (targetResult.error || moderatorResult.error) {
                return NextResponse.json({ error: targetResult.error?.message || moderatorResult.error?.message }, { status: 500 });
            }

            data = sortAndLimitLogs([...(targetResult.data || []), ...(moderatorResult.data || [])], limit);
        }
    } else {
        const result = await createBaseQuery();
        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }
        data = result.data || [];
    }

    const logs = await enrichLogRecordsWithLinkedUsers(client, data);
    return NextResponse.json(logs);
}
