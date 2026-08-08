import { NextResponse } from 'next/server';

import { enqueueStudioBridgeEvents, getStudioBridgeSessionByCredential, pollStudioBridgeEvents, readBearerToken, touchStudioBridgeSession } from '@/lib/moduleStudioBridge';

export const dynamic = 'force-dynamic';

async function requireBridge(req: Request) {
    const token = readBearerToken(req);
    return token ? getStudioBridgeSessionByCredential(token) : null;
}
export async function GET(req: Request) {
    try {
        const session = await requireBridge(req);
        if (!session) return NextResponse.json({ error: 'Studio bridge credential is missing, expired, or revoked.' }, { status: 401 });
        const cursor = Number(new URL(req.url).searchParams.get('cursor') || 0);
        const result = await pollStudioBridgeEvents(session.id, 'to_studio', Number.isFinite(cursor) ? cursor : 0);
        await touchStudioBridgeSession(session.id);
        return NextResponse.json({ sessionId: session.id, ...result }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to poll browser events.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await requireBridge(req);
        if (!session) return NextResponse.json({ error: 'Studio bridge credential is missing, expired, or revoked.' }, { status: 401 });
        const body = await req.json().catch(() => null) as { events?: unknown[] } | null;
        const ids = await enqueueStudioBridgeEvents(session.id, 'to_browser', body?.events || []);
        await touchStudioBridgeSession(session.id);
        return NextResponse.json({ accepted: ids.length, ids }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send Studio events.' }, { status: 400 });
    }
}
