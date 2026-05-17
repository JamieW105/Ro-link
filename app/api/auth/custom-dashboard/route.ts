import { NextResponse } from 'next/server';
import { getRolinkRootDomains, isAllowedDashboardUrl } from '@/lib/customDashboardDomains';

function getConfiguredAuthBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_AUTH_BASE_URL
        || process.env.NEXT_PUBLIC_CANONICAL_AUTH_URL;
    if (configured) return configured.replace(/\/$/, '');

    return null;
}

function getCanonicalBaseUrl(req: Request, callbackUrl: string) {
    const configured = getConfiguredAuthBaseUrl();
    if (configured) return configured;

    try {
        const callback = new URL(callbackUrl);
        const hostname = callback.hostname.toLowerCase();
        const rootDomain = getRolinkRootDomains().find((domain) => (
            hostname === domain || hostname.endsWith(`.${domain}`)
        ));

        if (rootDomain) {
            return `${callback.protocol}//${rootDomain}`;
        }
    } catch {
        // The caller validates callbackUrl before this function is used.
    }

    const configuredFallback = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL;
    if (configuredFallback) return configuredFallback.replace(/\/$/, '');

    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const callbackUrl = url.searchParams.get('callbackUrl') || url.searchParams.get('returnTo') || '';

    if (!isAllowedDashboardUrl(callbackUrl)) {
        return NextResponse.json({ error: 'Invalid custom dashboard callback URL.' }, { status: 400 });
    }

    const signInUrl = new URL('/auth/signin', getCanonicalBaseUrl(req, callbackUrl));
    signInUrl.searchParams.set('callbackUrl', callbackUrl);

    return NextResponse.redirect(signInUrl);
}
