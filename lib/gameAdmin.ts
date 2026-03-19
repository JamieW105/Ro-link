import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import { supabase } from './supabase';

export interface DashboardPermissions {
    can_access_dashboard: boolean;
    can_kick: boolean;
    can_ban: boolean;
    can_timeout: boolean;
    can_mute: boolean;
    can_lookup: boolean;
    can_manage_settings: boolean;
    can_manage_reports: boolean;
    allowed_misc_cmds: string[];
    is_admin: boolean;
}

export interface GameAdminServerRecord {
    id: string;
    admin_cmds_enabled: boolean | null;
    misc_cmds_enabled: boolean | null;
    place_id?: string | null;
    universe_id?: string | null;
}

interface VerifiedUserRecord {
    discord_id: string;
    roblox_id: string;
    roblox_username: string;
}

interface DiscordGuildRecord {
    id: string;
    owner_id: string;
}

interface DiscordMemberRecord {
    roles?: string[];
}

interface DiscordRoleRecord {
    id: string;
    permissions?: string;
}

interface DashboardRoleRecord {
    can_access_dashboard?: boolean | null;
    can_kick?: boolean | null;
    can_ban?: boolean | null;
    can_timeout?: boolean | null;
    can_mute?: boolean | null;
    can_lookup?: boolean | null;
    can_manage_settings?: boolean | null;
    can_manage_reports?: boolean | null;
    allowed_misc_cmds?: string[] | null;
}

export interface RoLinkAdminAccess {
    linked: boolean;
    inServer: boolean;
    panelEnabled: boolean;
    reason?: string;
    serverId: string;
    settings: {
        adminCmdsEnabled: boolean;
        miscCmdsEnabled: boolean;
    };
    permissions: DashboardPermissions;
    user?: {
        discordId: string;
        robloxId: string;
        robloxUsername: string;
    };
}

const ADMINISTRATOR_PERMISSION = 0x8n;

const rest = process.env.DISCORD_TOKEN
    ? new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)
    : null;

export function emptyDashboardPermissions(): DashboardPermissions {
    return {
        can_access_dashboard: false,
        can_kick: false,
        can_ban: false,
        can_timeout: false,
        can_mute: false,
        can_lookup: false,
        can_manage_settings: false,
        can_manage_reports: false,
        allowed_misc_cmds: [],
        is_admin: false,
    };
}

function hasPanelAccess(perms: DashboardPermissions) {
    return perms.is_admin
        || perms.can_access_dashboard
        || perms.can_kick
        || perms.can_ban
        || perms.can_timeout
        || perms.can_lookup
        || perms.can_manage_settings
        || perms.can_manage_reports
        || perms.allowed_misc_cmds.length > 0;
}

async function getGuildContext(serverId: string, discordUserId: string) {
    if (!rest) {
        throw new Error('Missing DISCORD_TOKEN');
    }

    const [guild, member, guildRoles] = await Promise.all([
        rest.get(Routes.guild(serverId)) as Promise<DiscordGuildRecord>,
        rest.get(Routes.guildMember(serverId, discordUserId)) as Promise<DiscordMemberRecord>,
        rest.get(Routes.guildRoles(serverId)) as Promise<DiscordRoleRecord[]>,
    ]);

    return { guild, member, guildRoles };
}

function computeIsAdmin(
    guild: DiscordGuildRecord,
    member: DiscordMemberRecord,
    guildRoles: DiscordRoleRecord[],
    discordUserId: string,
) {
    if (guild?.owner_id === discordUserId) {
        return true;
    }

    const memberRoleIds = new Set<string>(Array.isArray(member?.roles) ? member.roles : []);
    const effectivePermissions = guildRoles.reduce((combined, role) => {
        if (role?.id === guild?.id || memberRoleIds.has(role?.id)) {
            try {
                return combined | BigInt(role.permissions || '0');
            } catch {
                return combined;
            }
        }
        return combined;
    }, 0n);

    return (effectivePermissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
}

function aggregateDashboardPermissions(isAdmin: boolean, dashboardRoles: DashboardRoleRecord[]) {
    if (isAdmin) {
        return {
            can_access_dashboard: true,
            can_kick: true,
            can_ban: true,
            can_timeout: true,
            can_mute: true,
            can_lookup: true,
            can_manage_settings: true,
            can_manage_reports: true,
            allowed_misc_cmds: ['*'],
            is_admin: true,
        } satisfies DashboardPermissions;
    }

    const finalPerms = emptyDashboardPermissions();

    for (const role of dashboardRoles) {
        if (role.can_access_dashboard) finalPerms.can_access_dashboard = true;
        if (role.can_kick) finalPerms.can_kick = true;
        if (role.can_ban) finalPerms.can_ban = true;
        if (role.can_timeout) finalPerms.can_timeout = true;
        if (role.can_mute) finalPerms.can_mute = true;
        if (role.can_lookup) finalPerms.can_lookup = true;
        if (role.can_manage_settings) finalPerms.can_manage_settings = true;
        if (role.can_manage_reports) finalPerms.can_manage_reports = true;

        if (Array.isArray(role.allowed_misc_cmds)) {
            for (const rawCommand of role.allowed_misc_cmds) {
                const command = String(rawCommand || '').trim().toUpperCase();
                if (command && !finalPerms.allowed_misc_cmds.includes(command)) {
                    finalPerms.allowed_misc_cmds.push(command);
                }
            }
        }
    }

    return finalPerms;
}

export async function getServerByApiKey(apiKey: string) {
    const { data, error } = await supabase
        .from('servers')
        .select('id, admin_cmds_enabled, misc_cmds_enabled, place_id, universe_id')
        .eq('api_key', apiKey)
        .single<GameAdminServerRecord>();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function resolveRoLinkAdminAccess(
    apiKey: string,
    robloxId: string | number,
): Promise<RoLinkAdminAccess | null> {
    const server = await getServerByApiKey(apiKey);
    if (!server) {
        return null;
    }

    const settings = {
        adminCmdsEnabled: server.admin_cmds_enabled !== false,
        miscCmdsEnabled: server.misc_cmds_enabled !== false,
    };

    const { data: verifiedUser } = await supabase
        .from('verified_users')
        .select('discord_id, roblox_id, roblox_username')
        .eq('roblox_id', String(robloxId))
        .maybeSingle<VerifiedUserRecord>();

    if (!verifiedUser) {
        return {
            linked: false,
            inServer: false,
            panelEnabled: false,
            reason: 'This Roblox account is not linked with Ro-Link.',
            serverId: server.id,
            settings,
            permissions: emptyDashboardPermissions(),
        };
    }

    let guildContext: Awaited<ReturnType<typeof getGuildContext>>;
    try {
        guildContext = await getGuildContext(server.id, verifiedUser.discord_id);
    } catch {
        return {
            linked: true,
            inServer: false,
            panelEnabled: false,
            reason: 'This linked Discord account is not currently in the Ro-Link server.',
            serverId: server.id,
            settings,
            permissions: emptyDashboardPermissions(),
            user: {
                discordId: verifiedUser.discord_id,
                robloxId: String(verifiedUser.roblox_id),
                robloxUsername: verifiedUser.roblox_username,
            },
        };
    }

    const isAdmin = computeIsAdmin(
        guildContext.guild,
        guildContext.member,
        Array.isArray(guildContext.guildRoles) ? guildContext.guildRoles : [],
        verifiedUser.discord_id,
    );

    const memberRoles = Array.isArray(guildContext.member?.roles) ? guildContext.member.roles : [];

    const { data: dashboardRoles } = await supabase
        .from('dashboard_roles')
        .select('*')
        .eq('server_id', server.id)
        .in('discord_role_id', memberRoles);

    const permissions = aggregateDashboardPermissions(isAdmin, dashboardRoles || []);

    return {
        linked: true,
        inServer: true,
        panelEnabled: hasPanelAccess(permissions),
        serverId: server.id,
        settings,
        permissions,
        user: {
            discordId: verifiedUser.discord_id,
            robloxId: String(verifiedUser.roblox_id),
            robloxUsername: verifiedUser.roblox_username,
        },
    };
}
