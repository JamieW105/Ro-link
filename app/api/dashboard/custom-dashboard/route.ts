import { NextRequest, NextResponse } from 'next/server';

import { buildDashboardHostname, getRolinkRootDomains, validateDashboardSubdomain } from '@/lib/customDashboardDomains';
import {
    DEFAULT_CUSTOM_DASHBOARD_LAYOUT,
    DEFAULT_CUSTOM_DASHBOARD_THEME,
    normalizeCustomDashboardLayout,
    normalizeCustomDashboardMetadata,
    normalizeCustomDashboardTheme,
} from '@/lib/customDashboardSettings';
import { canManageSettings, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const CUSTOM_DASHBOARD_COLUMNS = [
    'id',
    'server_id',
    'subdomain',
    'layout',
    'theme',
    'metadata',
    'created_by',
    'created_at',
    'updated_at',
].join(', ');

const CUSTOM_DASHBOARD_BASE_COLUMNS = [
    'id',
    'server_id',
    'subdomain',
    'created_by',
    'created_at',
].join(', ');

function decorateDashboard(row: Record<string, unknown> | null, serverId: string) {
    const subdomain = trimString(row?.subdomain);

    return {
        id: row?.id || null,
        server_id: row?.server_id || serverId,
        subdomain,
        hostname: subdomain ? buildDashboardHostname(subdomain) : '',
        hostnames: subdomain
            ? getRolinkRootDomains().map((rootDomain) => buildDashboardHostname(subdomain, rootDomain))
            : [],
        layout: normalizeCustomDashboardLayout(row?.layout || DEFAULT_CUSTOM_DASHBOARD_LAYOUT),
        theme: normalizeCustomDashboardTheme(row?.theme || DEFAULT_CUSTOM_DASHBOARD_THEME),
        metadata: normalizeCustomDashboardMetadata(row?.metadata),
        created_by: row?.created_by || null,
        created_at: row?.created_at || null,
        updated_at: row?.updated_at || null,
    };
}

async function getExistingDashboard(serverId: string, columns = CUSTOM_DASHBOARD_COLUMNS) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('custom_dashboard_domains')
        .select(columns)
        .eq('server_id', serverId)
        .order('created_at', { ascending: true })
        .limit(1);

    if (error) {
        throw error;
    }

    return Array.isArray(data) ? data[0] || null : null;
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireDashboardAccess(serverId, canManageSettings);
    if ('error' in access) {
        return access.error;
    }

    try {
        const dashboard = await getExistingDashboard(serverId).catch(async (error) => {
            console.warn('[Dashboard/CustomDashboard] Full settings lookup failed, falling back to base row:', error);
            return getExistingDashboard(serverId, CUSTOM_DASHBOARD_BASE_COLUMNS);
        });
        if (!dashboard) {
            return NextResponse.json({ error: 'No custom dashboard is configured for this server.' }, { status: 404 });
        }

        return NextResponse.json(decorateDashboard(dashboard, serverId));
    } catch (error) {
        console.error('[Dashboard/CustomDashboard] Load failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load custom dashboard settings.' },
            { status: 500 },
        );
    }
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const serverId = trimString(body?.serverId);
    const access = await requireDashboardAccess(serverId, canManageSettings);
    if ('error' in access) {
        return access.error;
    }

    const existingDashboard = await getExistingDashboard(serverId).catch((error) => {
        console.error('[Dashboard/CustomDashboard] Existing lookup failed:', error);
        return null;
    });

    if (!existingDashboard) {
        return NextResponse.json({ error: 'No custom dashboard is configured for this server.' }, { status: 404 });
    }

    const currentSubdomain = trimString(existingDashboard?.subdomain);
    const requestedSubdomain = trimString(body?.subdomain || currentSubdomain);
    const { subdomain, error: validationError } = validateDashboardSubdomain(requestedSubdomain);

    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const row = {
        server_id: serverId,
        subdomain,
        layout: normalizeCustomDashboardLayout(body?.layout),
        theme: normalizeCustomDashboardTheme(body?.theme),
        metadata: normalizeCustomDashboardMetadata(body?.metadata),
        created_by: existingDashboard?.created_by || access.userId,
        updated_at: new Date().toISOString(),
    };

    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('custom_dashboard_domains')
        .update(row)
        .eq('id', existingDashboard.id)
        .select(CUSTOM_DASHBOARD_COLUMNS)
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'That subdomain is already in use.' }, { status: 409 });
        }

        console.error('[Dashboard/CustomDashboard] Save failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(decorateDashboard(data, serverId));
}
