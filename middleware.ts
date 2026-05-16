import { NextResponse, type NextRequest } from 'next/server';
import { resolveDashboardSubdomainFromHostname } from '@/lib/customDashboardDomains';

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

async function resolveDashboardServerId(subdomain: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) return null;

    const url = new URL('/rest/v1/custom_dashboard_domains', supabaseUrl);
    url.searchParams.set('select', 'server_id');
    url.searchParams.set('subdomain', `eq.${subdomain}`);
    url.searchParams.set('limit', '1');

    const response = await fetch(url, {
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 30 },
    });

    if (!response.ok) {
        console.error('[CustomDashboardMiddleware] Failed to resolve dashboard subdomain.', {
            subdomain,
            status: response.status,
        });
        return null;
    }

    const rows = await response.json() as Array<{ server_id?: string }>;
    return rows[0]?.server_id || null;
}

export async function middleware(req: NextRequest) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const hostname = host.split(':')[0].toLowerCase();
    const subdomain = resolveDashboardSubdomainFromHostname(hostname);
    if (!subdomain || subdomain.includes('.') || IGNORED_SUBDOMAINS.has(subdomain)) {
        return NextResponse.next();
    }

    const { pathname, search } = req.nextUrl;
    if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/dashboard')) {
        return NextResponse.next();
    }

    const serverId = await resolveDashboardServerId(subdomain);
    if (!serverId) {
        const url = req.nextUrl.clone();
        url.pathname = '/custom-dashboard/not-found';
        url.searchParams.set('subdomain', subdomain);
        return NextResponse.rewrite(url);
    }

    const url = req.nextUrl.clone();
    url.pathname = pathname === '/'
        ? `/custom-dashboard/${serverId}`
        : `/dashboard/${serverId}${pathname}`;
    url.search = search;
    return NextResponse.rewrite(url);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|Media).*)'],
};

