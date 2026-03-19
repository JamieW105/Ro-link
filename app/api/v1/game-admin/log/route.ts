import { NextResponse } from 'next/server';

import { getServerByApiKey } from '@/lib/gameAdmin';
import { logAction } from '@/lib/logger';

export async function POST(req: Request) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const server = await getServerByApiKey(apiKey);
    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim().toUpperCase();
    const target = String(body.target || '').trim();
    const moderator = String(body.moderator || '').trim() || 'Ro-Link In-Game Panel';
    const reason = String(body.reason || '').trim() || 'No reason provided';

    if (!action || !target) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await logAction(server.id, action, target, moderator, reason);

    return NextResponse.json({ success: true });
}
