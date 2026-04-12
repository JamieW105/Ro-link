import { NextResponse } from 'next/server';

import { createStudioPluginSession } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const session = await createStudioPluginSession(req);
        console.info('[PLUGIN][START] Created Studio plugin session', {
            sessionId: session.sessionId,
            expiresAt: session.expiresAt,
        });
        return NextResponse.json(session);
    } catch (error) {
        console.error('[PLUGIN][START] Failed to create Studio plugin session', {
            error: error instanceof Error ? error.message : error,
        });
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to start Studio plugin session.',
        }, { status: 500 });
    }
}
