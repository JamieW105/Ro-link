import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    try {
        const response = await fetch('https://discord.com/api/v10/users/@me/guilds?limit=200', {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Discord API Error: ${response.status}`);
        }

        const guilds = await response.json();
        const count = Array.isArray(guilds) ? guilds.length : 0;

        // Note: Returns the count of servers the bot is currently in.
        // Pagination would be needed if the bot is in >200 servers.

        return NextResponse.json({ guild_count: count });
    } catch (error) {
        console.error('[STATS] Failed to fetch guild count:', error);
        return NextResponse.json({ guild_count: 0, error: 'Failed to fetch' }, { status: 500 });
    }
}
