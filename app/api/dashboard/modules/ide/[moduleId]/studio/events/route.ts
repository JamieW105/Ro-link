import { NextResponse } from 'next/server';

import { getOwnedModule } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { enqueueStudioBridgeEvents, getActiveBrowserStudioSession, pollStudioBridgeEvents } from '@/lib/moduleStudioBridge';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ moduleId: string }> };

export async function GET(req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const { moduleId } = await context.params;
    try {
        if (!await getOwnedModule(moduleId, auth.discordUserId)) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        const session = await getActiveBrowserStudioSession(moduleId, auth.discordUserId);
        if (!session) return noStoreJson({ connected: false, events: [], cursor: 0 });
        const cursor = Number(new URL(req.url).searchParams.get('cursor') || 0);
        const result = await pollStudioBridgeEvents(session.id, 'to_browser', Number.isFinite(cursor) ? cursor : 0);
        return noStoreJson({ connected: true, session, ...result });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to poll Studio events.' }, { status: 500 });
    }
}
export async function POST(req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const { moduleId } = await context.params;
    try {
        if (!await getOwnedModule(moduleId, auth.discordUserId)) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        const session = await getActiveBrowserStudioSession(moduleId, auth.discordUserId);
        if (!session) return NextResponse.json({ error: 'Studio is not connected.' }, { status: 409 });
        const body = await req.json().catch(() => null) as { events?: unknown[] } | null;
        const ids = await enqueueStudioBridgeEvents(session.id, 'to_studio', body?.events || []);
        return noStoreJson({ accepted: ids.length, ids });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to queue Studio events.' }, { status: 400 });
    }
}
