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

    try {
        // Fetch channels to find a suitable one for invite
        const channels = await rest.get(Routes.guildChannels(params.id)) as any[];

        // Find a Text Channel (Type 0) to create invite
        // We prioritize "general" or "rules" if possible, but any text channel works.
        const channel = channels.find((c: any) => c.type === 0);

        if (!channel) {
            return NextResponse.json({ error: 'No suitable text channel found to create invite' }, { status: 404 });
        }

        const invite = await rest.post(Routes.channelInvites(channel.id), {
            body: {
                max_age: 300, // 5 minutes
                max_uses: 1,
                unique: true,
                temporary: true
            }
        }) as any;

        return NextResponse.json({ url: `https://discord.gg/${invite.code}` });
    } catch (error) {
        console.error('Error creating invite:', error);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }
}
