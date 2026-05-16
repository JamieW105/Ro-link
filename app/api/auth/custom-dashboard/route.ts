import { NextResponse } from 'next/server';
import { isAllowedDashboardUrl } from '@/lib/customDashboardDomains';

function getCanonicalBaseUrl(req: Request) {
    const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
    if (configured) return configured.replace(/\/$/, '');

    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const callbackUrl = url.searchParams.get('callbackUrl') || url.searchParams.get('returnTo') || '';

    if (!isAllowedDashboardUrl(callbackUrl)) {
        return NextResponse.json({ error: 'Invalid custom dashboard callback URL.' }, { status: 400 });
    }

    const signInUrl = new URL('/api/auth/signin/discord', getCanonicalBaseUrl(req));
    signInUrl.searchParams.set('callbackUrl', callbackUrl);

    return NextResponse.redirect(signInUrl);
}

