import { NextResponse } from 'next/server';
import { isAllowedDashboardUrl } from '@/lib/customDashboardDomains';
import { getCanonicalAuthOrigin } from '@/lib/authOrigin';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const callbackUrl = url.searchParams.get('callbackUrl') || url.searchParams.get('returnTo') || '';

    if (!isAllowedDashboardUrl(callbackUrl)) {
        return NextResponse.json({ error: 'Invalid custom dashboard callback URL.' }, { status: 400 });
    }

    const signInUrl = new URL('/auth/signin', getCanonicalAuthOrigin(callbackUrl) || url.origin);
    signInUrl.searchParams.set('callbackUrl', callbackUrl);

    return NextResponse.redirect(signInUrl);
}
