import { NextResponse } from 'next/server';

import { aggregateDashboardPermissions, emptyDashboardPermissions, getServerByApiKey } from '@/lib/gameAdmin';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type VerifiedUserRecord = {
    discord_id?: string | null;
    roblox_id?: string | null;
    roblox_username?: string | null;
};

type DiscordUserRecord = {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    discriminator?: string;
};

type DiscordGuildRecord = {
    id?: string;
    owner_id?: string | null;
};

type DiscordMemberRecord = {
    user?: DiscordUserRecord;
    nick?: string | null;
    roles?: string[];
    joined_at?: string | null;
};

type DiscordRoleRecord = {
    id?: string;
    name?: string;
    color?: number;
    position?: number;
    permissions?: string;
};

type RobloxUserRecord = {
    id?: number;
    name?: string;
    displayName?: string;
    requestedUsername?: string;
};

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const ADMINISTRATOR_PERMISSION = 0x8n;

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function readField(source: Record<string, unknown>, names: string[]) {
    for (const name of names) {
        const value = source[name];
        if (value !== undefined && value !== null && trimString(value) !== '') {
            return value;
        }
    }
    return undefined;
}

function normalizeIdentityFromSearchParams(searchParams: URLSearchParams) {
    return {
        robloxId: trimString(searchParams.get('robloxId') ?? searchParams.get('userId')),
        robloxUsername: trimString(searchParams.get('robloxUsername') ?? searchParams.get('username') ?? searchParams.get('user')),
        discordId: trimString(searchParams.get('discordId')),
    };
}

async function readIdentity(req: Request) {
    const { searchParams } = new URL(req.url);
    if (req.method === 'GET') {
        return normalizeIdentityFromSearchParams(searchParams);
    }

    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        body = {};
    }

    const user = body.user && typeof body.user === 'object' && !Array.isArray(body.user)
        ? body.user as Record<string, unknown>
        : body;

    return {
        robloxId: trimString(readField(user, ['robloxId', 'robloxID', 'roblox_id', 'userId', 'UserId', 'id', 'ID'])),
        robloxUsername: trimString(readField(user, ['robloxUsername', 'username', 'Username', 'name', 'Name'])),
        discordId: trimString(readField(user, ['discordId', 'discordID', 'discord_id', 'DiscordId'])),
    };
}

async function fetchDiscordResource<T>(path: string, allowNotFound = false) {
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

async function fetchRobloxUserByUsername(username: string) {
    if (!username) {
        return null;
    }

    const response = await fetch('https://users.roproxy.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
        cache: 'no-store',
    });

    if (!response.ok) {
        return null;
    }

    const payload = await response.json() as { data?: RobloxUserRecord[] };
    return payload.data?.[0] ?? null;
}

async function fetchRobloxUserById(userId: string) {
    if (!userId) {
        return null;
    }

    const response = await fetch(`https://users.roproxy.com/v1/users/${encodeURIComponent(userId)}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        return null;
    }

    return response.json() as Promise<RobloxUserRecord>;
}

async function findVerifiedUser(identity: Awaited<ReturnType<typeof readIdentity>>) {
    if (identity.discordId) {
        const { data, error } = await supabase
            .from('verified_users')
            .select('discord_id, roblox_id, roblox_username')
            .eq('discord_id', identity.discordId)
            .maybeSingle<VerifiedUserRecord>();

        if (error) throw new Error(error.message);
        return data;
    }

    if (identity.robloxId) {
        const { data, error } = await supabase
            .from('verified_users')
            .select('discord_id, roblox_id, roblox_username')
            .eq('roblox_id', identity.robloxId)
            .maybeSingle<VerifiedUserRecord>();

        if (error) throw new Error(error.message);
        return data;
    }

    if (identity.robloxUsername) {
        const { data, error } = await supabase
            .from('verified_users')
            .select('discord_id, roblox_id, roblox_username')
            .ilike('roblox_username', identity.robloxUsername)
            .maybeSingle<VerifiedUserRecord>();

        if (error) throw new Error(error.message);
        return data;
    }

    return null;
}

function getHighestRole(member: DiscordMemberRecord | null, roles: DiscordRoleRecord[]) {
    const roleIds = new Set(Array.isArray(member?.roles) ? member?.roles : []);
    const memberRoles = roles
        .filter((role) => role.id && roleIds.has(role.id))
        .sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0));

    return {
        highestPosition: Number(memberRoles[0]?.position ?? 0),
        highestRole: memberRoles[0]
            ? {
                id: trimString(memberRoles[0].id),
                name: trimString(memberRoles[0].name),
                position: Number(memberRoles[0].position ?? 0),
                color: Number(memberRoles[0].color ?? 0),
            }
            : null,
        roles: memberRoles.map((role) => ({
            id: trimString(role.id),
            name: trimString(role.name),
            position: Number(role.position ?? 0),
            color: Number(role.color ?? 0),
        })),
    };
}

function computeIsAdmin(guild: DiscordGuildRecord | null, member: DiscordMemberRecord | null, roles: DiscordRoleRecord[], discordId: string) {
    if (trimString(guild?.owner_id) === discordId) {
        return true;
    }

    const roleIds = new Set(Array.isArray(member?.roles) ? member?.roles : []);
    const permissions = roles.reduce((combined, role) => {
        if (role.id === guild?.id || (role.id && roleIds.has(role.id))) {
            try {
                return combined | BigInt(role.permissions || '0');
            } catch {
                return combined;
            }
        }
        return combined;
    }, 0n);

    return (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
}

async function buildDiscordData(serverId: string, verifiedUser: VerifiedUserRecord | null) {
    const discordId = trimString(verifiedUser?.discord_id);
    if (!discordId) {
        return {
            discordUser: null,
            discordUsers: [],
            discordMember: null,
            serverRank: null,
            permissions: emptyDashboardPermissions(),
        };
    }

    const [guild, member, user, roles] = await Promise.all([
        fetchDiscordResource<DiscordGuildRecord>(`/guilds/${encodeURIComponent(serverId)}`),
        fetchDiscordResource<DiscordMemberRecord>(`/guilds/${encodeURIComponent(serverId)}/members/${encodeURIComponent(discordId)}`, true),
        fetchDiscordResource<DiscordUserRecord>(`/users/${encodeURIComponent(discordId)}`, true),
        fetchDiscordResource<DiscordRoleRecord[]>(`/guilds/${encodeURIComponent(serverId)}/roles`),
    ]);

    const guildRoles = Array.isArray(roles) ? roles : [];
    const isOwner = trimString(guild?.owner_id) === discordId;
    const isAdmin = computeIsAdmin(guild, member, guildRoles, discordId);
    const rank = getHighestRole(member, guildRoles);
    const memberRoleIds = Array.isArray(member?.roles) ? member.roles : [];
    const dashboardRoles = memberRoleIds.length === 0
        ? []
        : (await supabase
            .from('dashboard_roles')
            .select('*')
            .eq('server_id', serverId)
            .in('discord_role_id', memberRoleIds)).data;

    const discordUser = {
        id: discordId,
        username: trimString(user?.username ?? member?.user?.username),
        globalName: user?.global_name ?? member?.user?.global_name ?? null,
        avatar: user?.avatar ?? member?.user?.avatar ?? null,
        discriminator: trimString(user?.discriminator ?? member?.user?.discriminator),
    };

    return {
        discordUser,
        discordUsers: [discordUser],
        discordMember: member
            ? {
                nick: member.nick ?? null,
                joinedAt: member.joined_at ?? null,
                roleIds: memberRoleIds,
            }
            : null,
        serverRank: {
            ...rank,
            isOwner,
            isAdmin,
            inServer: member !== null,
        },
        permissions: aggregateDashboardPermissions(isAdmin, dashboardRoles || []),
    };
}

async function handle(req: Request) {
    const auth = readServerApiKeyDetails(req);
    if (!auth.key) {
        return NextResponse.json(
            {
                error: 'Missing API Key',
                message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
                received: describeServerApiKeyDetails(auth),
            },
            { status: 401 },
        );
    }

    const server = await getServerByApiKey(auth.key);
    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    const identity = await readIdentity(req);
    if (!identity.robloxId && !identity.robloxUsername && !identity.discordId) {
        return NextResponse.json({ error: 'user, robloxId, robloxUsername, or discordId is required' }, { status: 400 });
    }

    const verifiedUser = await findVerifiedUser(identity);
    const robloxId = trimString(verifiedUser?.roblox_id || identity.robloxId);
    const robloxUsername = trimString(verifiedUser?.roblox_username || identity.robloxUsername);
    const robloxUser = robloxId
        ? await fetchRobloxUserById(robloxId)
        : await fetchRobloxUserByUsername(robloxUsername);
    const discordData = await buildDiscordData(server.id, verifiedUser);

    return NextResponse.json(
        {
            serverId: server.id,
            linked: Boolean(verifiedUser?.discord_id),
            user: {
                robloxId: trimString(robloxUser?.id ?? robloxId),
                robloxUsername: trimString(robloxUser?.name ?? robloxUsername),
                displayName: trimString(robloxUser?.displayName ?? robloxUsername),
            },
            verifiedUser: verifiedUser
                ? {
                    discordId: trimString(verifiedUser.discord_id),
                    robloxId: trimString(verifiedUser.roblox_id),
                    robloxUsername: trimString(verifiedUser.roblox_username),
                }
                : null,
            ...discordData,
        },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        },
    );
}

export async function GET(req: Request) {
    try {
        return await handle(req);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load user data.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        return await handle(req);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load user data.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
