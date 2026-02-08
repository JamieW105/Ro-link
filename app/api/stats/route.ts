import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    try {
        const response = await fetch('https://discord.com/api/v10/applications/@me', {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Discord API Error: ${response.status}`);
        }

        const app = await response.json();
        const count = app.approximate_guild_count || 0;

        // Note: Returns the 'Install Count' which matches the Developer Portal
        // This includes cached/offline servers and may differ from active connections.

        return NextResponse.json({ guild_count: count });
    } catch (error) {
        console.error('[STATS] Failed to fetch guild count:', error);
        return NextResponse.json({ guild_count: 0, error: 'Failed to fetch' }, { status: 500 });
    }
}
