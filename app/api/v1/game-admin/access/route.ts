import { NextResponse } from 'next/server';

import { resolveRoLinkAdminAccess } from '@/lib/gameAdmin';

export async function GET(req: Request) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const robloxId = searchParams.get('robloxId');

    if (!robloxId) {
        return NextResponse.json({ error: 'robloxId is required' }, { status: 400 });
    }

    const access = await resolveRoLinkAdminAccess(apiKey, robloxId);
    if (!access) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    return NextResponse.json(access);
}
