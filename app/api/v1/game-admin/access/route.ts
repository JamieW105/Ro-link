import { NextResponse } from 'next/server';

import { resolveRoLinkAdminAccess } from '@/lib/gameAdmin';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy } from '@/lib/moderationRoleHierarchy';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';

export async function GET(req: Request) {
    const auth = readServerApiKeyDetails(req);
    const authDebug = describeServerApiKeyDetails(auth);
    if (!auth.key) {
        console.warn('[RoLinkAPI][GameAdminAccess] Missing API key', { auth: authDebug });
        return NextResponse.json({
            error: 'Missing API Key',
            code: 'missing_api_key',
            message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
            auth: authDebug,
        }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const robloxId = searchParams.get('robloxId');
    const targetUsername = String(searchParams.get('targetUsername') || '').trim();
    const command = String(searchParams.get('command') || '').trim();

    if (!robloxId) {
        return NextResponse.json({ error: 'robloxId is required' }, { status: 400 });
    }

    const lookup = await findServerByKeyWithDiagnostics<{ id: string }>('id', auth.key);
    if (!lookup.server) {
        console.warn('[RoLinkAPI][GameAdminAccess] Invalid API key', {
            auth: authDebug,
            robloxId,
            lookupError: lookup.error,
        });
        return NextResponse.json({
            error: 'Invalid API Key',
            code: 'invalid_api_key',
            message: 'The provided server key did not match any server record.',
            auth: authDebug,
            lookup: {
                matchedBy: lookup.matchedBy,
                error: lookup.error,
            },
        }, { status: 403 });
    }

    const access = await resolveRoLinkAdminAccess(auth.key, robloxId);
    if (!access) {
        console.warn('[RoLinkAPI][GameAdminAccess] Invalid API key', {
            auth: authDebug,
            robloxId,
        });
        return NextResponse.json({
            error: 'Invalid API Key',
            code: 'invalid_api_key',
            message: 'The provided server key did not match any server record.',
            auth: authDebug,
        }, { status: 403 });
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
