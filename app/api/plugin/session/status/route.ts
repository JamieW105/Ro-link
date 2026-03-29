import { NextResponse } from 'next/server';

import { getStudioPluginSessionStatus } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId')?.trim();
    const code = searchParams.get('code')?.trim();

    if (!sessionId || !code) {
        return NextResponse.json({ error: 'sessionId and code are required.' }, { status: 400 });
    }

    const session = await getStudioPluginSessionStatus(sessionId, code);
    if (!session) {
        return NextResponse.json({ error: 'Plugin session not found or expired.' }, { status: 404 });
    }

    return NextResponse.json(session);
}
