import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    // Heartbeat check for uptime monitors (Allow check without authentication)
    // We check for ?status=check OR the Better Uptime user agent
    if (searchParams.get('status') === 'check' || req.headers.get('user-agent')?.includes('Better Uptime')) {
        return NextResponse.json({ status: 'API Active', message: 'Guilds endpoint operational' }, { status: 200 });
    }

    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch User's Guilds using their Access Token (Paginated)
        let userGuilds: any[] = [];
        let after = '0';
        while (true) {
            const res = await fetch(`https://discord.com/api/users/@me/guilds?after=${after}&limit=100`, {
                headers: { Authorization: `Bearer ${session.accessToken}` },
                cache: 'no-store'
            });
            if (!res.ok) break;
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) break;
            userGuilds = [...userGuilds, ...data];
            after = data[data.length - 1].id;
            if (data.length < 100) break;
        }

        if (userGuilds.length === 0 && after === '0') {
            // If we failed to fetch even the first page, throw error
            throw new Error("Failed to fetch user guilds");
        }

        // 2. Fetch all guilds the bot is in (Paginated)
        let botGuildsData: any[] = [];
        let botAfter = '0';
        while (true) {
            const data: any = await rest.get(Routes.userGuilds(), {
                query: new URLSearchParams({ after: botAfter, limit: '100' })
            });
            if (!Array.isArray(data) || data.length === 0) break;
            botGuildsData = [...botGuildsData, ...data];
            botAfter = data[data.length - 1].id;
            if (data.length < 100) break;
        }

        const botGuildIds = new Set(botGuildsData.map(g => g.id));
        console.log(`[API/Guilds] User in ${userGuilds.length} guilds. Bot in ${botGuildsData.length} guilds.`);

        // 3. Special permission for 'cherubdude' (ID: 953414442060746854)
        const userId = (session.user as any).id;
        const isSuperUser = userId === '953414442060746854';

        // 4. Identify Admin Guilds (Discord Permissions)
        const adminGuilds = userGuilds.filter((g: any) => {
            const perms = BigInt(g.permissions);
            const MANAGE_GUILD = 0x20n;
            const ADMIN = 0x8n;
            return (perms & ADMIN) === ADMIN || (perms & MANAGE_GUILD) === MANAGE_GUILD || g.owner;
        });

        const adminGuildIds = new Set(adminGuilds.map((g: any) => g.id));

        // 5. Check for Role-Based Access (Non-Admins)
        // Find all bot-managed guilds the user is in that they aren't already an admin for
        const potentialGuilds = userGuilds.filter((g: any) => botGuildIds.has(g.id) && !adminGuildIds.has(g.id));

        // Fetch all dashboard access roles for these guilds
        const { data: accessRoles } = await supabase
            .from('dashboard_roles')
            .select('server_id, discord_role_id')
            .eq('can_access_dashboard', true)
            .in('server_id', potentialGuilds.map((g: any) => g.id));

        const roleAccessGuilds: any[] = [];

        if (accessRoles && accessRoles.length > 0) {
            // Group roles by server
            const rolesByServer = accessRoles.reduce((acc: any, curr: any) => {
                if (!acc[curr.server_id]) acc[curr.server_id] = [];
                acc[curr.server_id].push(curr.discord_role_id);
                return acc;
            }, {});

            // For each of these servers, fetch user's roles from Discord
            // Note: Parallelize but limit to avoid massive bursts
            const memberChecks = Object.keys(rolesByServer).map(async (sid) => {
                try {
                    const member: any = await rest.get(Routes.guildMember(sid, userId));
                    const userRoles = member.roles || [];
                    const permittedRoles = rolesByServer[sid];

                    if (userRoles.some((r: string) => permittedRoles.includes(r))) {
                        const originalGuild = userGuilds.find((g: any) => g.id === sid);
                        return {
                            ...originalGuild,
                            hasBot: true,
                            isRoleAccess: true // Mark for layout logic if needed
                        };
                    }
                } catch (e) {
                    // Silently fail if member fetch fails (e.g. user left)
                }
                return null;
            });

            const results = await Promise.all(memberChecks);
            results.forEach(guild => {
                if (guild) roleAccessGuilds.push(guild);
            });
        }

        let visibleGuilds;
        if (isSuperUser) {
            // Cherubdude sees ALL guilds the bot is in + guilds they can manage
            const botOnlyGuilds = botGuildsData
                .filter((g: any) => !adminGuildIds.has(g.id))
                .map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    icon: g.icon,
                    permissions: "0",
                    owner: false,
                    hasBot: true
                }));

            const cherubManagedGuilds = adminGuilds.map((g: any) => ({
                ...g,
                hasBot: botGuildIds.has(g.id)
            }));

            visibleGuilds = [...cherubManagedGuilds, ...botOnlyGuilds];
        } else {
            // Normal Admin Guilds
            const managed = adminGuilds.map((g: any) => ({
                ...g,
                hasBot: botGuildIds.has(g.id)
            }));

            // Merge with Role Access Guilds
            visibleGuilds = [...managed, ...roleAccessGuilds];
        }

        return NextResponse.json(visibleGuilds);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
