import { supabase } from './supabase';
import { buildStaffBlockServerComponents } from './staffActionComponents';

const STAFF_ACTION_FORUM_CHANNEL_ID = '1507564385445613749';
const DISCORD_EPOCH = 1420070400000n;

type DiscordEmbedField = {
    name: string;
    value: string;
    inline?: boolean;
};

type DiscordEmbed = {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    thumbnail?: { url: string };
    fields?: DiscordEmbedField[];
    footer?: { text: string };
    timestamp?: string;
};

type DiscordUser = {
    id: string;
    username?: string;
    discriminator?: string;
    global_name?: string | null;
    avatar?: string | null;
};

type DiscordGuildMember = {
    user?: DiscordUser;
    roles?: string[];
    joined_at?: string;
};

type RobloxSearchUser = {
    id: number;
    name?: string;
    displayName?: string;
};

type RobloxSearchResponse = {
    data?: RobloxSearchUser[];
};

type RobloxCloudProfile = {
    about?: string;
    createTime?: string;
};

type RobloxLegacyProfile = {
    id?: number;
    name?: string;
    displayName?: string;
    description?: string;
    created?: string;
    isBanned?: boolean;
};

type RobloxThumbnailResponse = {
    data?: Array<{ imageUrl?: string }>;
};

type LiveServerRecord = {
    id?: string;
    players?: unknown;
};

type DiscordThreadResponse = {
    id: string;
    name: string;
};

type StaffActionNotificationInput = {
    actionType: 'removed' | 'blocked';
    actionId: string;
    guildId: string;
    guildName?: string | null;
    ownerId?: string | null;
    staffDiscordId: string;
    reason?: string | null;
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function truncateText(value: unknown, maxLength = 1024) {
    const text = trimString(value);
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatDiscordTimestamp(value: unknown, style = 'f') {
    const timestamp = Date.parse(trimString(value));
    if (Number.isNaN(timestamp)) return 'Unknown';
    return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function getDiscordCreatedAt(discordId: string) {
    try {
        const timestamp = Number((BigInt(discordId) >> 22n) + DISCORD_EPOCH);
        return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
    } catch {
        return '';
    }
}

function formatDiscordUserTag(discordUser?: DiscordUser | null) {
    if (!discordUser?.username) return 'Unknown User';
    return discordUser.discriminator && discordUser.discriminator !== '0'
        ? `${discordUser.username}#${discordUser.discriminator}`
        : `@${discordUser.username}`;
}

function discordAvatarUrl(user?: DiscordUser | null) {
    if (!user?.id || !user.avatar) return '';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getLivePlayerScore(record: Record<string, unknown>) {
    let score = 0;
    if (trimString(record.username || record.name)) score += 2;
    if (trimString(record.displayName)) score += 1;
    if (trimString(record.userId || record.id)) score += 1;
    if (trimString(record.avatarUrl || record.thumbnailUrl || record.characterThumbnail || record.headshotUrl)) score += 1;
    return score;
}

function unwrapLivePlayerObject(value: unknown, seen = new WeakSet<object>()): Record<string, unknown> | null {
    if (!isRecord(value) || seen.has(value)) return null;

    seen.add(value);
    const currentScore = getLivePlayerScore(value);
    let bestMatch: Record<string, unknown> | null = currentScore > 0 ? value : null;
    let bestScore = currentScore;

    for (const nestedValue of Object.values(value)) {
        if (!isRecord(nestedValue)) continue;
        const nestedMatch = unwrapLivePlayerObject(nestedValue, seen);
        if (!nestedMatch) continue;
        const nestedScore = getLivePlayerScore(nestedMatch);
        if (nestedScore > bestScore) {
            bestMatch = nestedMatch;
            bestScore = nestedScore;
        }
    }

    return bestMatch;
}

function collectNestedLivePlayerEntries(value: unknown, depth = 0): unknown[] {
    if (depth > 3) return [];
    if (Array.isArray(value)) return value.flatMap((entry) => collectNestedLivePlayerEntries(entry, depth + 1));
    if (!isRecord(value)) return [];
    if (getLivePlayerScore(value) > 0) return [value];
    return Object.values(value).flatMap((entry) => collectNestedLivePlayerEntries(entry, depth + 1));
}

function toRawLivePlayerEntries(rawPlayers: unknown) {
    if (Array.isArray(rawPlayers)) return rawPlayers;
    if (!isRecord(rawPlayers)) return [];
    if (getLivePlayerScore(rawPlayers) > 0) return [rawPlayers];
    const nestedEntries = Object.values(rawPlayers).flatMap((entry) => collectNestedLivePlayerEntries(entry));
    return nestedEntries.length > 0 ? nestedEntries : Object.values(rawPlayers);
}

function normalizeLivePlayer(rawPlayer: unknown) {
    if (typeof rawPlayer === 'string') {
        const username = rawPlayer.trim();
        return username ? { username, userId: null } : null;
    }

    const player = unwrapLivePlayerObject(rawPlayer);
    if (!player) return null;

    const username = trimString(player.username || player.name);
    if (!username) return null;

    return {
        username,
        userId: trimString(player.userId || player.id) || null,
    };
}

function findLivePlayerInList(rawPlayers: unknown, identity: string) {
    const normalizedIdentity = identity.trim().toLowerCase();
    if (!normalizedIdentity) return null;

    return toRawLivePlayerEntries(rawPlayers)
        .map((entry) => normalizeLivePlayer(entry))
        .find((player) =>
            player
            && (
                player.username.toLowerCase() === normalizedIdentity
                || (player.userId ? player.userId.toLowerCase() === normalizedIdentity : false)
            )
        ) || null;
}

async function findActiveRobloxJobId(guildId: string, username: string, robloxId: string | number) {
    const { data } = await supabase
        .from('live_servers')
        .select('id, players')
        .eq('server_id', guildId);

    const liveServers = Array.isArray(data) ? data as LiveServerRecord[] : [];
    const activeServer = liveServers.find((server) =>
        findLivePlayerInList(server.players, username)
        || findLivePlayerInList(server.players, String(robloxId))
    );

    return trimString(activeServer?.id) || null;
}

async function discordApiFetch<T>(botToken: string, path: string, init: RequestInit = {}) {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
        ...init,
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Discord API ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    if (response.status === 204) return null as T;
    return await response.json() as T;
}

async function fetchDiscordUser(botToken: string, userId: string) {
    if (!userId) return null;
    return await discordApiFetch<DiscordUser>(botToken, `/users/${encodeURIComponent(userId)}`).catch(() => null);
}

async function fetchDiscordGuildMember(botToken: string, guildId: string, userId: string) {
    if (!guildId || !userId) return null;
    return await discordApiFetch<DiscordGuildMember>(
        botToken,
        `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`
    ).catch(() => null);
}

async function fetchRobloxProfile(username: string, guildId: string) {
    const searchUsername = trimString(username);
    if (!searchUsername) return null;

    const { data: serverSettings } = await supabase
        .from('servers')
        .select('open_cloud_key')
        .eq('id', guildId)
        .maybeSingle();

    const apiKey = typeof serverSettings?.open_cloud_key === 'string'
        ? serverSettings.open_cloud_key.trim()
        : '';

    const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(searchUsername)}&limit=10`, {
        headers: { 'User-Agent': 'Ro-Link Staff Action Notifier/1.0' },
    });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json().catch(() => null) as RobloxSearchResponse | null;
    const matches = Array.isArray(searchData?.data) ? searchData.data : [];
    const exactMatch = matches.find((candidate) =>
        String(candidate?.name || '').toLowerCase() === searchUsername.toLowerCase()
    );
    const matchedUser = exactMatch || matches[0];
    if (!matchedUser?.id) return null;

    let cloudProfile: RobloxCloudProfile | null = null;
    if (apiKey) {
        const cloudRes = await fetch(`https://apis.roblox.com/cloud/v2/users/${matchedUser.id}`, {
            headers: { 'x-api-key': apiKey },
        }).catch(() => null);
        if (cloudRes?.ok) {
            cloudProfile = await cloudRes.json().catch(() => null) as RobloxCloudProfile | null;
        }
    }

    const [legacyProfile, thumbnailData] = await Promise.all([
        fetch(`https://users.roblox.com/v1/users/${matchedUser.id}`, {
            headers: { 'User-Agent': 'Ro-Link Staff Action Notifier/1.0' },
        }).then((response) => response.ok ? response.json() as Promise<RobloxLegacyProfile> : null).catch(() => null),
        fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${matchedUser.id}&size=150x150&format=Png&isCircular=false`, {
            headers: { 'User-Agent': 'Ro-Link Staff Action Notifier/1.0' },
        }).then((response) => response.ok ? response.json() as Promise<RobloxThumbnailResponse> : { data: [] }).catch(() => ({ data: [] })),
    ]);

    if (!legacyProfile?.id && !matchedUser?.id) return null;

    const jobId = await findActiveRobloxJobId(guildId, legacyProfile?.name || matchedUser.name || searchUsername, matchedUser.id);

    return {
        id: matchedUser.id,
        username: legacyProfile?.name || matchedUser.name || searchUsername,
        displayName: legacyProfile?.displayName || matchedUser.displayName || legacyProfile?.name || searchUsername,
        description: legacyProfile?.description || cloudProfile?.about || '',
        created: legacyProfile?.created || cloudProfile?.createTime || '',
        isBanned: Boolean(legacyProfile?.isBanned),
        avatarUrl: thumbnailData?.data?.[0]?.imageUrl || '',
        inGame: Boolean(jobId),
        jobId,
    };
}

async function buildOwnerLookupEmbeds(botToken: string, guildId: string, ownerId: string): Promise<DiscordEmbed[]> {
    const [member, fallbackUser, verifiedUserRes] = await Promise.all([
        fetchDiscordGuildMember(botToken, guildId, ownerId),
        fetchDiscordUser(botToken, ownerId),
        supabase
            .from('verified_users')
            .select('*')
            .eq('discord_id', ownerId)
            .maybeSingle(),
    ]);

    const discordUser = member?.user || fallbackUser;
    const verifiedUser = verifiedUserRes.data;
    const embeds: DiscordEmbed[] = [];

    if (discordUser || ownerId) {
        const createdAt = getDiscordCreatedAt(ownerId);
        const linkedRoblox = verifiedUser
            ? `[${verifiedUser.roblox_username}](https://www.roblox.com/users/${verifiedUser.roblox_id}/profile)\n\`ID: ${verifiedUser.roblox_id}\``
            : 'No linked Roblox account found.';

        const discordEmbed: DiscordEmbed = {
            title: `Discord User Info: ${formatDiscordUserTag(discordUser)}`,
            color: 0x0ea5e9,
            fields: [
                { name: 'Discord User', value: `<@${ownerId}>`, inline: true },
                { name: 'Username', value: truncateText(formatDiscordUserTag(discordUser), 256), inline: true },
                { name: 'Discord ID', value: `\`${ownerId}\``, inline: true },
                { name: 'Account Created', value: createdAt ? formatDiscordTimestamp(createdAt, 'F') : 'Unknown', inline: true },
                { name: 'Joined Server', value: member?.joined_at ? formatDiscordTimestamp(member.joined_at, 'F') : 'Not in server or unknown', inline: true },
                { name: 'Server Roles', value: `${Array.isArray(member?.roles) ? member.roles.length : 0}`, inline: true },
                { name: 'Linked Roblox', value: linkedRoblox, inline: false },
            ],
        };

        const avatarUrl = discordAvatarUrl(discordUser);
        if (avatarUrl) discordEmbed.thumbnail = { url: avatarUrl };
        embeds.push(discordEmbed);
    }

    if (verifiedUser?.roblox_username) {
        const robloxProfile = await fetchRobloxProfile(verifiedUser.roblox_username, guildId);
        const robloxId = robloxProfile?.id || verifiedUser.roblox_id;
        const robloxUsername = robloxProfile?.username || verifiedUser.roblox_username;
        const profileUrl = `https://www.roblox.com/users/${robloxId}/profile`;

        const robloxEmbed: DiscordEmbed = {
            title: `Roblox Profile Info: ${robloxUsername}`,
            url: profileUrl,
            color: robloxProfile?.isBanned ? 0xef4444 : 0x0ea5e9,
            thumbnail: {
                url: robloxProfile?.avatarUrl || `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`,
            },
            fields: [
                { name: 'Username', value: `[${robloxUsername}](${profileUrl})`, inline: true },
                { name: 'Display Name', value: truncateText(robloxProfile?.displayName || robloxUsername, 256), inline: true },
                { name: 'Roblox ID', value: `\`${robloxId}\``, inline: true },
                { name: 'Account Created', value: robloxProfile?.created ? formatDiscordTimestamp(robloxProfile.created, 'F') : 'Unknown', inline: true },
                { name: 'Status', value: robloxProfile?.isBanned ? 'Banned' : robloxProfile?.inGame ? 'In Game' : 'Offline', inline: true },
                { name: 'Description', value: truncateText(robloxProfile?.description || 'No description provided.', 1024), inline: false },
            ],
        };

        if (robloxProfile?.inGame && robloxProfile.jobId) {
            robloxEmbed.fields?.push({
                name: 'Live Server',
                value: `User is active in job \`${robloxProfile.jobId}\``,
                inline: false,
            });
        }
        embeds.push(robloxEmbed);
    }

    return embeds;
}

export async function createStaffActionForumThread(input: StaffActionNotificationInput) {
    const botToken = trimString(process.env.DISCORD_TOKEN);
    if (!botToken) {
        throw new Error('Missing DISCORD_TOKEN.');
    }

    const actionId = truncateText(input.actionId, 100) || input.guildId;
    const staffDiscordId = trimString(input.staffDiscordId);
    const ownerId = trimString(input.ownerId);
    const reason = truncateText(input.reason || 'No reason provided.', 1024);
    const guildName = truncateText(input.guildName || 'Unknown Server', 256);
    const actionLabel = input.actionType === 'blocked' ? 'Server Blocked' : 'Server Removed';
    const actionColor = input.actionType === 'blocked' ? 0xdc2626 : 0xef4444;
    const lookupEmbeds = ownerId ? await buildOwnerLookupEmbeds(botToken, input.guildId, ownerId) : [];
    const components = input.actionType === 'removed'
        ? buildStaffBlockServerComponents(input.guildId, ownerId)
        : [];

    const embeds: DiscordEmbed[] = [
        {
            title: actionLabel,
            color: actionColor,
            fields: [
                { name: 'Action ID', value: `\`${actionId}\``, inline: true },
                { name: 'Server', value: `${guildName}\n\`${input.guildId}\``, inline: true },
                { name: 'Server Owner', value: ownerId ? `<@${ownerId}>\n\`${ownerId}\`` : 'Unknown', inline: true },
                { name: 'Staff Member', value: staffDiscordId ? `<@${staffDiscordId}>\n\`${staffDiscordId}\`` : 'Unknown', inline: true },
                { name: 'Reason', value: reason, inline: false },
            ],
            timestamp: new Date().toISOString(),
        },
        ...lookupEmbeds,
        {
            title: 'Evidence Required',
            description: staffDiscordId
                ? `<@${staffDiscordId}>, post any evidence for this action in this forum thread/post.`
                : 'Post any evidence for this action in this forum thread/post.',
            color: 0xf59e0b,
        },
    ].slice(0, 10);

    return await discordApiFetch<DiscordThreadResponse>(botToken, `/channels/${STAFF_ACTION_FORUM_CHANNEL_ID}/threads`, {
        method: 'POST',
        body: JSON.stringify({
            name: actionId,
            auto_archive_duration: 10080,
            message: {
                content: staffDiscordId ? `<@${staffDiscordId}>` : undefined,
                embeds,
                components: components.length > 0 ? components : undefined,
                allowed_mentions: staffDiscordId ? { users: [staffDiscordId] } : { parse: [] },
            },
        }),
    });
}
