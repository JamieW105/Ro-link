import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ADMIN_PANEL_COMMAND_IDS, hasAdminPanelCommandAccess, normalizeAdminPanelCommand } from '@/lib/adminPanelCommands';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { logAction } from '@/lib/logger';
import { sendRobloxMessage } from '@/lib/roblox';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const serverId = String(body?.serverId || '').trim();
        const command = normalizeAdminPanelCommand(body?.command);
        const args = typeof body?.args === 'object' && body?.args ? body.args : {};

        if (!serverId || !command) {
            return NextResponse.json({ error: 'Missing serverId or command' }, { status: 400 });
        }
        if (!ADMIN_PANEL_COMMAND_IDS.includes(command)) {
            return NextResponse.json({ error: 'Unknown command' }, { status: 400 });
        }

        const discordUserId = String((session.user as { id?: string }).id || '');
        const permissions = await resolveDashboardUserPermissions(serverId, discordUserId);
        if (!permissions.is_admin && !permissions.can_access_dashboard) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!permissions.is_admin && !hasAdminPanelCommandAccess(permissions.allowed_misc_cmds, command)) {
            return NextResponse.json({ error: 'You do not have permission to use that Roblox admin command.' }, { status: 403 });
        }

        const moderator = String(session.user?.name || 'Web Admin');
        const queuedArgs = {
            ...args,
            moderator,
        };

        const { error: queueError } = await supabase
            .from('command_queue')
            .insert([{
                server_id: serverId,
                command,
                args: queuedArgs,
                status: 'PENDING',
            }]);

        if (queueError) {
            return NextResponse.json({ error: queueError.message }, { status: 500 });
        }

        const messageResult = await sendRobloxMessage(serverId, command, queuedArgs);
        await logAction(
            serverId,
            command,
            String(args.username || args.userIdentity || 'server'),
            moderator,
            String(args.reason || 'Dashboard action'),
        );

        if (!messageResult.success) {
            return NextResponse.json({
                success: true,
                queued: true,
                realtime: false,
                warning: messageResult.error,
            });
        }

        return NextResponse.json({
            success: true,
            queued: true,
            realtime: true,
        });
    } catch (error) {
        console.error('[Dashboard Command API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
