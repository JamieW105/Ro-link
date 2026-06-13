import { NextRequest, NextResponse } from 'next/server';

import { canAccessDashboardOrLivePanel, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
        const { error: cleanupError } = await client
            .from('live_servers')
            .delete()
            .eq('server_id', serverId)
            .lt('updated_at', fiveMinutesAgo);

        if (cleanupError) {
            console.error('[Live Servers API] Stale cleanup failed:', cleanupError);
        }
    }

    return NextResponse.json(data || []);
}
