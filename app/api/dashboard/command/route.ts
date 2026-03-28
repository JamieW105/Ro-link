import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
    ADMIN_PANEL_COMMAND_IDS,
    GLOBAL_COMMAND_IDS,
    hasAdminPanelCommandAccess,
    normalizeAdminPanelCommand,
} from '@/lib/adminPanelCommands';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { logAction } from '@/lib/logger';
import { sendRobloxMessage } from '@/lib/roblox';
import { supabase } from '@/lib/supabase';

const GLOBAL_COMMAND_LOOKUP = new Set<string>(GLOBAL_COMMAND_IDS);
const LIVE_SERVER_FRESHNESS_MS = 2 * 60 * 1000;

type CommandArgs = Record<string, unknown>;
type DeliveryTarget = {
    deliveryId: string;
    jobId: string | null;
    scope: 'COMMAND' | 'SERVER' | 'GLOBAL';
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function buildDeliveryArgs(baseArgs: CommandArgs, target: DeliveryTarget) {
    const nextArgs: CommandArgs = { ...baseArgs };
    nextArgs.delivery_id = target.deliveryId;

    if (target.jobId) {
        nextArgs.job_id = target.jobId;
    } else {
        delete nextArgs.job_id;
    }

    if (target.scope !== 'COMMAND') {
        nextArgs.target_scope = target.scope;
    } else if (!trimString(nextArgs.target_scope)) {
        delete nextArgs.target_scope;
    }

    return nextArgs;
}

async function resolveDeliveryTargets(serverId: string, command: string, args: CommandArgs) {
    const requestedJobId = trimString(args.job_id);
    if (requestedJobId) {
        return [{
            deliveryId: crypto.randomUUID(),
            jobId: requestedJobId,
            scope: 'SERVER',
        }] satisfies DeliveryTarget[];
    }

    const requestedScope = trimString(args.target_scope).toUpperCase();
    if (requestedScope !== 'GLOBAL' || !GLOBAL_COMMAND_LOOKUP.has(command)) {
        return [{
            deliveryId: crypto.randomUUID(),
            jobId: null,
            scope: 'COMMAND',
        }] satisfies DeliveryTarget[];
    }

    const freshAfter = new Date(Date.now() - LIVE_SERVER_FRESHNESS_MS).toISOString();
    const { data: liveServers, error } = await supabase
        .from('live_servers')
        .select('id')
        .eq('server_id', serverId)
        .gte('updated_at', freshAfter);

    if (error) {
        throw new Error(error.message);
    }

    const jobIds = Array.from(new Set(
        (liveServers || [])
            .map((server) => trimString((server as { id?: string }).id))
            .filter(Boolean),
    ));

    return jobIds.map((jobId) => ({
        deliveryId: crypto.randomUUID(),
        jobId,
        scope: 'GLOBAL',
    })) satisfies DeliveryTarget[];
}

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
        if (!permissions.is_admin && !permissions.can_access_dashboard) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!permissions.is_admin && !hasAdminPanelCommandAccess(permissions.allowed_misc_cmds, command)) {
            return NextResponse.json({ error: 'You do not have permission to use that Roblox admin command.' }, { status: 403 });
        }

        const moderator = trimString(session.user?.name) || 'Web Admin';
        const baseArgs: CommandArgs = {
            ...args,
            moderator,
        };

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
            moderator,
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
