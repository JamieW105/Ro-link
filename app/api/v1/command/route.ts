
import { NextResponse } from 'next/server';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy, resolveDiscordIdFromRobloxId } from '@/lib/moderationRoleHierarchy';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';
import { logAction } from '@/lib/logger';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';

type ApiCommandServerRecord = {
    id: string;
    admin_cmds_enabled?: boolean | null;
    misc_cmds_enabled?: boolean | null;
    enforce_moderation_role_hierarchy?: boolean | null;
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    // Heartbeat check for uptime monitors
    if (searchParams.get('status') === 'check' || req.headers.get('user-agent')?.includes('Better Uptime')) {
        return NextResponse.json({
            status: 'API Active',
            message: 'Endpoint ready for command payloads (POST)'
        }, { status: 200 });
    }

    return NextResponse.json({
        status: 'API Active',
        message: 'Endpoint ready for command payloads (POST)'
    }, { status: 200 });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    // 1. Authenticate with API Key
    const auth = readServerApiKeyDetails(req, body.apiKey ?? body.key ?? body.serverKey ?? body.securityKey);
    const authDebug = describeServerApiKeyDetails(auth);

    if (!auth.key) {
        console.warn('[RoLinkAPI][Command] Missing API key', { auth: authDebug });
        return NextResponse.json({
            error: 'Missing API Key',
            code: 'missing_api_key',
            message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
            auth: authDebug,
        }, { status: 401 });
    }

    const lookup = await findServerByKeyWithDiagnostics<ApiCommandServerRecord>(
        'id, admin_cmds_enabled, misc_cmds_enabled, enforce_moderation_role_hierarchy',
        auth.key,
    );
    const server = lookup.server;

    if (!server) {
        console.warn('[RoLinkAPI][Command] Invalid API key', {
            auth: authDebug,
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

    // 2. Parse Body
    const { command, args, moderator, moderatorDiscordId, moderatorRobloxId } = body;

    if (!command) {
        return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const commandName = trimString(command).toUpperCase();
    const safeArgs = args || {};
    const modName = trimString(moderator) || 'API User';

    try {
        if (commandRequiresModerationHierarchy(commandName)) {
            const targetUsername = trimString(safeArgs.username);
            if (!targetUsername) {
                return NextResponse.json({ error: 'username is required for moderation commands.' }, { status: 400 });
            }

            let actingModeratorDiscordId = trimString(moderatorDiscordId);
            if (!actingModeratorDiscordId && trimString(moderatorRobloxId)) {
                actingModeratorDiscordId = await resolveDiscordIdFromRobloxId(trimString(moderatorRobloxId));
            }

            if (server.enforce_moderation_role_hierarchy !== false && !actingModeratorDiscordId) {
                return NextResponse.json({
                    error: 'moderatorDiscordId or moderatorRobloxId is required for moderation commands while role hierarchy protection is enabled.',
                }, { status: 400 });
            }

            if (actingModeratorDiscordId) {
                const hierarchyCheck = await evaluateModerationRoleHierarchy({
                    serverId: server.id,
                    moderatorDiscordId: actingModeratorDiscordId,
                    targetRobloxUsername: targetUsername,
                    enabled: server.enforce_moderation_role_hierarchy,
                });

                if (!hierarchyCheck.allowed) {
                    return NextResponse.json({ error: hierarchyCheck.message }, { status: 403 });
                }
            }
        }

        // 3. Queue Command
        const { error: queueError } = await supabase.from('command_queue').insert([{
            server_id: server.id,
            command: commandName,
            args: { ...safeArgs, moderator: modName },
            status: 'PENDING'
        }]);

        if (queueError) throw queueError;

        // 4. Trigger Instant Message (MessagingService)
        // This is "fire and forget" for speed, but ideally we await it if reliability > latency
        const msgResult = await sendRobloxMessage(server.id, commandName, { ...safeArgs, moderator: modName }, server);

        // 5. Log Action (via Unified Logger)
        const moderatorLogValue = trimString(moderatorDiscordId)
            ? `<@${trimString(moderatorDiscordId)}>`
            : modName;
        await logAction(server.id, commandName, trimString(safeArgs.username) || 'N/A', moderatorLogValue);

        return NextResponse.json({
            success: true,
            message: `Command ${commandName} queued.`,
            open_cloud_status: msgResult.success ? 'Sent' : 'Failed'
        });

    } catch (err: unknown) {
        console.error('API Error:', err);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
