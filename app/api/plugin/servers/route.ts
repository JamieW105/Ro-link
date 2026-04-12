import { NextResponse } from 'next/server';

import { getStudioPluginServers, requireAuthorizedStudioPluginSession, StudioPluginError } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await requireAuthorizedStudioPluginSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Studio plugin authorization is missing or expired.' }, { status: 401 });
        }

        const payload = await getStudioPluginServers(req, session);
        return NextResponse.json(payload);
    } catch (error) {
        console.error('[PLUGIN][SERVERS] Failed to load Ro-Link servers', {
            error: error instanceof Error ? error.message : error,
        });

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to load Ro-Link servers for the plugin.',
        }, { status: error instanceof StudioPluginError ? error.status : 500 });
    }
}
