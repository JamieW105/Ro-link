import { NextRequest, NextResponse } from 'next/server';
import { searchLinkedUsers } from '@/lib/linkedUserSearch';
import { canAccessLivePanel, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
    const access = await requireDashboardAccess(trimString(req.nextUrl.searchParams.get('serverId')), canAccessLivePanel);
    if ('error' in access) return access.error;
    try {
        const users = await searchLinkedUsers(getSupabaseAdmin(), trimString(req.nextUrl.searchParams.get('query')));
        return NextResponse.json({ users }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch {
        return NextResponse.json({ error: 'Failed to search connected accounts.' }, { status: 503 });
    }
}
