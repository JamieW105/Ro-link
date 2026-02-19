import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'MANAGE_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // 1. Fetch all guilds the bot is in (Discord API)
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
        let botGuilds: any[] = [];
        let after = '0';

        while (true) {
            const data: any = await rest.get(Routes.userGuilds(), {
                query: new URLSearchParams({ after, limit: '100' })
            });
            if (!Array.isArray(data) || data.length === 0) break;
            botGuilds = [...botGuilds, ...data];
            after = data[data.length - 1].id;
            if (data.length < 100) break;
        }

        // 2. Fetch servers from our database
        const { data: dbServers, error: dbError } = await supabase
            .from('servers')
            .select('*');

        if (dbError) throw dbError;

        // 3. Merge data
        const dbMap = new Map(dbServers?.map(s => [s.id, s]));

        const merged = botGuilds.map(guild => {
            const dbServer = dbMap.get(guild.id);
            return {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                created_at: dbServer?.created_at || new Date().toISOString(),
                is_setup: !!dbServer
            };
        });

        // Add any servers in DB that the bot is NO LONGER in
        const botGuildIds = new Set(botGuilds.map(g => g.id));
        dbServers?.forEach(s => {
            if (!botGuildIds.has(s.id)) {
                merged.push({
                    id: s.id,
                    name: "Unknown (Bot Left)",
                    icon: null,
                    created_at: s.created_at,
                    is_setup: true,
                    bot_present: false
                } as any);
            }
        });

        return NextResponse.json(merged);
    } catch (error: any) {
        console.error("[Management/Servers] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
