import { NextResponse } from 'next/server';

import { getStudioPluginServers, requireAuthorizedStudioPluginSession } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await requireAuthorizedStudioPluginSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Studio plugin authorization is missing or expired.' }, { status: 401 });
    }

    try {
        const payload = await getStudioPluginServers(req, session);
        return NextResponse.json(payload);
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to load Ro-Link servers for the plugin.',
        }, { status: 500 });
    }
}
