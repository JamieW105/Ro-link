import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { supabase } from '@/lib/supabase';
import { ROLINK_ROOT_DOMAIN, validateDashboardSubdomain } from '@/lib/customDashboardDomains';

async function requireManageServers() {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    if (!(await hasPermission(userId, 'MANAGE_SERVERS'))) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { userId };
}

export async function GET() {
    const auth = await requireManageServers();
    if (auth.error) return auth.error;

    const { data, error } = await supabase
        .from('custom_dashboard_domains')
        .select('id, server_id, subdomain, created_by, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Management/CustomDashboards] List failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((domain) => ({
        ...domain,
        hostname: `${domain.subdomain}.${ROLINK_ROOT_DOMAIN}`,
    })));
}

export async function POST(req: Request) {
    const auth = await requireManageServers();
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const serverId = String(body?.serverId || '').trim();
        const { subdomain, error: validationError } = validateDashboardSubdomain(body?.subdomain);

        if (!serverId) {
            return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
        }

        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const { data: server, error: serverError } = await supabase
            .from('servers')
            .select('id')
            .eq('id', serverId)
            .maybeSingle();

        if (serverError) throw serverError;
        if (!server) {
            return NextResponse.json({ error: 'That server does not have a Ro-Link setup record yet.' }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('custom_dashboard_domains')
            .insert({
                server_id: serverId,
                subdomain,
                created_by: auth.userId,
            })
            .select('id, server_id, subdomain, created_by, created_at')
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'That subdomain is already in use.' }, { status: 409 });
            }
            throw error;
        }

        return NextResponse.json({
            ...data,
            hostname: `${data.subdomain}.${ROLINK_ROOT_DOMAIN}`,
        }, { status: 201 });
    } catch (error) {
        console.error('[Management/CustomDashboards] Create failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create test dashboard.' },
            { status: 500 },
        );
    }
}

