import { NextResponse } from 'next/server';

import { getServerByApiKey } from '@/lib/gameAdmin';
import {
    assertDiscordGuildMember,
    assertSendableDiscordChannel,
    createDiscordDmChannel,
    getDiscordGuildOwnerId,
    normalizeModuleDiscordMessage,
    sendDiscordMessage,
} from '@/lib/moduleDiscord';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';

export const dynamic = 'force-dynamic';

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function readField(source: Record<string, unknown>, names: string[]) {
    for (const name of names) {
        if (source[name] !== undefined && source[name] !== null) {
            return source[name];
        }
    }
    return undefined;
}

function readUserIdCandidate(value: unknown) {
    if (typeof value === 'object' && value !== null) {
        return readField(value as Record<string, unknown>, [
            'discordId',
            'DiscordId',
            'discordID',
            'DiscordID',
            'discord_id',
            'userId',
            'UserId',
            'id',
            'ID',
        ]);
    }
    return value;
}

async function resolveMessageChannel(serverId: string, body: Record<string, unknown>) {
    const target = trimString(readField(body, ['target', 'Target'])).toLowerCase();
    const channelId = readField(body, ['channelId', 'ChannelId', 'channelID', 'ChannelID']);
    const user = readField(body, ['user', 'User', 'userId', 'UserId', 'discordUserId', 'DiscordUserId']);

    if (target === 'serverowner' || target === 'server_owner' || target === 'owner') {
        const ownerId = await getDiscordGuildOwnerId(serverId);
        if (!ownerId) {
            throw new Error('Unable to resolve this server owner.');
        }
        return {
            channelId: await createDiscordDmChannel(ownerId),
            target: 'serverowner',
            resolvedUserId: ownerId,
        };
    }

    if (target === 'user' || target === 'dm' || target === 'member') {
        const userId = await assertDiscordGuildMember(serverId, readUserIdCandidate(user));
        return {
            channelId: await createDiscordDmChannel(userId),
            target: 'user',
            resolvedUserId: userId,
        };
    }

    const channel = await assertSendableDiscordChannel(serverId, channelId);
    return {
        channelId: channel.id,
        target: 'channel',
        resolvedUserId: null,
    };
}

export async function POST(req: Request) {
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const auth = readServerApiKeyDetails(req, body.apiKey ?? body.key ?? body.serverKey ?? body.securityKey);
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
        const content = readField(body, ['content', 'Content', 'message', 'Message']);
        const payload = normalizeModuleDiscordMessage(content);
        const destination = await resolveMessageChannel(server.id, body);
        const message = await sendDiscordMessage(destination.channelId, payload);

        return NextResponse.json({
            success: true,
            serverId: server.id,
            target: destination.target,
            channelId: destination.channelId,
            resolvedUserId: destination.resolvedUserId,
            messageId: message?.id || null,
        });
    } catch (error) {
        const status = (error as Error & { status?: number }).status || 400;
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to send bot message.' },
            { status },
        );
    }
}
