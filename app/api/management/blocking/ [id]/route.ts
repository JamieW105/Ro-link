import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: guildId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'BLOCK_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Get info before deleting to DM the owner
    const { data: blockedData } = await supabase
        .from('blocked_servers')
        .select('*')
        .eq('guild_id', guildId)
        .single();

    // 2. Delete from blocked_servers
    const { error } = await supabase
        .from('blocked_servers')
        .delete()
        .eq('guild_id', guildId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 3. DM the owner about the unblock
    const botToken = process.env.DISCORD_TOKEN;
    if (blockedData?.owner_id && botToken) {
        try {
            const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_id: blockedData.owner_id })
            });
            const dmChannel = await dmChannelRes.json();

            if (dmChannel.id) {
                await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: 'Server Unblocked',
                            description: `Your server **${blockedData.guild_name || guildId}** has been unblocked from Ro-Link.`,
                            color: 0x10b981,
                            fields: [
                                { name: 'Status', value: 'You can now re-invite the bot to your server.' },
                                { name: 'Invite Link', value: '[Click here to invite Ro-Link](https://rolink.cloud/invite)' }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                    })
                });
            }
        } catch (dmErr) {
            console.error("Failed to DM owner on unblock:", dmErr);
        }
    }

    return NextResponse.json({ success: true });
}
