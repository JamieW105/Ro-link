import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
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

    const userId = (session.user as any).id;
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

        // 2. Add to blocked_servers
        const { data, error } = await supabase
            .from('blocked_servers')
            .insert({
                guild_id: guildId,
                guild_name: guildName,
                owner_id: ownerId,
                reason: reason,
                blocked_by: userId
            })
            .select()
            .single();

        if (error) throw error;

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
                                    { name: 'Reason', value: reason || 'Violation of terms.' },
                                    { name: 'Action', value: 'The bot has left your server and all data has been wiped.' }
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
