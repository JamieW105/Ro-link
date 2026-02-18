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

    const botToken = process.env.DISCORD_TOKEN;

    try {
        // Find a channel to create invite in
        const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { 'Authorization': `Bot ${botToken}` }
        });
        const channels = await channelsRes.json();

        const targetChannel = Array.isArray(channels) ? channels.find((c: any) => c.type === 0) : null;

        if (!targetChannel) {
            return NextResponse.json({ error: 'No text channel found to create invite' }, { status: 400 });
        }

        const inviteRes = await fetch(`https://discord.com/api/v10/channels/${targetChannel.id}/invites`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                max_age: 3600,
                max_uses: 1,
                unique: true
            })
        });

        const invite = await inviteRes.json();

        if (invite.code) {
            return NextResponse.json({ url: `https://discord.gg/${invite.code}` });
        } else {
            return NextResponse.json({ error: 'Failed to create invite' }, { status: inviteRes.status });
        }
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
