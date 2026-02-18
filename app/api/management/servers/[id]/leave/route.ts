import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: guildId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'MANAGE_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { reason } = await req.json();

    try {
        const botToken = process.env.DISCORD_BOT_TOKEN;

        // 1. Get guild owner to DM them
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: { 'Authorization': `Bot ${botToken}` }
        });
        const guildData = await guildRes.json();
        const ownerId = guildData.owner_id;

        if (ownerId) {
            // Create DM channel
            const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ recipient_id: ownerId })
            });
            const dmChannel = await dmChannelRes.json();

            if (dmChannel.id) {
                // Send DM
                await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        embeds: [{
                            title: 'Ro-Link Removed',
                            description: `Ro-Link has been removed from your server **${guildData.name}** by management.`,
                            color: 0xff4444,
                            fields: [
                                { name: 'Reason', value: reason || 'No reason provided.' },
                                { name: 'Support', value: 'If you believe this was an error, please contact support.' }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                    })
                });
            }
        }

        // 2. Leave guild
        const leaveRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bot ${botToken}` }
        });

        if (leaveRes.ok || leaveRes.status === 404) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Failed to leave guild' }, { status: leaveRes.status });
        }
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
