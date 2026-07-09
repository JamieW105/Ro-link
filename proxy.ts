import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveDashboardSubdomainFromHostnameCandidates } from '@/lib/customDashboardDomains';
import { consumeRateLimit, rateLimitHeaders, type RateLimitRule, type RateLimitResult } from '@/lib/rateLimit';

const SITE_TESTING_DOMAIN = 'rolink.site';
const SITE_TESTING_PERMISSION = 'SITE_TESTING_ACCESS';
const FULL_MANAGEMENT_PERMISSION = 'MANAGE_RO_LINK';

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

function normalizeHostname(value: string | null | undefined) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        return url.hostname.toLowerCase().replace(/\.$/, '');
    } catch {
        return raw.split(':')[0]?.toLowerCase().replace(/\.$/, '') || '';
    }
}

function getForwardedHostnames(value: string | null) {
    const header = String(value || '').trim();
    if (!header) return [];

    return header
        .split(',')
        .map((entry) => entry
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.toLowerCase().startsWith('host=')) || entry)
        .map((part) => part.includes('=') ? part.slice(part.indexOf('=') + 1) : part)
        .map((host) => normalizeHostname(host.replace(/^"|"$/g, '')))
        .filter(Boolean);
}

function getForwardedHost(value: string | null) {
    const header = firstHeaderValue(value);
    if (!header) return '';

    const hostPart = header
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.toLowerCase().startsWith('host='));

    return (hostPart ? hostPart.slice(hostPart.indexOf('=') + 1) : header).replace(/^"|"$/g, '');
}

function getRequestHost(req: NextRequest) {
    return firstHeaderValue(req.headers.get('host'))
        || firstHeaderValue(req.headers.get('x-original-host'))
        || firstHeaderValue(req.headers.get('x-forwarded-host'))
        || getForwardedHost(req.headers.get('forwarded'))
        || req.nextUrl.host;
}

function getExternalRequestUrl(req: NextRequest) {
    const url = req.nextUrl.clone();
    const host = getRequestHost(req);
    const protocol = getForwardedProtocol(req);

    if (host) {
        url.host = host;
    }

    if (protocol) {
        url.protocol = `${protocol}:`;
    }

    return url.href;
}

function isSiteTestingHost(req: NextRequest) {
    const hostnames = [
        normalizeHostname(req.headers.get('host')),
        normalizeHostname(req.headers.get('x-original-host')),
        ...getForwardedHostnames(req.headers.get('x-forwarded-host')),
        ...getForwardedHostnames(req.headers.get('forwarded')),
        normalizeHostname(req.nextUrl.hostname),
    ].filter(Boolean);

    return hostnames.some((hostname) => (
        hostname === SITE_TESTING_DOMAIN || hostname.endsWith(`.${SITE_TESTING_DOMAIN}`)
    ));
}

function isSiteTestingPublicPath(pathname: string) {
    return pathname === '/auth/signin'
        || pathname.startsWith('/api/auth')
        || pathname.startsWith('/_next')
        || pathname.startsWith('/Media')
        || pathname === '/favicon.ico'
        || pathname === '/icon.png'
        || pathname === '/site-testing-access';
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

async function hasSiteTestingAccess(discordUserId: string) {
    if (discordUserId === '953414442060746854') {
        return true;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('[SiteTestingGate] Missing Supabase configuration.');
        return false;
    }

    const url = new URL('/rest/v1/management_users', supabaseUrl);
    url.searchParams.set('select', 'role:management_roles(permissions)');
    url.searchParams.set('discord_id', `eq.${discordUserId}`);
    url.searchParams.set('limit', '1');

    const response = await fetch(url, {
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 30 },
    });

    if (!response.ok) {
        console.error('[SiteTestingGate] Failed to resolve management permissions.', {
            discordUserId,
            status: response.status,
        });
        return false;
    }

    const rows = await response.json() as Array<{ role?: { permissions?: string[] | null } | null }>;
    const permissions = rows[0]?.role?.permissions || [];
    return permissions.includes(SITE_TESTING_PERMISSION) || permissions.includes(FULL_MANAGEMENT_PERMISSION);
}

async function enforceSiteTestingAccess(req: NextRequest) {
    if (!isSiteTestingHost(req)) {
        return null;
    }

    const { pathname } = req.nextUrl;
    if (isSiteTestingPublicPath(pathname)) {
        return null;
    }

    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    });

    const discordUserId = String(token?.sub || '').trim();
    if (!discordUserId) {
        const url = req.nextUrl.clone();
        url.pathname = '/auth/signin';
        url.search = '';
        url.searchParams.set('callbackUrl', getExternalRequestUrl(req));
        return applySecurityHeaders(NextResponse.redirect(url), req);
    }

    if (await hasSiteTestingAccess(discordUserId)) {
        return null;
    }

    const url = req.nextUrl.clone();
    url.pathname = '/site-testing-access';
    url.search = '';
    return applySecurityHeaders(NextResponse.redirect(url), req);
}

export async function proxy(req: NextRequest) {
    if (shouldEnforceHttps(req)) {
        const url = req.nextUrl.clone();
        url.protocol = 'https:';
        return applySecurityHeaders(NextResponse.redirect(url, 308), req);
    }

    const siteTestingResponse = await enforceSiteTestingAccess(req);
    if (siteTestingResponse) {
        return siteTestingResponse;
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
