import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const guildId = searchParams.get('guildId');

    if (!guildId) {
        return NextResponse.json({ error: 'Guild ID required' }, { status: 400 });
    }

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: {
                Authorization: `Bot ${botToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error: error.message || 'Failed to fetch channels' }, { status: response.status });
        }

        const channels = await response.json();

        // Filter for Text Channels (type 0) and potentially Announcement Channels (type 5)
        const textChannels = channels.filter((c: any) => c.type === 0 || c.type === 5); // 0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT

        textChannels.sort((a: any, b: any) => a.position - b.position);

        return NextResponse.json(textChannels.map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            position: c.position
        })));
    } catch (err: any) {
        console.error("Discord API Error:", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
