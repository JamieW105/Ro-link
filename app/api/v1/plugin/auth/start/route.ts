import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pluginStore } from '../../store';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const studioUserId = body.studioUserId;

        if (!studioUserId) {
            return NextResponse.json({ error: 'Missing studioUserId' }, { status: 400 });
        }

        const sessionId = crypto.randomUUID();
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        // The URL the developer must visit to verify their Roblox Studio session
        const loginUrl = `${protocol}://${host}/dashboard/plugin/verify?session=${sessionId}`;

        // Store session in memory
        pluginStore.sessions.set(sessionId, {
            studio_user_id: studioUserId,
            status: 'pending',
            token: null
        });

        return NextResponse.json({ sessionId, loginUrl });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function OPTIONS(request: Request) {
    return NextResponse.json({}, { headers: { 'Allow': 'POST, OPTIONS' } });
}
