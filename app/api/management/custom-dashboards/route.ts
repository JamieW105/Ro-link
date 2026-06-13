import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { supabase } from '@/lib/supabase';
import { buildDashboardHostname, getRolinkRootDomains, validateDashboardSubdomain } from '@/lib/customDashboardDomains';
import {
    DEFAULT_CUSTOM_DASHBOARD_LAYOUT,
    DEFAULT_CUSTOM_DASHBOARD_THEME,
    normalizeCustomDashboardLayout,
    normalizeCustomDashboardMetadata,
    normalizeCustomDashboardTheme,
} from '@/lib/customDashboardSettings';

const CUSTOM_DASHBOARD_COLUMNS = 'id, server_id, subdomain, layout, theme, metadata, created_by, created_at, updated_at';

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
        .select(CUSTOM_DASHBOARD_COLUMNS)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Management/CustomDashboards] List failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((domain) => ({
        ...domain,
        hostname: buildDashboardHostname(domain.subdomain),
        hostnames: getRolinkRootDomains().map((rootDomain) => buildDashboardHostname(domain.subdomain, rootDomain)),
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
                layout: normalizeCustomDashboardLayout(body?.layout || DEFAULT_CUSTOM_DASHBOARD_LAYOUT),
                theme: normalizeCustomDashboardTheme(body?.theme || DEFAULT_CUSTOM_DASHBOARD_THEME),
                metadata: normalizeCustomDashboardMetadata(body?.metadata),
                created_by: auth.userId,
            })
            .select(CUSTOM_DASHBOARD_COLUMNS)
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'That subdomain is already in use.' }, { status: 409 });
            }
            throw error;
        }

        return NextResponse.json({
            ...data,
            hostname: buildDashboardHostname(data.subdomain),
            hostnames: getRolinkRootDomains().map((rootDomain) => buildDashboardHostname(data.subdomain, rootDomain)),
        }, { status: 201 });
    } catch (error) {
        console.error('[Management/CustomDashboards] Create failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create test dashboard.' },
            { status: 500 },
        );
    }
}
