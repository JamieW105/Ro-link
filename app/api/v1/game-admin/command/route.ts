export { GET, POST } from '../../command/route';
import { NextResponse } from 'next/server';

import { ADMIN_PANEL_COMMAND_IDS, normalizeAdminPanelCommand } from '@/lib/adminPanelCommands';
import { buildDeliveryArgs, resolveDeliveryTargets, trimString, type CommandArgs } from '@/lib/commandDelivery';
import { getServerByApiKey } from '@/lib/gameAdmin';
import { logAction } from '@/lib/logger';
import { sendRobloxMessage } from '@/lib/roblox';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const server = await getServerByApiKey(apiKey);
    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const command = normalizeAdminPanelCommand(body?.command);
        const rawArgs = typeof body?.args === 'object' && body.args ? body.args : {};
        const args: CommandArgs = { ...rawArgs };

        if (!command || !ADMIN_PANEL_COMMAND_IDS.includes(command)) {
            return NextResponse.json({ error: 'Unknown command' }, { status: 400 });
        }

        const moderator = trimString(body?.moderator) || 'Ro-Link In-Game Panel';
        const moderatorRobloxUsername = trimString(body?.moderatorRobloxUsername);
        const baseArgs: CommandArgs = {
            ...args,
            moderator,
        };

        if (moderatorRobloxUsername) {
            baseArgs.moderator_roblox_username = moderatorRobloxUsername;
        }

        const deliveryTargets = await resolveDeliveryTargets(server.id, command, baseArgs, {
            preferredJobId: trimString(body?.sourceJobId || args.source_job_id),
        });

        if (deliveryTargets.length === 0) {
            return NextResponse.json({
                error: 'No live server currently has that target player.',
            }, { status: 404 });
        }

        const queueRows = deliveryTargets.map((target) => ({
            server_id: server.id,
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
                server.id,
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
            server.id,
            command,
            logTarget || 'server',
            moderator,
            trimString(args.reason || args.message || 'In-game panel action'),
        );

        return NextResponse.json({
            success: true,
            queued: true,
            realtime: realtimeSuccess,
            warning: realtimeWarnings.length > 0 ? realtimeWarnings.join(' | ') : null,
            deliveredTargets: deliveryTargets.length,
            targetJobId: deliveryTargets.length === 1 ? deliveryTargets[0].jobId : null,
        });
    } catch (error) {
        console.error('[Game Admin Command API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
