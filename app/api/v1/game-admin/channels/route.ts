import { NextResponse } from 'next/server';

import { getServerByApiKey } from '@/lib/gameAdmin';
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

    const server = await getServerByApiKey(auth.key);
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

