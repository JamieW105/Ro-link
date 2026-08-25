import { NextResponse } from 'next/server';

import { GET as getUserData } from '@/app/api/v1/game-admin/user-data/route';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const robloxUserId = searchParams.get('robloxId') || searchParams.get('userId');
    const robloxUsername = searchParams.get('robloxUsername');
    const username = robloxUsername || searchParams.get('username') || searchParams.get('user');
    const discordId = searchParams.get('discordId');

    // Heartbeat check for uptime monitors. Do not use the user agent as an
    // authorization bypass for lookups.
    if ((!robloxUserId && !username && !discordId) || searchParams.get('status') === 'check') {
        return NextResponse.json({
            status: 'API Active',
            message: 'Ready for bidirectional mapping'
        }, { status: 200 });
    }

    try {
        const response = await getUserData(req);
        const payload = await response.json() as Record<string, unknown>;
        if (!response.ok) {
            return NextResponse.json(payload, { status: response.status });
        }

        const verifiedUser = payload.verifiedUser as Record<string, unknown> | null;
        return NextResponse.json({
            ...payload,
            verified: Boolean(verifiedUser),
            discordId: verifiedUser?.discordId ?? null,
            robloxId: verifiedUser?.robloxId ?? (payload.user as Record<string, unknown> | undefined)?.robloxId ?? null,
            robloxUsername: verifiedUser?.robloxUsername ?? (payload.user as Record<string, unknown> | undefined)?.robloxUsername ?? null,
        }, {
            headers: { 'Cache-Control': 'no-store' },
        });

    } catch (err: unknown) {
        console.error('[LOOKUP API] Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
