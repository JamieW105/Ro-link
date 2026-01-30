import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch User's Guilds using their Access Token
        const userGuildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
            },
        });

        if (!userGuildsResponse.ok) {
            throw new Error("Failed to fetch user guilds");
        }

        const userGuilds = await userGuildsResponse.json();

        // 2. Filter for Admin/Owner only
        const adminGuilds = userGuilds.filter((g: any) => {
            const perms = BigInt(g.permissions);
            const ADMIN = 0x8n;
            return (perms & ADMIN) === ADMIN || g.owner;
        });

        // 3. Check which of these guilds the BOT is in
        // We can do this by trying to fetch the guild using the Bot Token
        // Or we can fetch the bot's guilds (lite) if not too many. 
        // For scalability, let's check individual membership or just fetch bot guilds if < 1000.
        // Optimization: Let's fetch the current user's (Bot's) guilds and intersect.
        // Note: If bot is in 1000+ guilds, this needs pagination. For now, valid for start.

        const botGuildsData = await rest.get(Routes.userGuilds()) as any[];
        const botGuildIds = new Set(botGuildsData.map(g => g.id));

        // 4. Merge Data
        const guildsWithStatus = adminGuilds.map((g: any) => ({
            ...g,
            hasBot: botGuildIds.has(g.id)
        }));

        return NextResponse.json(guildsWithStatus);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
