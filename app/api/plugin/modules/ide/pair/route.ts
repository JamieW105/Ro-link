import { NextResponse } from 'next/server';

import { requireAuthorizedStudioPluginSession, StudioPluginError } from '@/lib/studioPlugin';
import { claimModuleStudioPairing } from '@/lib/moduleStudioBridge';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const pluginSession = await requireAuthorizedStudioPluginSession(req);
        if (!pluginSession) return NextResponse.json({ error: 'Ro-Link account authorization is missing or expired.' }, { status: 401 });
        const body = await req.json().catch(() => null) as { code?: string; placeId?: string; universeId?: string; placeName?: string } | null;
        const code = String(body?.code || '').trim().toUpperCase();
        if (!/^[A-Z2-9]{8}$/.test(code)) return NextResponse.json({ error: 'Enter the eight-character pairing code shown in the Module IDE.' }, { status: 400 });
        const result = await claimModuleStudioPairing(pluginSession, {
            code,
            placeId: body?.placeId,
            universeId: body?.universeId,
            placeName: body?.placeName,
        });
        if (!result) return NextResponse.json({ error: 'Pairing code is invalid, expired, already used, or belongs to another account.' }, { status: 404 });
        return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to pair Studio.' }, { status: error instanceof StudioPluginError ? error.status : 500 });
    }
}
