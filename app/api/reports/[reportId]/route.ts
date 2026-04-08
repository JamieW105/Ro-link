import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const VALID_REPORT_STATUSES = new Set(['PENDING', 'RESOLVED', 'DISMISSED']);

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

        console.error('[Report Details API] Access check failed:', error);
        return { error: NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }) };
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireReportAccess(serverId);
    if ('error' in access) {
        return access.error;
    }

    const { reportId } = await params;
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('reports')
        .select('*')
        .eq('server_id', serverId)
        .eq('id', reportId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(data);
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireReportAccess(serverId);
    if ('error' in access) {
        return access.error;
    }

    const body = await req.json().catch(() => ({}));
    const status = trimString(body?.status).toUpperCase();
    const moderatorNote = trimString(body?.moderatorNote) || null;

    if (status && !VALID_REPORT_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Invalid report status' }, { status: 400 });
    }

    const { reportId } = await params;
    const client = getSupabaseAdmin();

    const updates: Record<string, unknown> = {
        moderator_id: access.userId,
        moderator_note: moderatorNote,
    };

    if (status) {
        updates.status = status;
        updates.resolved_at = status === 'PENDING' ? null : new Date().toISOString();
    }

    const { data, error } = await client
        .from('reports')
        .update(updates)
        .eq('server_id', serverId)
        .eq('id', reportId)
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
