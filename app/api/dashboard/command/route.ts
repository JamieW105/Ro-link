import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
    ADMIN_PANEL_COMMAND_IDS,
    canUseDashboardCommand,
    normalizeAdminPanelCommand,
} from '@/lib/adminPanelCommands';
import { buildDeliveryArgs, resolveDeliveryTargets, trimString, type CommandArgs } from '@/lib/commandDelivery';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { logAction } from '@/lib/logger';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy } from '@/lib/moderationRoleHierarchy';
import { sendRobloxMessage } from '@/lib/roblox';
import { supabase } from '@/lib/supabase';

type ServerModerationSettingsRecord = {
    enforce_moderation_role_hierarchy?: boolean | null;
};

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const serverId = trimString(body?.serverId);
        const command = normalizeAdminPanelCommand(body?.command);
        const rawArgs = typeof body?.args === 'object' && body?.args ? body.args : {};
        const args: CommandArgs = { ...rawArgs };

        if (!serverId || !command) {
            return NextResponse.json({ error: 'Missing serverId or command' }, { status: 400 });
        }
        if (!ADMIN_PANEL_COMMAND_IDS.includes(command)) {
            return NextResponse.json({ error: 'Unknown command' }, { status: 400 });
        }

        const discordUserId = trimString((session.user as { id?: string }).id);
        const permissions = await resolveDashboardUserPermissions(serverId, discordUserId);
        if (!permissions.is_admin && !permissions.can_access_dashboard && !permissions.can_access_live_panel) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!canUseDashboardCommand(permissions, command)) {
            return NextResponse.json({ error: 'You do not have permission to use that Roblox admin command.' }, { status: 403 });
        }

        const [{ data: serverSettings, error: serverSettingsError }, { data: verifiedUser }] = await Promise.all([
            supabase
                .from('servers')
                .select('enforce_moderation_role_hierarchy')
                .eq('id', serverId)
                .maybeSingle<ServerModerationSettingsRecord>(),
            supabase
                .from('verified_users')
                .select('roblox_username')
                .eq('discord_id', discordUserId)
                .maybeSingle<{ roblox_username?: string | null }>(),
        ]);

        if (serverSettingsError) {
            return NextResponse.json({ error: serverSettingsError.message }, { status: 500 });
        }

        if (commandRequiresModerationHierarchy(command)) {
            const hierarchyCheck = await evaluateModerationRoleHierarchy({
                serverId,
                moderatorDiscordId: discordUserId,
                targetRobloxUsername: trimString(args.username),
                enabled: serverSettings?.enforce_moderation_role_hierarchy,
            });

            if (!hierarchyCheck.allowed) {
                return NextResponse.json({ error: hierarchyCheck.message }, { status: 403 });
            }
        }

        const moderatorRobloxUsername = trimString(verifiedUser?.roblox_username);
        if (command === 'TELEPORT_TO_ME' && !moderatorRobloxUsername) {
            return NextResponse.json({
                error: 'Link your Discord account to Roblox before using Teleport To Me from the dashboard.',
            }, { status: 400 });
        }

        const moderator = trimString(session.user?.name) || 'Web Admin';
        const baseArgs: CommandArgs = {
            ...args,
            moderator,
        };

        if (moderatorRobloxUsername) {
            baseArgs.moderator_roblox_username = moderatorRobloxUsername;
        }

        const deliveryTargets = await resolveDeliveryTargets(serverId, command, baseArgs);
        if (deliveryTargets.length === 0) {
            return NextResponse.json({ error: 'No live servers are available for that command target.' }, { status: 400 });
        }

        const queueRows = deliveryTargets.map((target) => ({
            server_id: serverId,
            command,
            args: buildDeliveryArgs(baseArgs, target),
            status: 'PENDING',
        }));

        const { error: queueError } = await supabase
            .from('command_queue')
            .insert(queueRows);

        if (queueError) {
            return NextResponse.json({ error: queueError.message }, { status: 500 });
        }

        const realtimeResults = await Promise.all(
            deliveryTargets.map((target) => sendRobloxMessage(
                serverId,
                command,
                buildDeliveryArgs(baseArgs, target),
            )),
        );

        const realtimeSuccess = realtimeResults.some((result) => result.success);
        const realtimeWarnings = realtimeResults
            .filter((result) => !result.success)
            .map((result) => trimString(result.error))
            .filter(Boolean);

        const logTarget = trimString(
            args.username
            || args.userIdentity
            || args.target_label
            || (deliveryTargets.length > 1 ? 'global' : deliveryTargets[0]?.jobId || 'server'),
        );

        await logAction(
            serverId,
            command,
            logTarget || 'server',
            discordUserId ? `<@${discordUserId}>` : moderator,
            trimString(args.reason || args.message || 'Dashboard action'),
        );

        return NextResponse.json({
            success: true,
            queued: true,
            realtime: realtimeSuccess,
            warning: realtimeWarnings.length > 0 ? realtimeWarnings.join(' | ') : null,
            deliveredTargets: deliveryTargets.length,
        });
    } catch (error) {
        console.error('[Dashboard Command API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
