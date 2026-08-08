import { NextResponse } from 'next/server';

import { getServerByApiKey, isDgsuGameAdminAccessError } from '@/lib/gameAdmin';
import { DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from '@/lib/dgsuBanConstants';
import { listSendableDiscordChannels } from '@/lib/moduleDiscord';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const auth = readServerApiKeyDetails(req);
    if (!auth.key) {
        return NextResponse.json(
            {
                error: 'Missing API Key',
                message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
                received: describeServerApiKeyDetails(auth),
            },
            { status: 401 },
        );
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
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    try {
        const channels = await listSendableDiscordChannels(server.id);
        return NextResponse.json(
            {
                serverId: server.id,
                channels,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            },
        );
    } catch (error) {
        const status = (error as Error & { status?: number }).status || 500;
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch server channels.' },
            { status },
        );
    }
}

