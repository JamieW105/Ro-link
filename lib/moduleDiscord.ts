const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';

const ADMINISTRATOR_PERMISSION = 0x8n;
const VIEW_CHANNEL_PERMISSION = 0x400n;
const SEND_MESSAGES_PERMISSION = 0x800n;

type DiscordGuildRecord = {
    id: string;
    owner_id: string;
};

type DiscordRoleRecord = {
    id: string;
    permissions?: string;
};

type DiscordMemberRecord = {
    roles?: string[];
};

type DiscordUserRecord = {
    id: string;
};

type DiscordChannelOverwrite = {
    id: string;
    allow?: string;
    deny?: string;
};

type DiscordChannelRecord = {
    id: string;
    name?: string;
    type: number;
    position?: number;
    guild_id?: string;
    permission_overwrites?: DiscordChannelOverwrite[];
};

type DiscordEmbedPayload = {
    title?: string;
    description?: string;
    color?: number;
    image?: { url: string };
    footer?: { text: string; icon_url?: string };
};

export type ModuleDiscordMessagePayload = {
    content?: string;
    embeds?: DiscordEmbedPayload[];
};

export type SendableDiscordChannel = {
    id: string;
    name: string;
    type: number;
    position: number;
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function clampText(value: unknown, maxLength: number) {
    const text = trimString(value);
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function parsePermissionBits(value?: string | null) {
    try {
        return BigInt(value || '0');
    } catch {
        return 0n;
    }
}

function normalizeSnowflake(value: unknown) {
    const text = trimString(value);
    return /^\d{5,32}$/.test(text) ? text : '';
}

function normalizeUrl(value: unknown) {
    const text = trimString(value);
    if (!/^https?:\/\//i.test(text)) {
        return '';
    }
    return text.length > 2048 ? text.slice(0, 2048) : text;
}

function readField(source: Record<string, unknown>, names: string[]) {
    for (const name of names) {
        if (source[name] !== undefined && source[name] !== null) {
            return source[name];
        }
    }
    return undefined;
}

function getBotToken() {
    const token = trimString(process.env.DISCORD_TOKEN);
    if (!token) {
        throw new Error('Missing DISCORD_TOKEN');
    }
    return token;
}

async function fetchDiscordResource<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
        ...init,
        headers: {
            Authorization: `Bot ${getBotToken()}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = typeof errorBody?.message === 'string'
            ? errorBody.message
            : `Discord API request failed with ${response.status}`;
        const error = new Error(message);
        (error as Error & { status?: number }).status = response.status;
        throw error;
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return await response.json() as T;
}

function computeBasePermissions(
    guildId: string,
    guild: DiscordGuildRecord,
    roles: DiscordRoleRecord[],
    member: DiscordMemberRecord,
    botUserId: string,
) {
    if (guild.owner_id === botUserId) {
        return ADMINISTRATOR_PERMISSION;
    }

    const memberRoleIds = new Set<string>(Array.isArray(member.roles) ? member.roles : []);
    let permissions = 0n;

    for (const role of roles) {
        if (role.id === guildId || memberRoleIds.has(role.id)) {
            permissions |= parsePermissionBits(role.permissions);
        }
    }

    return permissions;
}

function canBotSendToChannel(
    guildId: string,
    botUserId: string,
    basePermissions: bigint,
    member: DiscordMemberRecord,
    channel: DiscordChannelRecord,
) {
    if ((basePermissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION) {
        return true;
    }

    let permissions = basePermissions;
    const overwrites = Array.isArray(channel.permission_overwrites) ? channel.permission_overwrites : [];

    const everyoneOverwrite = overwrites.find((overwrite) => overwrite.id === guildId);
    if (everyoneOverwrite) {
        permissions &= ~parsePermissionBits(everyoneOverwrite.deny);
        permissions |= parsePermissionBits(everyoneOverwrite.allow);
    }

    let roleDeny = 0n;
    let roleAllow = 0n;
    const memberRoleIds = new Set<string>(Array.isArray(member.roles) ? member.roles : []);
    for (const overwrite of overwrites) {
        if (overwrite.id !== guildId && memberRoleIds.has(overwrite.id)) {
            roleDeny |= parsePermissionBits(overwrite.deny);
            roleAllow |= parsePermissionBits(overwrite.allow);
        }
    }

    permissions &= ~roleDeny;
    permissions |= roleAllow;

    const memberOverwrite = overwrites.find((overwrite) => overwrite.id === botUserId);
    if (memberOverwrite) {
        permissions &= ~parsePermissionBits(memberOverwrite.deny);
        permissions |= parsePermissionBits(memberOverwrite.allow);
    }

    const canView = (permissions & VIEW_CHANNEL_PERMISSION) === VIEW_CHANNEL_PERMISSION;
    const canSend = (permissions & SEND_MESSAGES_PERMISSION) === SEND_MESSAGES_PERMISSION;
    return canView && canSend;
}

async function getBotGuildContext(guildId: string) {
    const botUser = await fetchDiscordResource<DiscordUserRecord>('/users/@me');
    const botUserId = normalizeSnowflake(botUser.id);

    const [guild, roles, channels, member] = await Promise.all([
        fetchDiscordResource<DiscordGuildRecord>(`/guilds/${encodeURIComponent(guildId)}`),
        fetchDiscordResource<DiscordRoleRecord[]>(`/guilds/${encodeURIComponent(guildId)}/roles`),
        fetchDiscordResource<DiscordChannelRecord[]>(`/guilds/${encodeURIComponent(guildId)}/channels`),
        fetchDiscordResource<DiscordMemberRecord>(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(botUserId)}`),
    ]);

    const basePermissions = computeBasePermissions(
        guildId,
        guild,
        Array.isArray(roles) ? roles : [],
        member,
        botUserId,
    );

    return {
        botUserId,
        guild,
        member,
        basePermissions,
        channels: Array.isArray(channels) ? channels : [],
    };
}

export async function listSendableDiscordChannels(guildId: string) {
    const context = await getBotGuildContext(guildId);

    return context.channels
        .filter((channel) => channel.type === 0 || channel.type === 5)
        .filter((channel) => canBotSendToChannel(
            guildId,
            context.botUserId,
            context.basePermissions,
            context.member,
            channel,
        ))
        .sort((left, right) => (left.position || 0) - (right.position || 0))
        .map((channel) => ({
            id: channel.id,
            name: trimString(channel.name) || channel.id,
            type: channel.type,
            position: channel.position || 0,
        } satisfies SendableDiscordChannel));
}

export async function assertSendableDiscordChannel(guildId: string, channelId: unknown) {
    const normalizedChannelId = normalizeSnowflake(channelId);
    if (!normalizedChannelId) {
        throw new Error('A valid Discord channel ID is required.');
    }

    const channels = await listSendableDiscordChannels(guildId);
    const channel = channels.find((candidate) => candidate.id === normalizedChannelId);
    if (!channel) {
        const error = new Error('The channel is not a sendable channel in this server.');
        (error as Error & { status?: number }).status = 403;
        throw error;
    }

    return channel;
}

export async function getDiscordGuildOwnerId(guildId: string) {
    const guild = await fetchDiscordResource<DiscordGuildRecord>(`/guilds/${encodeURIComponent(guildId)}`);
    return normalizeSnowflake(guild.owner_id);
}

export async function assertDiscordGuildMember(guildId: string, userId: unknown) {
    const normalizedUserId = normalizeSnowflake(userId);
    if (!normalizedUserId) {
        throw new Error('A valid Discord user ID is required.');
    }

    await fetchDiscordResource<DiscordMemberRecord>(
        `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(normalizedUserId)}`,
    );

    return normalizedUserId;
}

export async function createDiscordDmChannel(userId: string) {
    const channel = await fetchDiscordResource<{ id: string }>('/users/@me/channels', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId }),
    });

    const channelId = normalizeSnowflake(channel?.id);
    if (!channelId) {
        throw new Error('Discord did not return a DM channel.');
    }

    return channelId;
}

export function normalizeModuleDiscordMessage(content: unknown): ModuleDiscordMessagePayload {
    const source = typeof content === 'object' && content !== null
        ? content as Record<string, unknown>
        : { PlainText: content };

    const plainText = clampText(
        readField(source, ['PlainText', 'plainText', 'Text', 'text', 'content', 'Content']),
        2000,
    );

    const embedSource = readField(source, ['Embed', 'embed']);
    const embeds: DiscordEmbedPayload[] = [];
    if (typeof embedSource === 'object' && embedSource !== null) {
        const embedObject = embedSource as Record<string, unknown>;
        const embed: DiscordEmbedPayload = {};

        const title = clampText(readField(embedObject, ['Title', 'title']), 256);
        const description = clampText(readField(embedObject, ['Content', 'content', 'Description', 'description']), 4096);
        const mediaValue = readField(embedObject, ['Media', 'media', 'Image', 'image']);
        const mediaUrl = typeof mediaValue === 'object' && mediaValue !== null
            ? normalizeUrl(readField(mediaValue as Record<string, unknown>, ['url', 'Url', 'URL']))
            : normalizeUrl(mediaValue);
        const footerValue = readField(embedObject, ['Footer', 'footer', 'Footor', 'footor']);
        const footerText = typeof footerValue === 'object' && footerValue !== null
            ? clampText(readField(footerValue as Record<string, unknown>, ['Text', 'text', 'Content', 'content']), 2048)
            : clampText(footerValue, 2048);
        const footerIconValue = typeof footerValue === 'object' && footerValue !== null
            ? readField(footerValue as Record<string, unknown>, ['Icon', 'icon', 'icon_url'])
            : readField(embedObject, ['Icon', 'icon', 'FooterIcon', 'footerIcon']);
        const footerIconUrl = normalizeUrl(footerIconValue);

        if (title) embed.title = title;
        if (description) embed.description = description;
        if (mediaUrl) embed.image = { url: mediaUrl };
        if (footerText) {
            embed.footer = { text: footerText };
            if (footerIconUrl) embed.footer.icon_url = footerIconUrl;
        }

        const color = Number(readField(embedObject, ['Color', 'color']));
        if (Number.isInteger(color) && color >= 0 && color <= 0xffffff) {
            embed.color = color;
        }

        if (embed.title || embed.description || embed.image || embed.footer) {
            embeds.push(embed);
        }
    }

    if (!plainText && embeds.length === 0) {
        throw new Error('Message content must include PlainText or Embed.');
    }

    return {
        ...(plainText ? { content: plainText } : {}),
        ...(embeds.length > 0 ? { embeds } : {}),
    };
}

export async function sendDiscordMessage(channelId: string, payload: ModuleDiscordMessagePayload) {
    return await fetchDiscordResource<{ id: string }>(
        `/channels/${encodeURIComponent(channelId)}/messages`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        },
    );
}

