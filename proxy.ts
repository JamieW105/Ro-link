import { NextResponse, type NextRequest } from 'next/server';
import { resolveDashboardSubdomainFromHostnameCandidates } from '@/lib/customDashboardDomains';
import { consumeRateLimit, rateLimitHeaders, type RateLimitRule, type RateLimitResult } from '@/lib/rateLimit';

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
        console.error('[CustomDashboardProxy] Failed to resolve dashboard subdomain.', {
            subdomain,
            status: response.status,
        });
        return null;
    }

    const rows = await response.json() as Array<{ server_id?: string }>;
    return rows[0]?.server_id || null;
}

function firstHeaderValue(value: string | null) {
    return (value || '').split(',')[0]?.trim() || '';
}

function getForwardedProtocol(req: NextRequest) {
    const forwardedProto = firstHeaderValue(req.headers.get('x-forwarded-proto')).toLowerCase();
    if (forwardedProto) {
        return forwardedProto;
    }

    const forwarded = req.headers.get('forwarded') || '';
    const protoMatch = forwarded.match(/(?:^|[;,]\s*)proto=([^;,]+)/i);
    return protoMatch?.[1]?.replace(/^"|"$/g, '').toLowerCase() || '';
}

function isLocalHost(hostname: string) {
    return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '::1'
        || hostname.endsWith('.localhost');
}

function shouldEnforceHttps(req: NextRequest) {
    if (process.env.NODE_ENV !== 'production' || process.env.ENFORCE_HTTPS === 'false') {
        return false;
    }

    if (isLocalHost(req.nextUrl.hostname)) {
        return false;
    }

    const forwardedProtocol = getForwardedProtocol(req);
    return forwardedProtocol
        ? forwardedProtocol !== 'https'
        : req.nextUrl.protocol !== 'https:';
}

function getClientIp(req: NextRequest) {
    return firstHeaderValue(req.headers.get('cf-connecting-ip'))
        || firstHeaderValue(req.headers.get('x-real-ip'))
        || firstHeaderValue(req.headers.get('x-forwarded-for'))
        || 'unknown';
}

function applySecurityHeaders(response: NextResponse, req: NextRequest) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (process.env.NODE_ENV === 'production' && !isLocalHost(req.nextUrl.hostname)) {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    return response;
}

function rateLimitedResponse(result: RateLimitResult, req: NextRequest) {
    const response = NextResponse.json(
        {
            error: 'Too many requests. Try again shortly.',
            retryAfterSeconds: result.retryAfterSeconds,
        },
        {
            status: 429,
            headers: rateLimitHeaders(result),
        },
    );
    return applySecurityHeaders(response, req);
}

function getApiRateLimitRule(pathname: string, method: string): { name: string; rule: RateLimitRule } | null {
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/roblox/auth') || pathname.startsWith('/api/roblox/callback')) {
        return {
            name: 'interactive-auth',
            rule: { limit: 60, windowMs: 60_000, blockMs: 10 * 60_000 },
        };
    }

    if (pathname.startsWith('/api/plugin/session')) {
        return {
            name: 'plugin-session',
            rule: { limit: 30, windowMs: 60_000, blockMs: 10 * 60_000 },
        };
    }

    if (
        pathname.startsWith('/api/v1')
        || pathname === '/api/roblox/poll'
        || pathname === '/api/roblox/message'
    ) {
        return {
            name: 'server-api',
            rule: { limit: 600, windowMs: 60_000, blockMs: 5 * 60_000 },
        };
    }

    if (method !== 'GET' && pathname.startsWith('/api/careers/')) {
        return {
            name: 'public-form',
            rule: { limit: 20, windowMs: 60_000, blockMs: 10 * 60_000 },
        };
    }

    return null;
}

function isDashboardIndexPath(pathname: string) {
    return pathname === '/dashboard'
        || pathname === '/dashboard/'
        || pathname === '/dashboards'
        || pathname === '/dashboards/';
}

export async function proxy(req: NextRequest) {
    if (shouldEnforceHttps(req)) {
        const url = req.nextUrl.clone();
        url.protocol = 'https:';
        return applySecurityHeaders(NextResponse.redirect(url, 308), req);
    }

    const apiRateLimit = getApiRateLimitRule(req.nextUrl.pathname, req.method);
    if (apiRateLimit) {
        const clientIp = getClientIp(req);
        const rateLimit = consumeRateLimit(`proxy:${apiRateLimit.name}:${clientIp}`, apiRateLimit.rule);
        if (!rateLimit.allowed) {
            return rateLimitedResponse(rateLimit, req);
        }
    }

    const dashboardHost = resolveDashboardSubdomainFromHostnameCandidates(
        req.headers.get('host'),
        req.headers.get('x-original-host'),
        req.headers.get('x-forwarded-host'),
        req.headers.get('forwarded'),
        req.nextUrl.host,
    );
    const subdomain = dashboardHost?.subdomain;
    if (!subdomain || subdomain.includes('.') || IGNORED_SUBDOMAINS.has(subdomain)) {
        return applySecurityHeaders(NextResponse.next(), req);
    }

    const { pathname, search } = req.nextUrl;
    if (
        pathname.startsWith('/api')
        || pathname.startsWith('/_next')
        || pathname.startsWith('/custom-dashboard')
    ) {
        return applySecurityHeaders(NextResponse.next(), req);
    }

    const serverId = await resolveDashboardServerId(subdomain);
    if (!serverId) {
        const url = req.nextUrl.clone();
        url.pathname = '/custom-dashboard/not-found';
        url.searchParams.set('subdomain', subdomain);
        return applySecurityHeaders(NextResponse.rewrite(url), req);
    }

    if (isDashboardIndexPath(pathname)) {
        const url = req.nextUrl.clone();
        url.pathname = `/custom-dashboard/${serverId}`;
        url.search = '';
        return applySecurityHeaders(NextResponse.redirect(url), req);
    }

    if (pathname === `/dashboard/${serverId}` || pathname.startsWith(`/dashboard/${serverId}/`)) {
        return applySecurityHeaders(NextResponse.next(), req);
    }

    if (pathname.startsWith('/dashboard/')) {
        const url = req.nextUrl.clone();
        url.pathname = `/dashboard/${serverId}`;
        url.search = '';
        return applySecurityHeaders(NextResponse.redirect(url), req);
    }

    const url = req.nextUrl.clone();
    url.pathname = pathname === '/'
        ? `/custom-dashboard/${serverId}`
        : `/dashboard/${serverId}${pathname}`;
    url.search = search;
    return applySecurityHeaders(NextResponse.rewrite(url), req);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|Media).*)'],
};
