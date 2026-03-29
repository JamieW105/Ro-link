import { NextResponse } from 'next/server';

import { installStudioPluginServer, requireAuthorizedStudioPluginSession } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const session = await requireAuthorizedStudioPluginSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Studio plugin authorization is missing or expired.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as {
        serverId?: string;
        placeId?: string;
        universeId?: string;
        openCloudKey?: string;
    } | null;

    const serverId = body?.serverId?.trim();
    const placeId = body?.placeId?.trim();
    const universeId = body?.universeId?.trim();
    const openCloudKey = body?.openCloudKey?.trim();

    if (!serverId || !placeId || !universeId) {
        return NextResponse.json({
            error: 'serverId, placeId, and universeId are required.',
        }, { status: 400 });
    }

    try {
        const result = await installStudioPluginServer(req, session, {
            serverId,
            placeId,
            universeId,
            openCloudKey,
        });

        if (!result.ok) {
            return NextResponse.json(result, { status: result.status });
        }

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to store Ro-Link setup for the plugin.',
        }, { status: 500 });
    }
}
