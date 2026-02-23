import { NextResponse } from 'next/server';
import { pluginStore } from '../../store';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const session = pluginStore.sessions.get(sessionId);

        if (!session) {
            return NextResponse.json({ status: 'pending' });
        }

        if (session.status === 'approved' && session.token) {
            return NextResponse.json({ token: session.token });
        }

        return NextResponse.json({ status: session.status });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function OPTIONS(request: Request) {
    return NextResponse.json({}, { headers: { 'Allow': 'GET, OPTIONS' } });
}
