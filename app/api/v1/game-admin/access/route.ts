import { NextResponse } from 'next/server';

import { resolveRoLinkAdminAccess } from '@/lib/gameAdmin';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy } from '@/lib/moderationRoleHierarchy';
import { readServerApiKey } from '@/lib/serverApiKey';

export async function GET(req: Request) {
    const apiKey = readServerApiKey(req);
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const robloxId = searchParams.get('robloxId');
    const targetUsername = String(searchParams.get('targetUsername') || '').trim();
    const command = String(searchParams.get('command') || '').trim();

    if (!robloxId) {
        return NextResponse.json({ error: 'robloxId is required' }, { status: 400 });
    }

    const access = await resolveRoLinkAdminAccess(apiKey, robloxId);
    if (!access) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    if (
        targetUsername
        && commandRequiresModerationHierarchy(command)
        && access.user?.discordId
    ) {
        const moderationTarget = await evaluateModerationRoleHierarchy({
            serverId: access.serverId,
            moderatorDiscordId: access.user.discordId,
            targetRobloxUsername: targetUsername,
            enabled: access.settings.enforceModerationRoleHierarchy,
        });

        return NextResponse.json({
            ...access,
            moderationTarget: {
                checked: true,
                command: command.toUpperCase(),
                targetUsername,
                allowed: moderationTarget.allowed,
                reason: moderationTarget.allowed ? null : moderationTarget.message || null,
                hierarchyEnabled: access.settings.enforceModerationRoleHierarchy,
            },
        });
    }

    return NextResponse.json(access);
}
