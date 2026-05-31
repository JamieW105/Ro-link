import { NextRequest, NextResponse } from 'next/server';

import { canUseLivePanelUserTools, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
};

type RobloxUserRecord = {
    id?: number;
    name?: string;
    displayName?: string;
};

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DISCORD_ID_PATTERN = /^\d{17,20}$/;

function extractDiscordId(value: unknown) {
    const text = trimString(value);
    const mentionMatch = text.match(/^<@!?(\d{17,20})>$/);
    if (mentionMatch?.[1]) {
        return mentionMatch[1];
    }

    return DISCORD_ID_PATTERN.test(text) ? text : '';
}

async function fetchDiscordResource<T>(path: string, allowNotFound = false) {
    const token = trimString(process.env.DISCORD_TOKEN);
    if (!token) {
        return null;
    }

    const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: 'no-store',
    });

    if (allowNotFound && response.status === 404) {
        return null;
    }
    if (!response.ok) {
        console.error(`[Dashboard User Profile] Discord request failed (${response.status}) for ${path}`);
        return null;
    }

    return response.json() as Promise<T>;
}

async function searchDiscordMember(serverId: string, query: string) {
    const normalizedQuery = trimString(query).replace(/^@/, '');
    if (normalizedQuery.length < 2) {
        return null;
    }

    const members = await fetchDiscordResource<DiscordMemberRecord[]>(
        `/guilds/${encodeURIComponent(serverId)}/members/search?query=${encodeURIComponent(normalizedQuery)}&limit=1`,
        true,
    );

    return Array.isArray(members) ? members[0] ?? null : null;
}

async function resolveDiscordProfileInput(serverId: string, input: string) {
    const discordId = extractDiscordId(input);
    if (discordId) {
        const [user, member] = await Promise.all([
            fetchDiscordResource<DiscordUserRecord>(`/users/${encodeURIComponent(discordId)}`, true),
            fetchDiscordResource<DiscordMemberRecord>(`/guilds/${encodeURIComponent(serverId)}/members/${encodeURIComponent(discordId)}`, true),
        ]);

        if (user || member?.user) {
            return {
                discordId,
                user: user || member?.user || null,
                member,
            };
        }

        return null;
    }

    const member = await searchDiscordMember(serverId, input);
    const resolvedDiscordId = trimString(member?.user?.id);
    if (!resolvedDiscordId) {
        return null;
    }

    return {
        discordId: resolvedDiscordId,
        user: member?.user || null,
        member,
    };
}

function buildDiscordAvatarUrl(user: DiscordUserRecord | null) {
    const id = trimString(user?.id);
    const avatar = trimString(user?.avatar);
    if (!id || !avatar) {
        return 'https://cdn.discordapp.com/embed/avatars/0.png';
    }

    const extension = avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(avatar)}.${extension}?size=128`;
}

async function fetchRobloxUserByUsername(username: string) {
    if (!username) return null;

    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
        cache: 'no-store',
    });

    if (!response.ok) return null;
    const payload = await response.json() as { data?: RobloxUserRecord[] };
    return payload.data?.[0] ?? null;
}

async function fetchRobloxUserById(userId: string) {
    if (!userId) return null;

    const response = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(userId)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
    });

    if (!response.ok) return null;
    return response.json() as Promise<RobloxUserRecord>;
}

async function findVerifiedUser(serverId: string, identity: { discordId: string; robloxId: string; robloxUsername: string }) {
    const client = getSupabaseAdmin();
    const select = 'discord_id, roblox_id, roblox_username';

    if (identity.discordId) {
        const { data, error } = await client
            .from('verified_users')
            .select(select)
            .eq('discord_id', identity.discordId)
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (data) return data as VerifiedUserRecord;
    }

    if (identity.robloxId) {
        const { data, error } = await client
            .from('verified_users')
            .select(select)
            .eq('roblox_id', identity.robloxId)
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (data) return data as VerifiedUserRecord;
    }

    if (identity.robloxUsername) {
        const { data, error } = await client
            .from('verified_users')
            .select(select)
            .ilike('roblox_username', identity.robloxUsername)
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (data) return data as VerifiedUserRecord;
    }

    return null;
}

function roleColor(value: unknown) {
    const color = Number(value);
    if (!Number.isFinite(color) || color <= 0) return null;
    return `#${color.toString(16).padStart(6, '0')}`;
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireDashboardAccess(serverId, canUseLivePanelUserTools);
    if ('error' in access) {
        return access.error;
    }

    const identity = {
        discordId: extractDiscordId(req.nextUrl.searchParams.get('discordId')) || trimString(req.nextUrl.searchParams.get('discordId')),
        robloxId: trimString(req.nextUrl.searchParams.get('robloxId') ?? req.nextUrl.searchParams.get('userId')),
        robloxUsername: trimString(req.nextUrl.searchParams.get('robloxUsername') ?? req.nextUrl.searchParams.get('username')),
    };

    if (!identity.discordId && !identity.robloxId && !identity.robloxUsername) {
        return NextResponse.json({ error: 'discordId, robloxId, or robloxUsername is required.' }, { status: 400 });
    }

    try {
        let verifiedUser = await findVerifiedUser(serverId, identity);
        let discordId = trimString(verifiedUser?.discord_id || identity.discordId);
        let robloxId = trimString(verifiedUser?.roblox_id || identity.robloxId);
        let robloxUsername = trimString(verifiedUser?.roblox_username || identity.robloxUsername);
        let robloxUser = robloxId ? await fetchRobloxUserById(robloxId) : await fetchRobloxUserByUsername(robloxUsername);
        let discordProfile: Awaited<ReturnType<typeof resolveDiscordProfileInput>> = null;

        const fallbackDiscordInput = identity.discordId || identity.robloxId || identity.robloxUsername;
        if (!robloxUser && !verifiedUser && fallbackDiscordInput) {
            discordProfile = await resolveDiscordProfileInput(serverId, fallbackDiscordInput);
            if (discordProfile?.discordId) {
                discordId = discordProfile.discordId;
                verifiedUser = await findVerifiedUser(serverId, {
                    discordId,
                    robloxId: '',
                    robloxUsername: '',
                });
                robloxId = trimString(verifiedUser?.roblox_id || '');
                robloxUsername = trimString(verifiedUser?.roblox_username || '');
                robloxUser = robloxId ? await fetchRobloxUserById(robloxId) : await fetchRobloxUserByUsername(robloxUsername);
            }
        }

        discordId = trimString(verifiedUser?.discord_id || discordId);
        const [discordUser, discordMember, guildRoles] = await Promise.all([
            discordId && !discordProfile?.user ? fetchDiscordResource<DiscordUserRecord>(`/users/${encodeURIComponent(discordId)}`, true) : Promise.resolve(discordProfile?.user || null),
            discordId && !discordProfile?.member ? fetchDiscordResource<DiscordMemberRecord>(`/guilds/${encodeURIComponent(serverId)}/members/${encodeURIComponent(discordId)}`, true) : Promise.resolve(discordProfile?.member || null),
            discordId ? fetchDiscordResource<DiscordRoleRecord[]>(`/guilds/${encodeURIComponent(serverId)}/roles`, true) : Promise.resolve(null),
        ]);

        const roleIds = Array.isArray(discordMember?.roles) ? discordMember.roles : [];
        const roles = (Array.isArray(guildRoles) ? guildRoles : [])
            .filter((role) => role.id && roleIds.includes(role.id))
            .sort((left, right) => Number(right.position ?? 0) - Number(left.position ?? 0))
            .map((role) => ({
                id: trimString(role.id),
                name: trimString(role.name),
                color: roleColor(role.color),
                position: Number(role.position ?? 0),
            }));
        const user = discordUser || discordMember?.user || null;

        return NextResponse.json({
            linked: Boolean(verifiedUser?.discord_id),
            verifiedUser: verifiedUser
                ? {
                    discordId: trimString(verifiedUser.discord_id),
                    robloxId: trimString(verifiedUser.roblox_id),
                    robloxUsername: trimString(verifiedUser.roblox_username),
                }
                : null,
            discordUser: user
                ? {
                    id: discordId,
                    username: trimString(user.username),
                    globalName: user.global_name ?? null,
                    discriminator: trimString(user.discriminator),
                    avatarUrl: buildDiscordAvatarUrl({ ...user, id: discordId }),
                }
                : null,
            discordMember: discordMember
                ? {
                    nick: discordMember.nick ?? null,
                    joinedAt: discordMember.joined_at ?? null,
                    roles,
                    highestRole: roles[0] || null,
                }
                : null,
            robloxUser: robloxUser || robloxId || robloxUsername
                ? {
                    id: trimString(robloxUser?.id ?? robloxId),
                    username: trimString(robloxUser?.name ?? robloxUsername),
                    displayName: trimString(robloxUser?.displayName ?? robloxUsername),
                }
                : null,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load user profile.' },
            { status: 500 },
        );
    }
}
