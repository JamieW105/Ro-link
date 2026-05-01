
import { NextResponse } from 'next/server';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy, resolveDiscordIdFromRobloxId } from '@/lib/moderationRoleHierarchy';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';
import { logAction } from '@/lib/logger';
import { readServerApiKey } from '@/lib/serverApiKey';
import { findServerByKey } from '@/lib/serverAuth';

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
    // 1. Authenticate with API Key
    const apiKey = readServerApiKey(req);

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const server = await findServerByKey<ApiCommandServerRecord>(
        'id, admin_cmds_enabled, misc_cmds_enabled, enforce_moderation_role_hierarchy',
        apiKey,
    );

    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    // 2. Parse Body
    const body = await req.json().catch(() => ({}));
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
        await logAction(server.id, commandName, trimString(safeArgs.username) || 'N/A', modName);

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
