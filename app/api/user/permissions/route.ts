
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { supabase } from '@/lib/supabase';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');

    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!serverId) {
        return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    try {
        const userId = (session.user as any).id;
        const superUserId = '953414442060746854';

        // 1. Fetch Member from Discord to get roles and base permissions
        let member: any;
        try {
            member = await rest.get(Routes.guildMember(serverId, userId));
        } catch (e) {
            return NextResponse.json({ error: 'Not a member of this server' }, { status: 403 });
        }

        const userRoles = member.roles || [];
        const discordPermissions = BigInt(member.permissions || "0");
        const isAdmin = (discordPermissions & 0x8n) === 0x8n || userId === superUserId;

        // 2. Fetch Dashboard Roles from Supabase
        const { data: dbRoles, error: rolesError } = await supabase
            .from('dashboard_roles')
            .select('*')
            .eq('server_id', serverId);

        if (rolesError) throw rolesError;

        // 3. Aggregate Permissions
        // Default (Everything false)
        let finalPerms = {
            can_access_dashboard: false,
            can_kick: false,
            can_ban: false,
            can_timeout: false,
            can_mute: false,
            can_lookup: false,
            can_manage_settings: false,
            can_manage_reports: false,
            allowed_misc_cmds: [] as string[],
            is_admin: isAdmin
        };

        if (isAdmin) {
            // Admins get everything
            finalPerms = {
                can_access_dashboard: true,
                can_kick: true,
                can_ban: true,
                can_timeout: true,
                can_mute: true,
                can_lookup: true,
                can_manage_settings: true,
                can_manage_reports: true,
                allowed_misc_cmds: ['*'],
                is_admin: true
            };
        } else {
            // Check matching roles
            const matchedRoles = dbRoles?.filter(r => userRoles.includes(r.discord_role_id)) || [];

            matchedRoles.forEach(role => {
                if (role.can_access_dashboard) finalPerms.can_access_dashboard = true;
                if (role.can_kick) finalPerms.can_kick = true;
                if (role.can_ban) finalPerms.can_ban = true;
                if (role.can_timeout) finalPerms.can_timeout = true;
                if (role.can_mute) finalPerms.can_mute = true;
                if (role.can_lookup) finalPerms.can_lookup = true;
                if (role.can_manage_settings) finalPerms.can_manage_settings = true;
                if (role.can_manage_reports) finalPerms.can_manage_reports = true;

                if (role.allowed_misc_cmds) {
                    role.allowed_misc_cmds.forEach((cmd: string) => {
                        if (!finalPerms.allowed_misc_cmds.includes(cmd)) {
                            finalPerms.allowed_misc_cmds.push(cmd);
                        }
                    });
                }
            });
        }

        return NextResponse.json(finalPerms);

    } catch (error) {
        console.error('[Permissions API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
