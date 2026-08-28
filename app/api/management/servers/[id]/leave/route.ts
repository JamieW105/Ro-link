import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { deleteServerData } from '@/lib/serverDataRemoval';
import { createStaffActionForumThread } from "@/lib/staffForumNotifications";
import {
    createStaffModerationAction,
    recordStaffModerationActionLog,
    updateStaffModerationActionForumThread,
} from "@/lib/staffModerationActions";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: guildId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = String((session.user as { id?: string }).id ?? '');
    if (!(await hasPermission(userId, 'MANAGE_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { reason } = await req.json();

    try {
        const botToken = process.env.DISCORD_TOKEN;

        let guildName = `Server ${guildId}`;
        let ownerId: string | null = null;

        try {
            const guildRes = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}`, {
                headers: { 'Authorization': `Bot ${botToken}` }
            });

            if (guildRes.ok) {
                const guildData = await guildRes.json() as { name?: string; owner_id?: string };
                guildName = guildData.name || guildName;
                ownerId = guildData.owner_id || null;
            } else if (guildRes.status !== 404) {
                console.warn(`[Management/Servers] Failed to fetch guild ${guildId}: ${guildRes.status}`);
            }
        } catch (guildErr) {
            console.error('[Management/Servers] Failed to fetch guild details:', guildErr);
        }

        let actionReferenceId: string | null = null;

        try {
            const action = await createStaffModerationAction({
                actionType: 'removed',
                guildId,
                guildName,
                ownerId,
                staffDiscordId: userId,
                reason,
            });
            actionReferenceId = action.id;

            try {
                await recordStaffModerationActionLog({
                    action,
                    logAction: 'RO_LINK_REMOVED',
                    target: guildId,
                });
            } catch (logErr) {
                console.error("[Management/Servers] Failed to record staff moderation log:", logErr);
            }

            try {
                const thread = await createStaffActionForumThread({
                    actionType: 'removed',
                    actionId: action.id,
                    guildId,
                    guildName,
                    ownerId,
                    staffDiscordId: userId,
                    reason,
                });
                await updateStaffModerationActionForumThread(action.id, thread.id).catch((updateErr) => {
                    console.error("[Management/Servers] Failed to store staff forum thread:", updateErr);
                });
            } catch (threadErr) {
                console.error("[Management/Servers] Failed to create staff forum thread:", threadErr);
            }
        } catch (actionErr) {
            console.error('[Management/Servers] Failed to create staff moderation action:', actionErr);
        }

        if (ownerId) {
            try {
                const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipient_id: ownerId })
                });
                const dmChannel = await dmChannelRes.json() as { id?: string };

                if (dmChannel.id) {
                    const fields = [
                        ...(actionReferenceId ? [{ name: 'Reference', value: `\`${actionReferenceId}\`` }] : []),
                        { name: 'Reason', value: reason || 'No reason provided.' },
                        { name: 'Support', value: 'If you believe this was an error, please contact support: https://discord.gg/C3n4nAwYMw' }
                    ];

                    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${botToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            embeds: [{
                                title: 'Ro-Link Removed',
                                description: `Ro-Link has been removed from your server **${guildName}** by management.`,
                                color: 0xff4444,
                                fields,
                                timestamp: new Date().toISOString()
                            }]
                        })
                    });
                }
            } catch (dmErr) {
                console.error('[Management/Servers] Failed to notify guild owner:', dmErr);
            }
        }

        const leaveRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${encodeURIComponent(guildId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bot ${botToken}` }
        });

        if (!leaveRes.ok && leaveRes.status !== 404) {
            return NextResponse.json({ error: 'Failed to leave guild' }, { status: leaveRes.status });
        }

        await deleteServerData(guildId);

        return NextResponse.json({
            success: true,
            botAlreadyAbsent: leaveRes.status === 404,
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
