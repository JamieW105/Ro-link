import { NextResponse } from 'next/server';

export async function GET() {
    const clientId = process.env.ROBLOX_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/roblox/callback`;
    const scopes = 'openid profile'; // Minimal scopes needed for identity
    const state = Math.random().toString(36).substring(2);

    if (!clientId) {
        return NextResponse.json({ error: 'ROBLOX_CLIENT_ID is not configured' }, { status: 500 });
    }

    const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

    return NextResponse.redirect(authUrl);
}
