import { NextResponse } from 'next/server';

import { createStudioPluginSession } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const session = await createStudioPluginSession(req);
        return NextResponse.json(session);
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to start Studio plugin session.',
        }, { status: 500 });
    }
}
