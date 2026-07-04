import { getSupabaseAdmin } from './supabaseAdmin';
import type { StaffModerationActionRecord } from './staffModerationActions';

const PUBLIC_REPORT_FORUM_CHANNEL_ID = '1522776711677218857';
const DISCORD_EPOCH = 1420070400000n;

export type PublicReportTargetType = 'ROBLOX_USER' | 'DISCORD_USER' | 'DISCORD_SERVER' | 'ROBLOX_GAME';

export const PUBLIC_REPORT_TAG_IDS: Record<PublicReportTargetType, string> = {
    ROBLOX_USER: '1522776878094614678',
    DISCORD_USER: '1522776939549687858',
    DISCORD_SERVER: '1522777082688569525',
    ROBLOX_GAME: '1522777599594598531',
};

export type PublicReportRecord = {
    id: string;
    reporter_discord_id: string;
    reporter_discord_tag?: string | null;
    reporter_roblox_id?: string | null;
    reporter_roblox_username?: string | null;
    target_type: PublicReportTargetType;
    target_id: string;
    reason: string;
    evidence_links?: string[] | null;
    discord_thread_id?: string | null;
    discord_thread_url?: string | null;
    created_at?: string | null;
};

type SupabaseClientLike = ReturnType<typeof getSupabaseAdmin>;

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
    image?: { url: string };
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

type DiscordGuild = {
    id: string;
    name?: string;
    icon?: string | null;
    owner_id?: string | null;
    description?: string | null;
    approximate_member_count?: number;
    approximate_presence_count?: number;
    features?: string[];
};

type DiscordThreadResponse = {
    id: string;
    name?: string;
    guild_id?: string;
};

type VerifiedUserRecord = {
    discord_id?: string | null;
    roblox_id?: string | number | null;
    roblox_username?: string | null;
};

type RobloxUserProfile = {
    id?: number;
    name?: string;
    displayName?: string;
    description?: string;
    created?: string;
    isBanned?: boolean;
    avatarUrl?: string;
};

type RobloxThumbnailResponse = {
    data?: Array<{ imageUrl?: string }>;
};

type RobloxUniverseResponse = {
    universeId?: number | string;
};

type RobloxGameDetailsResponse = {
    data?: RobloxGameDetails[];
};

type RobloxGameDetails = {
    id?: number;
    rootPlaceId?: number;
    name?: string;
    description?: string;
    creator?: {
        id?: number;
        name?: string;
        type?: string;
    };
    playing?: number;
    visits?: number;
    maxPlayers?: number;
    created?: string;
    updated?: string;
};

type ReporterLookup = {
    discordUser: DiscordUser | null;
    verifiedUser: VerifiedUserRecord | null;
    robloxUser: RobloxUserProfile | null;
};

type TargetLookup =
    | {
        type: 'DISCORD_USER';
        discordUser: DiscordUser | null;
        verifiedUser: VerifiedUserRecord | null;
        robloxUser: RobloxUserProfile | null;
    }
    | {
        type: 'ROBLOX_USER';
        robloxUser: RobloxUserProfile | null;
        verifiedUser: VerifiedUserRecord | null;
    }
    | {
        type: 'DISCORD_SERVER';
        guild: DiscordGuild | null;
        serverRow: Record<string, unknown> | null;
        blockedRow: Record<string, unknown> | null;
        moderationAction: StaffModerationActionRecord | null;
    }
    | {
        type: 'ROBLOX_GAME';
        placeId: string;
        universeId: string | null;
        game: RobloxGameDetails | null;
        iconUrl: string;
        serverRows: Record<string, unknown>[];
    };

export type PublicReportForumContext = {
    reporterLookup: ReporterLookup;
    targetLookup: TargetLookup;
    previousReportIds: string[];
    lastReporterModeration: StaffModerationActionRecord | null;
};

function trimString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function truncateText(value: unknown, maxLength = 1024) {
    const text = trimString(value);
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatInlineCode(value: unknown, maxLength = 120) {
    const text = truncateText(value, maxLength).replace(/`/g, "'");
    return text ? `\`${text}\`` : '`Unknown`';
}

function formatNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('en-US') : 'Unknown';
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
    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.${extension}?size=256`;
}

function discordGuildIconUrl(guild?: DiscordGuild | null) {
    if (!guild?.id || !guild.icon) return '';
    const extension = guild.icon.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${encodeURIComponent(guild.id)}/${encodeURIComponent(guild.icon)}.${extension}?size=256`;
}

function normalizeHeaders(headers: HeadersInit | undefined) {
    const normalized: Record<string, string> = {};
    if (!headers) return normalized;

    if (headers instanceof Headers) {
        headers.forEach((value, key) => {
            normalized[key] = value;
        });
        return normalized;
    }

    if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
            normalized[String(key)] = String(value);
        }
        return normalized;
    }

    return headers as Record<string, string>;
}

async function discordApiFetch<T>(botToken: string, path: string, init: RequestInit = {}) {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
        ...init,
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
            ...normalizeHeaders(init.headers),
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Discord API ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    if (response.status === 204) return null as T;
    return await response.json() as T;
}

async function fetchDiscordUser(botToken: string, userId: string) {
    if (!botToken || !userId) return null;
    return await discordApiFetch<DiscordUser>(botToken, `/users/${encodeURIComponent(userId)}`).catch(() => null);
}

async function fetchDiscordGuild(botToken: string, guildId: string) {
    if (!botToken || !guildId) return null;
    return await discordApiFetch<DiscordGuild>(
        botToken,
        `/guilds/${encodeURIComponent(guildId)}?with_counts=true`,
    ).catch(() => null);
}

async function robloxApiFetch<T>(url: string) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Ro-Link Public Reporter/1.0' },
        cache: 'no-store',
    }).catch(() => null);

    if (!response?.ok) return null;
    return await response.json().catch(() => null) as T | null;
}

async function fetchRobloxUserById(userId: string) {
    const normalizedUserId = trimString(userId);
    if (!normalizedUserId) return null;

    const profile = await robloxApiFetch<RobloxUserProfile>(
        `https://users.roblox.com/v1/users/${encodeURIComponent(normalizedUserId)}`,
    );
    if (!profile?.id) return null;

    const thumbnailData = await robloxApiFetch<RobloxThumbnailResponse>(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(String(profile.id))}&size=150x150&format=Png&isCircular=false`,
    );

    return {
        ...profile,
        avatarUrl: thumbnailData?.data?.[0]?.imageUrl || '',
    };
}

async function fetchRobloxGameByPlaceId(placeId: string) {
    const normalizedPlaceId = trimString(placeId);
    if (!normalizedPlaceId) {
        return { universeId: null, game: null, iconUrl: '' };
    }

    const universe = await robloxApiFetch<RobloxUniverseResponse>(
        `https://apis.roblox.com/universes/v1/places/${encodeURIComponent(normalizedPlaceId)}/universe`,
    );
    const universeId = trimString(universe?.universeId);
    if (!universeId) {
        return { universeId: null, game: null, iconUrl: '' };
    }

    const [gameData, thumbnailData] = await Promise.all([
        robloxApiFetch<RobloxGameDetailsResponse>(
            `https://games.roblox.com/v1/games?universeIds=${encodeURIComponent(universeId)}`,
        ),
        robloxApiFetch<RobloxThumbnailResponse>(
            `https://thumbnails.roblox.com/v1/games/icons?universeIds=${encodeURIComponent(universeId)}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
        ),
    ]);

    return {
        universeId,
        game: Array.isArray(gameData?.data) ? gameData.data[0] || null : null,
        iconUrl: thumbnailData?.data?.[0]?.imageUrl || '',
    };
}

async function findVerifiedByDiscordId(client: SupabaseClientLike, discordId: string) {
    if (!discordId) return null;
    const { data, error } = await client
        .from('verified_users')
        .select('discord_id, roblox_id, roblox_username')
        .eq('discord_id', discordId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data as VerifiedUserRecord | null;
}

async function findVerifiedByRobloxId(client: SupabaseClientLike, robloxId: string) {
    if (!robloxId) return null;
    const { data, error } = await client
        .from('verified_users')
        .select('discord_id, roblox_id, roblox_username')
        .eq('roblox_id', robloxId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data as VerifiedUserRecord | null;
}

async function fetchPreviousPublicReportIds(client: SupabaseClientLike, reporterDiscordId: string) {
    const { data, error } = await client
        .from('public_reports')
        .select('id')
        .eq('reporter_discord_id', reporterDiscordId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) throw new Error(error.message);
    return (data || []).map((row: { id?: string }) => trimString(row.id)).filter(Boolean);
}

async function fetchLastReporterModeration(client: SupabaseClientLike, reporterDiscordId: string) {
    const { data, error } = await client
        .from('staff_moderation_actions')
        .select('*')
        .eq('owner_id', reporterDiscordId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.warn('[Public Reports] Failed to load reporter moderation history:', error.message);
        return null;
    }

    return Array.isArray(data) && data[0] ? data[0] as StaffModerationActionRecord : null;
}

async function fetchLastServerModeration(client: SupabaseClientLike, guildId: string) {
    const { data, error } = await client
        .from('staff_moderation_actions')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.warn('[Public Reports] Failed to load server moderation history:', error.message);
        return null;
    }

    return Array.isArray(data) && data[0] ? data[0] as StaffModerationActionRecord : null;
}

async function collectReporterLookup(client: SupabaseClientLike, botToken: string, reporterDiscordId: string): Promise<ReporterLookup> {
    const [discordUser, verifiedUser] = await Promise.all([
        fetchDiscordUser(botToken, reporterDiscordId),
        findVerifiedByDiscordId(client, reporterDiscordId),
    ]);
    const robloxId = trimString(verifiedUser?.roblox_id);
    const robloxUser = robloxId ? await fetchRobloxUserById(robloxId) : null;

    return { discordUser, verifiedUser, robloxUser };
}

async function collectTargetLookup(
    client: SupabaseClientLike,
    botToken: string,
    targetType: PublicReportTargetType,
    targetId: string,
): Promise<TargetLookup> {
    if (targetType === 'DISCORD_USER') {
        const [discordUser, verifiedUser] = await Promise.all([
            fetchDiscordUser(botToken, targetId),
            findVerifiedByDiscordId(client, targetId),
        ]);
        const robloxId = trimString(verifiedUser?.roblox_id);
        const robloxUser = robloxId ? await fetchRobloxUserById(robloxId) : null;

        return { type: targetType, discordUser, verifiedUser, robloxUser };
    }

    if (targetType === 'ROBLOX_USER') {
        const [robloxUser, verifiedUser] = await Promise.all([
            fetchRobloxUserById(targetId),
            findVerifiedByRobloxId(client, targetId),
        ]);

        return { type: targetType, robloxUser, verifiedUser };
    }

    if (targetType === 'DISCORD_SERVER') {
        const [guild, serverResult, blockedResult, moderationAction] = await Promise.all([
            fetchDiscordGuild(botToken, targetId),
            client
                .from('servers')
                .select('id, place_id, universe_id, reports_enabled, logging_channel_id, created_at')
                .eq('id', targetId)
                .maybeSingle(),
            client
                .from('blocked_servers')
                .select('*')
                .eq('guild_id', targetId)
                .maybeSingle(),
            fetchLastServerModeration(client, targetId),
        ]);

        if (serverResult.error) throw new Error(serverResult.error.message);
        if (blockedResult.error) throw new Error(blockedResult.error.message);

        return {
            type: targetType,
            guild,
            serverRow: serverResult.data as Record<string, unknown> | null,
            blockedRow: blockedResult.data as Record<string, unknown> | null,
            moderationAction,
        };
    }

    const gameLookup = await fetchRobloxGameByPlaceId(targetId);
    let serverRows: Record<string, unknown>[] = [];
    if (gameLookup.universeId) {
        const { data, error } = await client
            .from('servers')
            .select('id, place_id, universe_id, created_at')
            .or(`place_id.eq.${targetId},universe_id.eq.${gameLookup.universeId}`);
        if (error) {
            console.warn('[Public Reports] Failed to match Roblox game to Ro-Link servers:', error.message);
        } else {
            serverRows = (data || []) as Record<string, unknown>[];
        }
    }

    return {
        type: targetType,
        placeId: targetId,
        universeId: gameLookup.universeId,
        game: gameLookup.game,
        iconUrl: gameLookup.iconUrl,
        serverRows,
    };
}

export async function collectPublicReportForumContext(input: {
    reporterDiscordId: string;
    targetType: PublicReportTargetType;
    targetId: string;
    client?: SupabaseClientLike;
}): Promise<PublicReportForumContext> {
    const client = input.client || getSupabaseAdmin();
    const botToken = trimString(process.env.DISCORD_TOKEN);

    const [reporterLookup, targetLookup, previousReportIds, lastReporterModeration] = await Promise.all([
        collectReporterLookup(client, botToken, input.reporterDiscordId),
        collectTargetLookup(client, botToken, input.targetType, input.targetId),
        fetchPreviousPublicReportIds(client, input.reporterDiscordId),
        fetchLastReporterModeration(client, input.reporterDiscordId),
    ]);

    return {
        reporterLookup,
        targetLookup,
        previousReportIds,
        lastReporterModeration,
    };
}

export function targetTypeLabel(targetType: PublicReportTargetType) {
    if (targetType === 'ROBLOX_USER') return 'Roblox User';
    if (targetType === 'DISCORD_USER') return 'Discord User';
    if (targetType === 'DISCORD_SERVER') return 'Discord Server';
    return 'Roblox Game';
}

function formatEvidenceLinks(links: string[]) {
    if (links.length === 0) return 'No evidence links provided.';
    return links
        .slice(0, 10)
        .map((link, index) => `[Evidence ${index + 1}](${link})`)
        .join('\n');
}

function formatPreviousReportIds(ids: string[]) {
    if (ids.length === 0) return 'No previous public reports found.';
    return ids.map((id) => formatInlineCode(id, 64)).join('\n');
}

function formatStaffModerationAction(action: StaffModerationActionRecord | null) {
    if (!action) return 'No Ro-Link staff moderation action found.';

    const target = trimString(action.guild_name) || trimString(action.guild_id) || 'Unknown target';
    const reason = truncateText(action.reason || 'No reason provided.', 350);
    return [
        `${action.action_type.toUpperCase()} ${action.status}`,
        `${target} ${formatInlineCode(action.guild_id, 64)}`,
        `Action ID: ${formatInlineCode(action.id, 64)}`,
        `Created: ${formatDiscordTimestamp(action.created_at, 'R')}`,
        `Reason: ${reason}`,
    ].join('\n');
}

function buildLinkedRobloxValue(verifiedUser: VerifiedUserRecord | null, robloxUser: RobloxUserProfile | null) {
    const robloxId = trimString(robloxUser?.id || verifiedUser?.roblox_id);
    const username = trimString(robloxUser?.name || verifiedUser?.roblox_username);
    if (!robloxId && !username) {
        return 'No linked Roblox account found.';
    }

    const label = username || `Roblox ${robloxId}`;
    const link = robloxId ? `[${label}](https://www.roblox.com/users/${encodeURIComponent(robloxId)}/profile)` : label;
    return `${link}${robloxId ? `\nID: ${formatInlineCode(robloxId, 64)}` : ''}`;
}

function buildMainReportEmbed(report: PublicReportRecord): DiscordEmbed {
    const evidenceLinks = Array.isArray(report.evidence_links) ? report.evidence_links : [];
    const targetLabel = targetTypeLabel(report.target_type);
    const firstEvidence = evidenceLinks.find(Boolean);
    const embed: DiscordEmbed = {
        title: `Public Report: ${targetLabel}`,
        color: 0xf97316,
        fields: [
            { name: 'Report ID', value: formatInlineCode(report.id, 80), inline: true },
            { name: 'Target Type', value: targetLabel, inline: true },
            { name: 'Target ID', value: formatInlineCode(report.target_id, 80), inline: true },
            { name: 'Reporter', value: `<@${report.reporter_discord_id}>\n${formatInlineCode(report.reporter_discord_id, 80)}`, inline: true },
            { name: 'Reason', value: truncateText(report.reason || 'No reason provided.', 1024), inline: false },
            { name: 'Evidence', value: truncateText(formatEvidenceLinks(evidenceLinks), 1024), inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Ro-Link Public Reports' },
    };

    if (firstEvidence) {
        embed.image = { url: firstEvidence };
    }

    return embed;
}

function buildReporterEmbed(report: PublicReportRecord, context: PublicReportForumContext): DiscordEmbed {
    const { discordUser, verifiedUser, robloxUser } = context.reporterLookup;
    const createdAt = getDiscordCreatedAt(report.reporter_discord_id);
    const embed: DiscordEmbed = {
        title: 'Reporter Lookup',
        color: 0x0ea5e9,
        fields: [
            { name: 'Discord User', value: `<@${report.reporter_discord_id}>`, inline: true },
            { name: 'Username', value: truncateText(formatDiscordUserTag(discordUser), 256), inline: true },
            { name: 'Discord ID', value: formatInlineCode(report.reporter_discord_id, 80), inline: true },
            { name: 'Account Created', value: createdAt ? formatDiscordTimestamp(createdAt, 'F') : 'Unknown', inline: true },
            { name: 'Linked Roblox', value: truncateText(buildLinkedRobloxValue(verifiedUser, robloxUser), 1024), inline: false },
            { name: 'Previous Report IDs', value: truncateText(formatPreviousReportIds(context.previousReportIds), 1024), inline: false },
            { name: 'Last Ro-Link Moderation', value: truncateText(formatStaffModerationAction(context.lastReporterModeration), 1024), inline: false },
        ],
    };

    const avatarUrl = discordAvatarUrl(discordUser);
    if (avatarUrl) embed.thumbnail = { url: avatarUrl };
    return embed;
}

function buildDiscordUserTargetEmbed(lookup: Extract<TargetLookup, { type: 'DISCORD_USER' }>, targetId: string): DiscordEmbed {
    const createdAt = getDiscordCreatedAt(targetId);
    const embed: DiscordEmbed = {
        title: 'Target Lookup: Discord User',
        color: lookup.discordUser ? 0x5865f2 : 0xef4444,
        fields: [
            { name: 'Discord User', value: `<@${targetId}>`, inline: true },
            { name: 'Username', value: truncateText(formatDiscordUserTag(lookup.discordUser), 256), inline: true },
            { name: 'Discord ID', value: formatInlineCode(targetId, 80), inline: true },
            { name: 'Account Created', value: createdAt ? formatDiscordTimestamp(createdAt, 'F') : 'Unknown', inline: true },
            { name: 'Linked Roblox', value: truncateText(buildLinkedRobloxValue(lookup.verifiedUser, lookup.robloxUser), 1024), inline: false },
        ],
        description: lookup.discordUser ? undefined : 'Discord user lookup failed or the user was not visible to the bot.',
    };

    const avatarUrl = discordAvatarUrl(lookup.discordUser);
    if (avatarUrl) embed.thumbnail = { url: avatarUrl };
    return embed;
}

function buildRobloxUserTargetEmbed(lookup: Extract<TargetLookup, { type: 'ROBLOX_USER' }>, targetId: string): DiscordEmbed {
    const robloxUser = lookup.robloxUser;
    const robloxId = trimString(robloxUser?.id || targetId);
    const username = trimString(robloxUser?.name) || `Roblox ${targetId}`;
    const profileUrl = `https://www.roblox.com/users/${encodeURIComponent(robloxId)}/profile`;
    const linkedDiscordId = trimString(lookup.verifiedUser?.discord_id);
    const embed: DiscordEmbed = {
        title: 'Target Lookup: Roblox User',
        url: profileUrl,
        color: robloxUser?.isBanned ? 0xef4444 : robloxUser ? 0x0ea5e9 : 0xef4444,
        fields: [
            { name: 'Username', value: robloxUser ? `[${username}](${profileUrl})` : 'Lookup failed', inline: true },
            { name: 'Display Name', value: truncateText(robloxUser?.displayName || username, 256), inline: true },
            { name: 'Roblox ID', value: formatInlineCode(robloxId, 80), inline: true },
            { name: 'Account Created', value: robloxUser?.created ? formatDiscordTimestamp(robloxUser.created, 'F') : 'Unknown', inline: true },
            { name: 'Status', value: robloxUser?.isBanned ? 'Banned' : robloxUser ? 'Active or private' : 'Unknown', inline: true },
            { name: 'Linked Discord', value: linkedDiscordId ? `<@${linkedDiscordId}>\n${formatInlineCode(linkedDiscordId, 80)}` : 'No linked Discord account found.', inline: false },
            { name: 'Description', value: truncateText(robloxUser?.description || 'No description available.', 1024), inline: false },
        ],
    };

    if (robloxUser?.avatarUrl) embed.thumbnail = { url: robloxUser.avatarUrl };
    return embed;
}

function buildDiscordServerTargetEmbed(lookup: Extract<TargetLookup, { type: 'DISCORD_SERVER' }>, targetId: string): DiscordEmbed {
    const setupValue = lookup.serverRow
        ? [
            'Ro-Link setup found.',
            `Place ID: ${formatInlineCode(lookup.serverRow.place_id, 64)}`,
            `Universe ID: ${formatInlineCode(lookup.serverRow.universe_id, 64)}`,
        ].join('\n')
        : 'No Ro-Link setup row found.';
    const blockedValue = lookup.blockedRow
        ? `Blocked\nReason: ${truncateText(lookup.blockedRow.reason, 350)}`
        : 'Not currently blocked.';
    const embed: DiscordEmbed = {
        title: 'Target Lookup: Discord Server',
        color: lookup.blockedRow ? 0xef4444 : lookup.guild ? 0x5865f2 : 0xf59e0b,
        fields: [
            { name: 'Server', value: truncateText(lookup.guild?.name || 'Unknown Server', 256), inline: true },
            { name: 'Server ID', value: formatInlineCode(targetId, 80), inline: true },
            { name: 'Owner', value: lookup.guild?.owner_id ? `<@${lookup.guild.owner_id}>\n${formatInlineCode(lookup.guild.owner_id, 80)}` : 'Unknown', inline: true },
            { name: 'Members', value: formatNumber(lookup.guild?.approximate_member_count), inline: true },
            { name: 'Presence', value: formatNumber(lookup.guild?.approximate_presence_count), inline: true },
            { name: 'Ro-Link Setup', value: truncateText(setupValue, 1024), inline: false },
            { name: 'Block Status', value: truncateText(blockedValue, 1024), inline: false },
            { name: 'Last Server Moderation', value: truncateText(formatStaffModerationAction(lookup.moderationAction), 1024), inline: false },
        ],
        description: lookup.guild ? truncateText(lookup.guild.description, 512) || undefined : 'Discord guild lookup failed or the bot is not in the server.',
    };

    const iconUrl = discordGuildIconUrl(lookup.guild);
    if (iconUrl) embed.thumbnail = { url: iconUrl };
    return embed;
}

function buildRobloxGameTargetEmbed(lookup: Extract<TargetLookup, { type: 'ROBLOX_GAME' }>): DiscordEmbed {
    const game = lookup.game;
    const gameUrl = `https://www.roblox.com/games/${encodeURIComponent(lookup.placeId)}`;
    const matchedServers = lookup.serverRows
        .slice(0, 10)
        .map((row) => formatInlineCode(row.id, 64))
        .join('\n');
    const embed: DiscordEmbed = {
        title: 'Target Lookup: Roblox Game',
        url: gameUrl,
        color: game ? 0x0ea5e9 : 0xf59e0b,
        fields: [
            { name: 'Game', value: game?.name ? `[${truncateText(game.name, 200)}](${gameUrl})` : 'Lookup failed', inline: true },
            { name: 'Place ID', value: formatInlineCode(lookup.placeId, 80), inline: true },
            { name: 'Universe ID', value: lookup.universeId ? formatInlineCode(lookup.universeId, 80) : 'Unknown', inline: true },
            { name: 'Creator', value: truncateText(game?.creator?.name || 'Unknown', 256), inline: true },
            { name: 'Playing', value: formatNumber(game?.playing), inline: true },
            { name: 'Visits', value: formatNumber(game?.visits), inline: true },
            { name: 'Created', value: game?.created ? formatDiscordTimestamp(game.created, 'F') : 'Unknown', inline: true },
            { name: 'Updated', value: game?.updated ? formatDiscordTimestamp(game.updated, 'R') : 'Unknown', inline: true },
            { name: 'Ro-Link Server Matches', value: matchedServers || 'No Ro-Link server rows matched this game.', inline: false },
            { name: 'Description', value: truncateText(game?.description || 'No description available.', 1024), inline: false },
        ],
    };

    if (lookup.iconUrl) embed.thumbnail = { url: lookup.iconUrl };
    return embed;
}

function buildTargetEmbed(report: PublicReportRecord, context: PublicReportForumContext) {
    const lookup = context.targetLookup;
    if (lookup.type === 'DISCORD_USER') return buildDiscordUserTargetEmbed(lookup, report.target_id);
    if (lookup.type === 'ROBLOX_USER') return buildRobloxUserTargetEmbed(lookup, report.target_id);
    if (lookup.type === 'DISCORD_SERVER') return buildDiscordServerTargetEmbed(lookup, report.target_id);
    return buildRobloxGameTargetEmbed(lookup);
}

function buildThreadName(report: PublicReportRecord) {
    const shortId = trimString(report.id).slice(0, 8);
    const label = targetTypeLabel(report.target_type);
    return truncateText(`${label} ${report.target_id} - ${shortId}`, 100) || `Report ${shortId}`;
}

export function buildPublicReportThreadUrl(thread: DiscordThreadResponse) {
    if (thread.guild_id) {
        return `https://discord.com/channels/${encodeURIComponent(thread.guild_id)}/${encodeURIComponent(thread.id)}`;
    }

    return `https://discord.com/channels/@me/${encodeURIComponent(thread.id)}`;
}

export async function createPublicReportForumThread(input: {
    report: PublicReportRecord;
    context: PublicReportForumContext;
}) {
    const botToken = trimString(process.env.DISCORD_TOKEN);
    if (!botToken) {
        throw new Error('Missing DISCORD_TOKEN.');
    }

    const embeds = [
        buildMainReportEmbed(input.report),
        buildTargetEmbed(input.report, input.context),
        buildReporterEmbed(input.report, input.context),
    ].slice(0, 10);

    return await discordApiFetch<DiscordThreadResponse>(botToken, `/channels/${PUBLIC_REPORT_FORUM_CHANNEL_ID}/threads`, {
        method: 'POST',
        body: JSON.stringify({
            name: buildThreadName(input.report),
            auto_archive_duration: 10080,
            applied_tags: [PUBLIC_REPORT_TAG_IDS[input.report.target_type]],
            message: {
                embeds,
                allowed_mentions: { parse: [] },
            },
        }),
    });
}
