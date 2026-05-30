import { NextRequest, NextResponse } from 'next/server';

import {
    canManageReports,
    canAccessDashboardOrLivePanel,
    requireDashboardAccess,
    trimString,
} from '@/lib/serverDashboardAccess';
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
    let query = client
        .from('logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (!globalTargets) {
        query = query.eq('server_id', serverId);
    }

    if (targets.length > 0) {
        query = query.in('target', targets);
    } else if (target) {
        query = query.ilike('target', target);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}
