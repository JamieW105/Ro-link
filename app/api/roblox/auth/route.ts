import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

const OAUTH_STATE_COOKIE = '__Host-rolink-roblox-oauth';

function normalizeReturnTo(value: string | null) {
    if (!value || !value.startsWith('/') || value.startsWith('//')) {
        return '/verify';
    }

    return value.slice(0, 200);
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const clientId = process.env.ROBLOX_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/roblox/callback`;
    const scopes = 'openid profile'; // Minimal scopes needed for identity
    // Bind the callback to this browser.  A state value that is only embedded
    // in the URL can be supplied by an attacker and enables account-link CSRF.
    const state = randomBytes(32).toString('base64url');
    const returnTo = normalizeReturnTo(searchParams.get('returnTo'));

    if (!clientId) {
        return NextResponse.json({ error: 'ROBLOX_CLIENT_ID is not configured' }, { status: 500 });
    }

    const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, returnTo }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60,
    });
    return response;
}
