import { NextRequest, NextResponse } from 'next/server';

import { canAccessLivePanel, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function parseLimit(value: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 200) : 80;
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const jobId = trimString(req.nextUrl.searchParams.get('jobId'));
    const robloxUserId = trimString(req.nextUrl.searchParams.get('robloxUserId'));
    const before = trimString(req.nextUrl.searchParams.get('before'));
    const level = trimString(req.nextUrl.searchParams.get('level')).toLowerCase();
    const source = trimString(req.nextUrl.searchParams.get('source')).toLowerCase();

    if (!jobId) {
        return NextResponse.json({ error: 'Live server job ID required' }, { status: 400 });
    }

    const access = await requireDashboardAccess(serverId, canAccessLivePanel);
    if ('error' in access) {
        return access.error;
    }

    let query = getSupabaseAdmin()
        .from('runtime_logs')
        .select('id, job_id, source, level, event_type, roblox_user_id, roblox_username, display_name, message, metadata, created_at')
        .eq('server_id', serverId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(parseLimit(req.nextUrl.searchParams.get('limit')));

    if (robloxUserId) query = query.eq('roblox_user_id', robloxUserId);
    if (source === 'server' || source === 'client') query = query.eq('source', source);
    if (before && !Number.isNaN(Date.parse(before))) query = query.lt('created_at', before);
    if (['debug', 'info', 'warn', 'error'].includes(level)) query = query.eq('level', level);

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [] });
}
