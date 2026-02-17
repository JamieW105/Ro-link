import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);

    // Check if user is Cherubdude (ID: 953414442060746854)
    if (!session || (session.user as any).id !== '953414442060746854') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason } = await req.json();
    if (!reason) {
        return NextResponse.json({ error: 'Reason for removal is required' }, { status: 400 });
    }

    try {
        // Fetch guild to get owner ID
        const guild = await rest.get(Routes.guild(params.id)) as any;

        if (!guild) {
            return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
        }

        const ownerId = guild.owner_id;

        // Attempt to DM the owner
        try {
            // Create DM Channel
            const dmChannel = await rest.post(Routes.userChannels(), {
                body: { recipient_id: ownerId }
            }) as any;

            // Send Message
            await rest.post(Routes.channelMessages(dmChannel.id), {
                body: {
                    content: `**Notice:** The Ro-Link bot has been removed from your server **${guild.name}** by a system administrator.\n\n**Reason:** ${reason}\n\nIf you believe this was a mistake, please contact support.`
                }
            });
        } catch (dmError) {
            console.error('Failed to DM owner, but proceeding with removal:', dmError);
        }

        // Leave the guild (as the bot)
        await rest.delete(Routes.userGuild(params.id));

        return NextResponse.json({ success: true, message: `Bot removed and owner notified (if possible).` });
    } catch (error) {
        console.error('Error removing bot from guild:', error);
        return NextResponse.json({ error: 'Failed to remove bot from guild' }, { status: 500 });
    }
}
