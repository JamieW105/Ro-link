import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

async function requireReportAccess(serverId: string) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = trimString((session.user as { id?: string }).id);
    if (!userId || !serverId) {
        return { error: NextResponse.json({ error: 'Server ID required' }, { status: 400 }) };
    }

    try {
        const permissions = await resolveDashboardUserPermissions(serverId, userId);
        if (!permissions.is_admin && !permissions.can_manage_reports) {
            return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
        }

        return { session, userId, permissions };
    } catch (error) {
        const discordError = error as { status?: number };
        if (discordError?.status === 404 || discordError?.status === 403) {
            return { error: NextResponse.json({ error: 'Not a member of this server' }, { status: 403 }) };
        }

        console.error('[Reports API] Access check failed:', error);
        return { error: NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }) };
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = trimString(searchParams.get('serverId'));
    const status = trimString(searchParams.get('status')).toUpperCase();

    const access = await requireReportAccess(serverId);
    if ('error' in access) {
        return access.error;
    }

    const client = getSupabaseAdmin();
    let query = client
        .from('reports')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: false });

    if (status && status !== 'ALL') {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}
