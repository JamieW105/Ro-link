import { NextResponse } from 'next/server';

import { resolveDashboardSubdomainFromHostname } from '@/lib/customDashboardDomains';
import { supabase } from '@/lib/supabase';

const IGNORED_SUBDOMAINS = new Set([
    'admin',
    'api',
    'app',
    'assets',
    'auth',
    'billing',
    'cdn',
    'dashboard',
    'docs',
    'status',
    'support',
    'www',
]);

export async function GET(req: Request) {
    const url = new URL(req.url);
    const requestedHostname = url.searchParams.get('hostname') || req.headers.get('x-forwarded-host') || req.headers.get('host');
    const subdomain = resolveDashboardSubdomainFromHostname(requestedHostname);

    if (!subdomain || IGNORED_SUBDOMAINS.has(subdomain)) {
        return NextResponse.json({ found: false });
    }

    const { data, error } = await supabase
        .from('custom_dashboard_domains')
        .select('server_id')
        .eq('subdomain', subdomain)
        .maybeSingle();

    if (error) {
        console.error('[CustomDashboardResolve] Failed to resolve custom dashboard:', error);
        return NextResponse.json({ found: false, error: error.message }, { status: 500 });
    }

    if (!data?.server_id) {
        return NextResponse.json({ found: false, subdomain });
    }

    return NextResponse.json({
        found: true,
        subdomain,
        serverId: data.server_id,
    });
}

