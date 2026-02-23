import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pluginStore } from '../../store';

export async function POST(request: Request) {
    try {
        const { sessionId } = await request.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const session = pluginStore.sessions.get(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Generate the durable "token" to replace the session exchange
        const durableToken = crypto.randomUUID();

        // Update session Memory
        pluginStore.sessions.set(sessionId, {
            ...session,
            status: 'approved',
            token: durableToken
        });

        // Store Token memory
        pluginStore.tokens.set(durableToken, {
            status: 'approved'
        });

        return NextResponse.json({ success: true, token: durableToken });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function OPTIONS(request: Request) {
    return NextResponse.json({}, { headers: { 'Allow': 'POST, OPTIONS' } });
}
