
import { NextResponse } from 'next/server';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy, resolveDiscordIdFromRobloxId } from '@/lib/moderationRoleHierarchy';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';
import { logAction } from '@/lib/logger';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';
import { DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from '@/lib/dgsuBanConstants';
import { buildDeliveryArgs, resolveDeliveryTargets, type CommandArgs } from '@/lib/commandDelivery';

type ApiCommandServerRecord = {
    id: string;
    admin_cmds_enabled?: boolean | null;
    misc_cmds_enabled?: boolean | null;
    enforce_moderation_role_hierarchy?: boolean | null;
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

const COMMAND_ALIASES: Record<string, string> = {
    SOFT_BAN: 'SOFTBAN',
    SETCHAR: 'SET_CHAR',
    SET_CHARACTER: 'SET_CHAR',
    SET_TEAM: 'TEAM',
    SPECTATE: 'VIEW',
    NO_CLIP: 'NOCLIP',
    MAXHEALTH: 'MAX_HEALTH',
    WALKSPEED: 'WALK_SPEED',
    JUMPPOWER: 'JUMP_POWER',
    TELEPORTTOME: 'TELEPORT_TO_ME',
    BRINGTOSPAWN: 'BRING_TO_SPAWN',
    FORCEFIELDADD: 'FORCEFIELD_ADD',
    FORCEFIELDREMOVE: 'FORCEFIELD_REMOVE',
};

function normalizeCommandName(value: unknown) {
    const normalized = trimString(value).toUpperCase().replace(/[\s-]+/g, '_');
    return COMMAND_ALIASES[normalized] || normalized;
}

function normalizeRemoteArgs(rawArgs: unknown): CommandArgs {
    const args = rawArgs && typeof rawArgs === 'object' ? { ...(rawArgs as CommandArgs) } : {};
    const username = trimString(args.username || args.targetName || args.userIdentity || args.target_label || args.target);
    if (username) {
        // Keep every supported name in sync so both old and current game bridges execute it.
        args.username = username;
        args.targetName = username;
        args.userIdentity = username;
    }

    const characterUser = trimString(args.char_user || args.charUser || args.characterUser);
    if (characterUser) args.char_user = characterUser;

    const amount = args.amount ?? args.value;
    if (amount !== undefined && amount !== null && trimString(amount)) args.amount = amount;

    return args;
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
        if (lookup.error === 'dgsu_ban') {
            return NextResponse.json({
                error: DGSU_BAN_ERROR_MESSAGE,
                code: 'dgsu_ban',
                message: DGSU_BAN_ERROR_MESSAGE,
                auth: authDebug,
                lookup: {
                    matchedBy: lookup.matchedBy,
                    error: lookup.error,
                },
            }, { status: DGSU_BAN_ERROR_STATUS });
        }

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

    const commandName = normalizeCommandName(command);
    const safeArgs = normalizeRemoteArgs(args);
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

        const baseArgs: CommandArgs = { ...safeArgs, moderator: modName };
        const deliveryTargets = await resolveDeliveryTargets(server.id, commandName, baseArgs, {
            allowGlobal: true,
        });
        if (deliveryTargets.length === 0) {
            return NextResponse.json({
                error: 'No live server currently has that target player.',
            }, { status: 404 });
        }

        // 3. Queue one targeted delivery per live destination.
        const { error: queueError } = await supabase.from('command_queue').insert(
            deliveryTargets.map((target) => ({
                server_id: server.id,
                command: commandName,
                args: buildDeliveryArgs(baseArgs, target),
                status: 'PENDING',
            })),
        );

        if (queueError) throw queueError;

        // 4. Trigger Instant Message (MessagingService)
        // This is "fire and forget" for speed, but ideally we await it if reliability > latency
        const messageResults = await Promise.all(
            deliveryTargets.map((target) => sendRobloxMessage(
                server.id,
                commandName,
                buildDeliveryArgs(baseArgs, target),
                server,
            )),
        );
        const messageSent = messageResults.some((result) => result.success);

        // 5. Log Action (via Unified Logger)
        const moderatorLogValue = trimString(moderatorDiscordId)
            ? `<@${trimString(moderatorDiscordId)}>`
            : modName;
        await logAction(server.id, commandName, trimString(safeArgs.username) || 'N/A', moderatorLogValue);

        return NextResponse.json({
            success: true,
            message: `Command ${commandName} queued.`,
            open_cloud_status: messageSent ? 'Sent' : 'Failed',
            deliveredTargets: deliveryTargets.length,
        });

    } catch (err: unknown) {
        console.error('API Error:', err);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
