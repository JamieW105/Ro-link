import { NextResponse } from 'next/server';

import { getStudioPluginSessionStatus } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId')?.trim();
    const code = searchParams.get('code')?.trim();

    if (!sessionId || !code) {
        console.warn('[PLUGIN][STATUS] Missing session parameters', {
            sessionId: sessionId || null,
            hasCode: Boolean(code),
            url: req.url,
        });
        return NextResponse.json({ error: 'sessionId and code are required.' }, { status: 400 });
    }

    try {
        const session = await getStudioPluginSessionStatus(sessionId, code);
        if (!session.found) {
            console.warn('[PLUGIN][STATUS] Studio plugin session lookup failed', {
                sessionId,
                reason: session.reason,
            });

            const error = session.reason === 'expired'
                ? 'Plugin session expired. Start the Studio connection again.'
                : session.reason === 'code_mismatch'
                    ? 'Plugin session code mismatch. Start the Studio connection again.'
                    : 'Plugin session was not found.';

            return NextResponse.json({ error }, { status: 404 });
        }

        return NextResponse.json(session);
    } catch (error) {
        console.error('[PLUGIN][STATUS] Failed to load Studio plugin session status', {
            sessionId,
            error: error instanceof Error ? error.message : error,
        });

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to load Studio plugin session status.',
        }, { status: 500 });
    }
}
