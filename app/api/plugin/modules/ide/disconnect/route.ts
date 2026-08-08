import { NextResponse } from 'next/server';

import { getStudioBridgeSessionByCredential, readBearerToken, revokeStudioBridgeSession } from '@/lib/moduleStudioBridge';

export async function POST(req: Request) {
    const token = readBearerToken(req);
    const session = token ? await getStudioBridgeSessionByCredential(token) : null;
    if (!session) return NextResponse.json({ success: true });
    await revokeStudioBridgeSession(session.id);
    return NextResponse.json({ success: true });
}
