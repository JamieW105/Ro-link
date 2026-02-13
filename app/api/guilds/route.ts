import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        // Return active status if specifically pinged, otherwise unauthorized
        const { searchParams } = new URL(req.url);
        if (searchParams.get('status') === 'check') {
            return NextResponse.json({ status: 'API Active', message: 'Guilds endpoint operational' }, { status: 200 });
        }
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

        // 2. Fetch all guilds the bot is in
        const botGuildsData = await rest.get(Routes.userGuilds()) as any[];
        const botGuildIds = new Set(botGuildsData.map(g => g.id));

        // 3. Special permission for 'cherubdude' (ID: 953414442060746854)
        const isSuperUser = (session.user as any).id === '953414442060746854';

        // Filter for Admin/Owner only for normal users (and superuser managing their own)
        const adminGuilds = userGuilds.filter((g: any) => {
            const perms = BigInt(g.permissions);
            const MANAGE_GUILD = 0x20n;
            const ADMIN = 0x8n;
            return (perms & ADMIN) === ADMIN || (perms & MANAGE_GUILD) === MANAGE_GUILD || g.owner;
        });

        const adminGuildIds = new Set(adminGuilds.map((g: any) => g.id));

        let visibleGuilds;
        if (isSuperUser) {
            // Cherubdude sees ALL guilds the bot is in + guilds they can manage
            const botOnlyGuilds = botGuildsData
                .filter((g: any) => !adminGuildIds.has(g.id))
                .map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    icon: g.icon,
                    permissions: "0", // Read-only for these
                    owner: false,
                    hasBot: true
                }));

            const cherubManagedGuilds = adminGuilds.map((g: any) => ({
                ...g,
                hasBot: botGuildIds.has(g.id)
            }));

            visibleGuilds = [...cherubManagedGuilds, ...botOnlyGuilds];
        } else {
            // Merge Data for normal users
            visibleGuilds = adminGuilds.map((g: any) => ({
                ...g,
                hasBot: botGuildIds.has(g.id)
            }));
        }

        return NextResponse.json(visibleGuilds);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
