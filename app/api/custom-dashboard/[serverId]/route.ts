import { NextResponse } from 'next/server';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import { buildDashboardHostname, getRolinkRootDomains } from '@/lib/customDashboardDomains';
import {
    DEFAULT_CUSTOM_DASHBOARD_LAYOUT,
    DEFAULT_CUSTOM_DASHBOARD_THEME,
    normalizeCustomDashboardLayout,
    normalizeCustomDashboardMetadata,
    normalizeCustomDashboardTheme,
} from '@/lib/customDashboardSettings';
import { supabase } from '@/lib/supabase';

type RouteContext = {
    params: Promise<{ serverId: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
    const { serverId } = await context.params;
    const normalizedServerId = String(serverId || '').trim();

    if (!normalizedServerId) {
        return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
    }

    const [{ data: server, error }, { data: dashboards, error: dashboardError }] = await Promise.all([
        supabase
            .from('servers')
            .select('id')
            .eq('id', normalizedServerId)
            .maybeSingle(),
        supabase
            .from('custom_dashboard_domains')
            .select('id, server_id, subdomain, layout, theme, metadata')
            .eq('server_id', normalizedServerId)
            .order('created_at', { ascending: true })
            .limit(1),
    ]);

    if (error) {
        console.error('[CustomDashboard] Failed to load server record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (dashboardError) {
        console.error('[CustomDashboard] Failed to load dashboard settings:', dashboardError);
        return NextResponse.json({ error: dashboardError.message }, { status: 500 });
    }

    if (!server) {
        return NextResponse.json({ error: 'Dashboard not found.' }, { status: 404 });
    }

    const customDashboard = Array.isArray(dashboards) ? dashboards[0] || null : null;
    const metadata = normalizeCustomDashboardMetadata(customDashboard?.metadata);
    const subdomain = String(customDashboard?.subdomain || '');

    function buildResponse(guildDetails: { name?: string; icon?: string | null }) {
        return NextResponse.json({
            id: normalizedServerId,
            name: metadata.title || guildDetails.name || 'Ro-Link',
            icon: guildDetails.icon || null,
            layout: normalizeCustomDashboardLayout(customDashboard?.layout || DEFAULT_CUSTOM_DASHBOARD_LAYOUT),
            theme: normalizeCustomDashboardTheme(customDashboard?.theme || DEFAULT_CUSTOM_DASHBOARD_THEME),
            metadata,
            subdomain,
            hostname: subdomain ? buildDashboardHostname(subdomain) : '',
            hostnames: subdomain
                ? getRolinkRootDomains().map((rootDomain) => buildDashboardHostname(subdomain, rootDomain))
                : [],
        });
    }

    if (!process.env.DISCORD_TOKEN) {
        return buildResponse({ name: 'Ro-Link', icon: null });
    }

    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const guild = await rest.get(Routes.guild(normalizedServerId)) as { name?: string; icon?: string | null };

        return buildResponse({
            name: guild.name || 'Ro-Link',
            icon: guild.icon || null,
        });
    } catch (error) {
        console.warn('[CustomDashboard] Failed to load Discord guild details:', {
            serverId: normalizedServerId,
            error: error instanceof Error ? error.message : error,
        });

        return buildResponse({ name: 'Ro-Link', icon: null });
    }
}

