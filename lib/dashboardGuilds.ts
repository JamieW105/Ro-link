import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import { supabase } from './supabase';

export class DiscordAccessTokenError extends Error {
    constructor(message = 'Discord access token expired or was revoked.') {
        super(message);
        this.name = 'DiscordAccessTokenError';
    }
}

export class DiscordRateLimitError extends Error {
    retryAfter: number | null;

    constructor(message = 'Discord rate limited the guild list request.', retryAfter: number | null = null) {
        super(message);
        this.name = 'DiscordRateLimitError';
        this.retryAfter = retryAfter;
    }
}

const ADMINISTRATOR_PERMISSION = 0x8n;
const MANAGE_GUILD_PERMISSION = 0x20n;

const rest = process.env.DISCORD_TOKEN
    ? new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)
    : null;

interface DiscordGuildRecord {
    id: string;
    name: string;
    icon?: string | null;
    permissions: string;
    owner?: boolean;
}

interface BotGuildRecord {
    id: string;
    name: string;
    icon?: string | null;
}

interface GuildMemberRecord {
    roles?: string[];
}

export interface VisibleDashboardGuild {
    id: string;
    name: string;
    icon?: string | null;
    permissions: string;
    owner?: boolean;
    hasBot: boolean;
    isRoleAccess?: boolean;
}

export function hasDiscordGuildManagePermission(permissionBits?: string | null, owner?: boolean) {
    if (owner) {
        return true;
    }

    if (!permissionBits) {
        return false;
    }

    try {
        const perms = BigInt(permissionBits);
        return (perms & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION
            || (perms & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
    } catch {
        return false;
    }
}

async function listBotGuilds() {
    const botGuilds: BotGuildRecord[] = [];
    let botAfter = '0';
    const discordRest = rest;

    if (!discordRest) {
        console.warn('[DASHBOARD][GUILDS] Missing DISCORD_TOKEN while loading bot guilds. Returning an empty bot guild list.');
        return botGuilds;
    }

    try {
        while (true) {
            const data = await discordRest.get(Routes.userGuilds(), {
                query: new URLSearchParams({ after: botAfter, limit: '100' }),
            }) as BotGuildRecord[];

            if (!Array.isArray(data) || data.length === 0) {
                break;
            }

            botGuilds.push(...data);
            botAfter = data[data.length - 1].id;

            if (data.length < 100) {
                break;
            }
        }
    } catch (error) {
        console.warn('[DASHBOARD][GUILDS] Failed to load bot guilds. Returning an empty bot guild list.', {
            error: error instanceof Error ? error.message : error,
        });
    }

    return botGuilds;
}

export async function listVisibleGuildsForDiscordSession(accessToken: string, discordUserId: string) {
    const userGuilds: DiscordGuildRecord[] = [];

    let after = '0';

    while (true) {
        const res = await fetch(`https://discord.com/api/users/@me/guilds?after=${after}&limit=100`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
        });

        if (!res.ok) {
            if (res.status === 401) {
                throw new DiscordAccessTokenError();
            }
            if (res.status === 429) {
                const retryAfterHeader = res.headers.get('retry-after');
                const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
                throw new DiscordRateLimitError(`Failed to fetch user guilds (${res.status})`, Number.isFinite(retryAfter) ? retryAfter : null);
            }
            if (userGuilds.length === 0) {
                throw new Error(`Failed to fetch user guilds (${res.status})`);
            }
            break;
        }

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            break;
        }

        userGuilds.push(...data);
        after = data[data.length - 1].id;

        if (data.length < 100) {
            break;
        }
    }

    const botGuilds = await listBotGuilds();
    const userGuildIds = userGuilds.map((guild) => guild.id);
    const { data: blockedRows, error: blockedRowsError } = userGuildIds.length > 0
        ? await supabase
            .from('blocked_servers')
            .select('guild_id')
            .in('guild_id', userGuildIds)
        : { data: [], error: null };

    if (blockedRowsError) {
        console.warn('[DASHBOARD][GUILDS] Failed to load blocked guild list. Continuing without filtering.', {
            error: blockedRowsError.message,
        });
    }

    const blockedGuildIds = new Set((blockedRows || []).map((row) => row.guild_id));
    const allowedUserGuilds = userGuilds.filter((guild) => !blockedGuildIds.has(guild.id));

    const botGuildIds = new Set(botGuilds.map((guild) => guild.id));

    const adminGuilds = allowedUserGuilds.filter((guild) => hasDiscordGuildManagePermission(guild.permissions, guild.owner));
    const adminGuildIds = new Set(adminGuilds.map((guild) => guild.id));
    const potentialRoleAccessGuilds = allowedUserGuilds.filter((guild) => botGuildIds.has(guild.id) && !adminGuildIds.has(guild.id));

    let roleAccessGuilds: VisibleDashboardGuild[] = [];
    const discordRest = rest;

    if (discordRest && potentialRoleAccessGuilds.length > 0) {
        const { data: accessRoles } = await supabase
            .from('dashboard_roles')
            .select('server_id, discord_role_id')
            .eq('can_access_dashboard', true)
            .in('server_id', potentialRoleAccessGuilds.map((guild) => guild.id));

        if (Array.isArray(accessRoles) && accessRoles.length > 0) {
            const rolesByServer = accessRoles.reduce<Record<string, string[]>>((accumulator, role) => {
                if (!accumulator[role.server_id]) {
                    accumulator[role.server_id] = [];
                }
                accumulator[role.server_id].push(role.discord_role_id);
                return accumulator;
            }, {});

            const checks = Object.entries(rolesByServer).map(async ([serverId, permittedRoles]) => {
                try {
                    const member = await discordRest.get(Routes.guildMember(serverId, discordUserId)) as GuildMemberRecord;
                    const userRoles = Array.isArray(member.roles) ? member.roles : [];

                    if (!userRoles.some((roleId) => permittedRoles.includes(roleId))) {
                        return null;
                    }

                    const originalGuild = potentialRoleAccessGuilds.find((guild) => guild.id === serverId);
                    if (!originalGuild) {
                        return null;
                    }

                    return {
                        ...originalGuild,
                        hasBot: true,
                        isRoleAccess: true,
                    } satisfies VisibleDashboardGuild;
                } catch {
                    return null;
                }
            });

            const resolvedChecks = await Promise.all(checks);

            roleAccessGuilds = [];
            for (const guild of resolvedChecks) {
                if (guild) {
                    roleAccessGuilds.push(guild);
                }
            }
        }
    }

    const managedGuilds = adminGuilds.map((guild) => ({
        ...guild,
        hasBot: botGuildIds.has(guild.id),
    } satisfies VisibleDashboardGuild));

    return [...managedGuilds, ...roleAccessGuilds];
}
