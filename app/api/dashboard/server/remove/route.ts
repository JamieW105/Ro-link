import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { deleteServerData } from '@/lib/serverDataRemoval';

type RemovalRequest = {
    serverId?: unknown;
    removeBot?: unknown;
    deleteData?: unknown;
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

async function removeBotFromGuild(serverId: string) {
    const botToken = trimString(process.env.DISCORD_TOKEN);
    if (!botToken) {
        throw new Error('Missing DISCORD_TOKEN.');
    }

    const response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${encodeURIComponent(serverId)}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bot ${botToken}`,
        },
    });

    if (!response.ok && response.status !== 404) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Discord returned ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json() as RemovalRequest;
        const serverId = trimString(body.serverId);
        const removeBot = Boolean(body.removeBot);
        const deleteData = Boolean(body.deleteData);

        if (!serverId) {
            return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
        }

        if (!removeBot && !deleteData) {
            return NextResponse.json({ error: 'Select at least one removal option.' }, { status: 400 });
        }

        const userId = trimString((session.user as { id?: string }).id);
        const permissions = await resolveDashboardUserPermissions(serverId, userId);

        if (!permissions.is_admin && !permissions.can_manage_settings) {
            return NextResponse.json({ error: 'You do not have permission to remove this server.' }, { status: 403 });
        }

        const completedActions: string[] = [];
        const failedActions: string[] = [];
        const errorMessages: string[] = [];

        if (deleteData) {
            try {
                await deleteServerData(serverId);
                completedActions.push('deleted Ro-Link data');
            } catch (error) {
                failedActions.push('delete Ro-Link data');
                errorMessages.push(error instanceof Error ? error.message : 'Failed to delete Ro-Link data.');
            }
        }

        if (removeBot) {
            try {
                await removeBotFromGuild(serverId);
                completedActions.push('removed the bot');
            } catch (error) {
                failedActions.push('remove the bot');
                errorMessages.push(error instanceof Error ? error.message : 'Failed to remove the bot.');
            }
        }

        if (completedActions.length === 0) {
            return NextResponse.json({
                error: errorMessages[0] || 'No removal actions completed.',
            }, { status: 500 });
        }

        const warning = failedActions.length > 0
            ? `Completed ${completedActions.join(' and ')}, but failed to ${failedActions.join(' and ')}.`
            : null;

        return NextResponse.json({
            success: true,
            completedActions,
            warning,
            errors: errorMessages,
        });
    } catch (error) {
        console.error('[Dashboard Server Remove API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
