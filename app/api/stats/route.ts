import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    try {
        const [discordResponse, commandCountResponse] = await Promise.all([
            fetch('https://discord.com/api/v10/applications/@me', {
                headers: {
                    Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
                },
                cache: 'no-store'
            }),
            getSupabaseAdmin().from('logs').select('*', { count: 'exact', head: true }),
        ]);

        if (!discordResponse.ok) {
            throw new Error(`Discord API Error: ${discordResponse.status}`);
        }

        const app = await discordResponse.json();
        const count = app.approximate_guild_count || 0;

        // Note: Returns the 'Install Count' which matches the Developer Portal
        // This includes cached/offline servers and may differ from active connections.

        return NextResponse.json({
            guild_count: count,
            command_count: commandCountResponse.count || 0,
        });
    } catch (error) {
        console.error('[STATS] Failed to fetch guild count:', error);
        return NextResponse.json({ guild_count: 0, command_count: 0, error: 'Failed to fetch' }, { status: 500 });
    }
}
