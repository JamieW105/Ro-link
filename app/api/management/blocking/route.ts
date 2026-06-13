import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";
import { createStaffActionForumThread } from "@/lib/staffForumNotifications";
import {
    createStaffModerationAction,
    recordStaffModerationActionLog,
    updateStaffModerationActionForumThread,
} from "@/lib/staffModerationActions";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = String((session.user as { id?: string }).id ?? '');
    if (!(await hasPermission(userId, 'BLOCK_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('blocked_servers')
        .select('*')
        .order('blocked_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = String((session.user as { id?: string }).id ?? '');
    if (!(await hasPermission(userId, 'BLOCK_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { guildId, reason } = await req.json();
    const botToken = process.env.DISCORD_TOKEN;

    try {
        // 1. Get guild info from Discord before leaving
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: { 'Authorization': `Bot ${botToken}` }
        });
        const guildData = await guildRes.json();

        if (!guildData.id) {
            return NextResponse.json({ error: 'Failed to fetch guild info from Discord' }, { status: 400 });
        }

        const ownerId = guildData.owner_id;
        const guildName = guildData.name;

        const { data: existingBlock, error: existingBlockError } = await supabase
            .from('blocked_servers')
            .select('guild_id')
            .eq('guild_id', guildId)
            .maybeSingle();

        if (existingBlockError) throw existingBlockError;
        if (existingBlock) {
            return NextResponse.json({ error: 'Server is already blocked from Ro-Link.' }, { status: 409 });
        }

        const action = await createStaffModerationAction({
            actionType: 'blocked',
            guildId,
            guildName,
            ownerId,
            staffDiscordId: userId,
            reason,
        });

        // 2. Add to blocked_servers
        const { data, error } = await supabase
            .from('blocked_servers')
            .insert({
                guild_id: guildId,
                guild_name: guildName,
                owner_id: ownerId,
                reason: reason,
                blocked_by: userId,
                moderation_action_id: action.id
            })
            .select()
            .single();

        if (error) throw error;

        try {
            await recordStaffModerationActionLog({
                action,
                logAction: 'RO_LINK_BLOCKED',
                target: guildId,
            });
        } catch (logErr) {
            console.error("[Management/Blocking] Failed to record staff moderation log:", logErr);
        }

        try {
            const thread = await createStaffActionForumThread({
                actionType: 'blocked',
                actionId: action.id,
                guildId,
                guildName,
                ownerId,
                staffDiscordId: userId,
                reason,
            });
            await updateStaffModerationActionForumThread(action.id, thread.id).catch((updateErr) => {
                console.error("[Management/Blocking] Failed to store staff forum thread:", updateErr);
            });
        } catch (threadErr) {
            console.error("[Management/Blocking] Failed to create staff forum thread:", threadErr);
        }

        const actionReferenceId = action.id;

        // 3. DM the owner about the block
        if (ownerId && botToken) {
            try {
                const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient_id: ownerId })
                });
                const dmChannel = await dmChannelRes.json();

                if (dmChannel.id) {
                    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            embeds: [{
                                title: 'Server Blocked',
                                description: `Your server **${guildName}** has been blocked from using Ro-Link.`,
                                color: 0xff4444,
                                fields: [
                                    { name: 'Reference', value: `\`${actionReferenceId}\`` },
                                    { name: 'Reason', value: reason || 'Violation of terms.' },
                                    { name: 'Action', value: 'The bot has left your server and all data has been wiped.' },
                                    { name: 'Support Server', value: 'https://discord.gg/C3n4nAwYMw' }
                                ],
                                timestamp: new Date().toISOString()
                            }]
                        })
                    });
                }
            } catch (dmErr) {
                console.error("Failed to DM owner on block:", dmErr);
            }
        }

        // 4. Delete server data from 'servers' table
        await supabase.from('servers').delete().eq('id', guildId);

        // 5. Remove bot from guild
        await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bot ${botToken}` }
        });

        return NextResponse.json(data);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
