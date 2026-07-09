import { NextResponse } from 'next/server';

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
    const state = encodeURIComponent(JSON.stringify({
        nonce: Math.random().toString(36).substring(2),
        returnTo: normalizeReturnTo(searchParams.get('returnTo')),
    }));

    if (!clientId) {
        return NextResponse.json({ error: 'ROBLOX_CLIENT_ID is not configured' }, { status: 500 });
    }

    const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

    return NextResponse.redirect(authUrl);
}
