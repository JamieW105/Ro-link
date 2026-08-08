import { NextResponse } from 'next/server';

import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { createModuleStudioPairing, getActiveBrowserStudioSession } from '@/lib/moduleStudioBridge';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ moduleId: string }> };

export async function GET(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const { moduleId } = await context.params;
    try {
        return noStoreJson({ session: await getActiveBrowserStudioSession(moduleId, auth.discordUserId) });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to inspect Studio connection.' }, { status: 500 });
    }
}
export async function POST(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const { moduleId } = await context.params;
    try {
        const pairing = await createModuleStudioPairing(moduleId, auth.discordUserId);
        if (!pairing) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        return noStoreJson(pairing, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create Studio pairing.' }, { status: 500 });
    }
}
