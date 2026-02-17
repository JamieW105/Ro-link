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
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: {
                Authorization: `Bot ${botToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error: error.message || 'Failed to fetch roles' }, { status: response.status });
        }

        const roles = await response.json();

        // Filter out @everyone if desired, or keep it. Usually useful to keep.
        // Discord returns roles sorted by position roughly, but we might want to sort by position desc.
        roles.sort((a: any, b: any) => b.position - a.position);

        return NextResponse.json(roles.map((r: any) => ({
            id: r.id,
            name: r.name,
            color: r.color,
            position: r.position
        })));
    } catch (err: any) {
        console.error("Discord API Error:", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
