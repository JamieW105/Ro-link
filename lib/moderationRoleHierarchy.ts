import { supabase } from './supabase';

type ServerHierarchySettingRecord = {
    enforce_moderation_role_hierarchy?: boolean | null;
};

type VerifiedTargetRecord = {
    discord_id?: string | null;
};

type DiscordGuildRecord = {
    owner_id?: string | null;
};

type DiscordMemberRecord = {
    roles?: string[] | null;
};

type DiscordRoleRecord = {
    id?: string | null;
    position?: number | null;
};

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const MODERATION_ROLE_HIERARCHY_COMMANDS = new Set(['KICK', 'BAN', 'SOFTBAN']);

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

async function fetchDiscordResource<T>(path: string, allowNotFound = false): Promise<T | null> {
    const token = trimString(process.env.DISCORD_TOKEN);
    if (!token) {
        throw new Error('Missing DISCORD_TOKEN');
    }

    const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
        headers: {
            Authorization: `Bot ${token}`,
        },
        cache: 'no-store',
    });

    if (allowNotFound && response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Discord API request failed (${response.status}) for ${path}`);
    }

    return response.json() as Promise<T>;
}

function getHighestRolePosition(member: DiscordMemberRecord | null, roles: DiscordRoleRecord[]) {
    if (!member) {
        return -1;
    }

    const positions = new Map<string, number>();
    for (const role of roles) {
        const roleId = trimString(role?.id);
        if (!roleId) {
            continue;
        }
        positions.set(roleId, Number(role?.position ?? 0));
    }

    let highestPosition = 0;
    for (const roleId of Array.isArray(member.roles) ? member.roles : []) {
        highestPosition = Math.max(highestPosition, positions.get(trimString(roleId)) ?? 0);
    }

    return highestPosition;
}

export async function resolveDiscordIdFromRobloxId(robloxId: string | number) {
    const normalizedRobloxId = trimString(robloxId);
    if (!normalizedRobloxId) {
        return '';
    }

    const { data, error } = await supabase
        .from('verified_users')
        .select('discord_id')
        .eq('roblox_id', normalizedRobloxId)
        .maybeSingle<VerifiedTargetRecord>();

    if (error) {
        throw new Error(error.message);
    }

    return trimString(data?.discord_id);
}

export function commandRequiresModerationHierarchy(commandId: string) {
    return MODERATION_ROLE_HIERARCHY_COMMANDS.has(trimString(commandId).toUpperCase());
}

export async function isModerationRoleHierarchyEnabled(serverId: string, preset?: boolean | null) {
    if (preset !== undefined && preset !== null) {
        return preset !== false;
    }

    const { data, error } = await supabase
        .from('servers')
        .select('enforce_moderation_role_hierarchy')
        .eq('id', serverId)
        .maybeSingle<ServerHierarchySettingRecord>();

    if (error) {
        throw new Error(error.message);
    }

    return data?.enforce_moderation_role_hierarchy !== false;
}

export async function evaluateModerationRoleHierarchy(input: {
    serverId: string;
    moderatorDiscordId: string;
    targetRobloxUsername: string;
    enabled?: boolean | null;
}) {
    const serverId = trimString(input.serverId);
    const moderatorDiscordId = trimString(input.moderatorDiscordId);
    const targetRobloxUsername = trimString(input.targetRobloxUsername);
    const enabled = await isModerationRoleHierarchyEnabled(serverId, input.enabled);

    if (!enabled) {
        return { allowed: true, enabled: false } as const;
    }

    if (!serverId || !moderatorDiscordId || !targetRobloxUsername) {
        return {
            allowed: false,
            enabled: true,
            message: 'Ro-Link could not verify the moderation role hierarchy for this action.',
        } as const;
    }

    const { data: verifiedTarget, error: verifiedTargetError } = await supabase
        .from('verified_users')
        .select('discord_id')
        .ilike('roblox_username', targetRobloxUsername)
        .maybeSingle<VerifiedTargetRecord>();

    if (verifiedTargetError) {
        throw new Error(verifiedTargetError.message);
    }

    const targetDiscordId = trimString(verifiedTarget?.discord_id);
    if (!targetDiscordId) {
        return { allowed: true, enabled: true, targetDiscordId: null } as const;
    }

    const [guild, moderatorMember, targetMember, roles] = await Promise.all([
        fetchDiscordResource<DiscordGuildRecord>(`/guilds/${encodeURIComponent(serverId)}`),
        fetchDiscordResource<DiscordMemberRecord>(`/guilds/${encodeURIComponent(serverId)}/members/${encodeURIComponent(moderatorDiscordId)}`, true),
        fetchDiscordResource<DiscordMemberRecord>(`/guilds/${encodeURIComponent(serverId)}/members/${encodeURIComponent(targetDiscordId)}`, true),
        fetchDiscordResource<DiscordRoleRecord[]>(`/guilds/${encodeURIComponent(serverId)}/roles`),
    ]);

    if (!targetMember) {
        return { allowed: true, enabled: true, targetDiscordId } as const;
    }

    if (!moderatorMember) {
        return {
            allowed: false,
            enabled: true,
            message: 'Ro-Link could not verify your Discord server roles right now. Try again in a moment.',
        } as const;
    }

    if (trimString(guild?.owner_id) === moderatorDiscordId) {
        return { allowed: true, enabled: true, targetDiscordId } as const;
    }

    if (trimString(guild?.owner_id) === targetDiscordId) {
        return {
            allowed: false,
            enabled: true,
            message: 'Role hierarchy restriction blocked this action because the target is the server owner.',
        } as const;
    }

    const guildRoles = Array.isArray(roles) ? roles : [];
    const moderatorHighestPosition = getHighestRolePosition(moderatorMember, guildRoles);
    const targetHighestPosition = getHighestRolePosition(targetMember, guildRoles);

    if (moderatorHighestPosition < targetHighestPosition) {
        return {
            allowed: false,
            enabled: true,
            message: `Role hierarchy restriction blocked this action because ${targetRobloxUsername}'s linked Discord roles are higher than yours.`,
        } as const;
    }

    return {
        allowed: true,
        enabled: true,
        targetDiscordId,
        moderatorHighestPosition,
        targetHighestPosition,
    } as const;
}
