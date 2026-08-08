import { NextResponse } from 'next/server';

import { getServerByApiKey, isDgsuGameAdminAccessError } from '@/lib/gameAdmin';
import { DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from '@/lib/dgsuBanConstants';
import { logAction } from '@/lib/logger';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const auth = readServerApiKeyDetails(req, body.apiKey ?? body.key ?? body.serverKey ?? body.securityKey);
    const authDebug = describeServerApiKeyDetails(auth);
    if (!auth.key) {
        console.warn('[RoLinkAPI][GameAdminLog] Missing API key', { auth: authDebug });
        return NextResponse.json({
            error: 'Missing API Key',
            code: 'missing_api_key',
            message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
            auth: authDebug,
        }, { status: 401 });
    }

    let server;
    try {
        server = await getServerByApiKey(auth.key);
    } catch (error) {
        if (isDgsuGameAdminAccessError(error)) {
            return NextResponse.json({ error: DGSU_BAN_ERROR_MESSAGE, code: 'dgsu_ban', message: DGSU_BAN_ERROR_MESSAGE }, { status: DGSU_BAN_ERROR_STATUS });
        }
        throw error;
    }

    if (!server) {
        console.warn('[RoLinkAPI][GameAdminLog] Invalid API key', { auth: authDebug });
        return NextResponse.json({
            error: 'Invalid API Key',
            code: 'invalid_api_key',
            message: 'The provided server key did not match any server record.',
            auth: authDebug,
        }, { status: 403 });
    }

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
