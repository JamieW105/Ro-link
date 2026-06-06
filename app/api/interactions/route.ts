import { after, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';
import { findBlockedServer, getBlockedServerMessage } from '@/lib/blockedServers';
import { logAction } from '@/lib/logger';
import { buildDeliveryArgs, resolveDeliveryTargets, type CommandArgs } from '@/lib/commandDelivery';
import { findLivePlayer, normalizeLivePlayerList, type LivePlayer } from '@/lib/livePlayers';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy } from '@/lib/moderationRoleHierarchy';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildStaffBlockServerComponents, parseStaffBlockServerCustomId } from '@/lib/staffActionComponents';
import discordCommands from '@/lib/discordCommands.json';
import {
    createStaffNote,
    fetchStaffNotes,
    getStaffNoteTargetLabel,
    normalizeStaffNoteTarget,
    type StaffNoteRow,
    type StaffNoteTarget,
} from '@/lib/staffNotes';

export const runtime = 'edge';

// ... (hexToUint8 and verifyDiscordRequest functions) ...

function hexToUint8(hex: string) {
    const cleanHex = hex.trim();
    const matches = cleanHex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array(0);
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

async function verifyDiscordRequest(request: Request) {
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
        console.error('Missing: ', { signature: !!signature, timestamp: !!timestamp, key: !!publicKey });
        return { isValid: false };
    }

    try {
        const body = await request.text();
        const encoder = new TextEncoder();
        const isValid = nacl.sign.detached.verify(
            encoder.encode(timestamp + body),
            hexToUint8(signature),
            hexToUint8(publicKey)
        );

        console.log(`[VERIFY] Result: ${isValid} | TS: ${timestamp}`);
        return { isValid, body };
    } catch (e) {
        console.error('Verify Exception:', e);
        return { isValid: false };
    }
}

type LookupHistoryEntry = {
    id?: string | number | null;
    action?: string | null;
    moderator?: string | null;
    timestamp?: string | null;
    target?: string | null;
};

type RobloxLookupResult = {
    id: number | string;
    username: string;
    displayName: string;
    description: string;
    created: string;
    isBanned: boolean;
    avatarUrl: string;
    hasApiKey: boolean;
    inGame: boolean;
    jobId: string | null;
    moderationHistory: LookupHistoryEntry[];
};

type ReportChannelMode = 'discord' | 'roblox';
type ReportChannelAction =
    | 'switch_discord'
    | 'switch_roblox'
    | 'discord_kick'
    | 'discord_ban'
    | 'roblox_kick'
    | 'roblox_ban'
    | 'dismiss';
type ParsedReportChannelAction = {
    action: ReportChannelAction;
    reportId: string;
    target: string;
};

type DiscordCommandOptionDefinition = {
    name: string;
    description: string;
    type: number;
    required?: boolean;
    options?: DiscordCommandOptionDefinition[];
};

type DiscordCommandDefinition = {
    name: string;
    description: string;
    options?: DiscordCommandOptionDefinition[];
};

type RobloxSearchCandidate = {
    id?: number | string | null;
    name?: string | null;
    displayName?: string | null;
};

type LiveServerRow = {
    id?: string | null;
    players?: unknown;
    player_count?: number | string | null;
    updated_at?: string | null;
};

type DashboardRoleRow = Record<string, boolean | number | string | null | undefined>;

type CommandOptionValue = string | number | boolean;

type CommandOption = {
    name: string;
    type?: number;
    value?: CommandOptionValue;
    options?: CommandOption[];
};

type ModalFieldComponent = {
    custom_id?: string;
    value?: string;
};

type ModalComponentRow = {
    components?: ModalFieldComponent[];
};

type InteractionData = {
    name?: string;
    options?: CommandOption[];
    custom_id?: string;
    components?: ModalComponentRow[];
    values?: string[];
};

type DiscordUser = {
    id: string;
    username: string;
    discriminator?: string | null;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean | null;
};

type DiscordMember = {
    user?: DiscordUser;
    permissions?: string;
    roles?: string[];
};

type InteractionMessageEmbedField = {
    name?: string;
    value?: string;
    inline?: boolean;
};

type DiscordInteractionPayload = {
    id: string;
    application_id?: string | null;
    token?: string | null;
    type: number;
    guild_id?: string | null;
    member?: DiscordMember | null;
    user?: DiscordUser | null;
    data?: InteractionData | null;
    message?: {
        embeds?: Array<{
            fields?: InteractionMessageEmbedField[];
        }>;
    } | null;
};

type MiscCommandArgs = {
    username?: string;
    moderator: string;
    char_user?: string;
    amount?: number;
    moderator_roblox_username?: string;
    team_name?: string;
};

type InteractionResponseData = {
    content?: string;
    embeds?: object[];
    components?: object[];
    flags?: number;
    allowed_mentions?: {
        parse?: string[];
        users?: string[];
        roles?: string[];
        replied_user?: boolean;
    };
};

type LookupInteractionResult = {
    response: InteractionResponseData;
    targetLogStr: string;
};

type InteractionServerRecord = {
    open_cloud_key?: string | null;
    place_id?: string | number | null;
    enforce_moderation_role_hierarchy?: boolean | null;
    [key: string]: unknown;
};

const REPORT_CUSTOM_ID_PREFIX = 'report|';
const commandDefinitions = discordCommands as DiscordCommandDefinition[];
const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DISCORD_EPOCH = 1420070400000n;
const MISC_SUBCOMMAND_TO_COMMAND: Record<string, string> = {
    fly: 'FLY',
    noclip: 'NOCLIP',
    invis: 'INVIS',
    ghost: 'GHOST',
    'set-char': 'SET_CHAR',
    heal: 'HEAL',
    damage: 'DAMAGE',
    'max-health': 'MAX_HEALTH',
    'walk-speed': 'WALK_SPEED',
    'jump-power': 'JUMP_POWER',
    kill: 'KILL',
    reset: 'RESET',
    refresh: 'REFRESH',
    view: 'VIEW',
    team: 'TEAM',
    freeze: 'FREEZE',
    unfreeze: 'UNFREEZE',
    ragdoll: 'RAGDOLL',
    'bring-to-spawn': 'BRING_TO_SPAWN',
    'teleport-to-me': 'TELEPORT_TO_ME',
    'forcefield-add': 'FORCEFIELD_ADD',
    'forcefield-remove': 'FORCEFIELD_REMOVE',
};
const VALUE_INPUT_MISC_COMMANDS = new Set(['DAMAGE', 'MAX_HEALTH', 'WALK_SPEED', 'JUMP_POWER']);
const MODERATION_MENU_ACTIONS = ['BAN', 'KICK', 'UNBAN', 'SOFTBAN', 'UPDATE', 'SHUTDOWN'] as const;
const MODERATION_LOG_ACTIONS = new Set(['BAN', 'KICK', 'UNBAN', 'SOFTBAN', 'DISCORD_BAN', 'DISCORD_KICK', 'TIMEOUT', 'MUTE']);
const SUPER_ADMIN_DISCORD_ID = '953414442060746854';

async function getLinkedRobloxUsername(discordId: string) {
    const normalizedDiscordId = String(discordId ?? '').trim();
    if (!normalizedDiscordId) {
        return '';
    }

    const { data } = await supabase
        .from('verified_users')
        .select('roblox_username')
        .eq('discord_id', normalizedDiscordId)
        .maybeSingle<{ roblox_username?: string | null }>();

    return String(data?.roblox_username ?? '').trim();
}

function buildModerationPanelResponse(): InteractionResponseData {
    return {
        embeds: [{
            title: 'Moderation Actions',
            description: 'Select an action from the menu below.',
            color: 0xef4444,
            fields: [
                { name: 'Player Actions', value: '`BAN` `KICK` `UNBAN` `SOFTBAN`', inline: false },
                { name: 'Server Actions', value: '`UPDATE` `SHUTDOWN`', inline: false },
            ],
            footer: { text: 'Ro-Link Systems - Moderation Tools' },
            timestamp: new Date().toISOString()
        }],
        flags: 64,
        components: [{
            type: 1,
            components: [{
                type: 3,
                custom_id: 'moderation_menu',
                placeholder: 'Choose a moderation action...',
                options: [
                    { label: 'Ban', value: 'BAN', description: 'Permanently ban a Roblox user' },
                    { label: 'Kick', value: 'KICK', description: 'Kick a Roblox user from the server' },
                    { label: 'Unban', value: 'UNBAN', description: 'Lift a Roblox ban' },
                    { label: 'Softban', value: 'SOFTBAN', description: 'Temporarily ban and remove a Roblox user' },
                    { label: 'Update Servers', value: 'UPDATE', description: 'Restart all Roblox servers' },
                    { label: 'Shutdown', value: 'SHUTDOWN', description: 'Shut down Roblox servers' }
                ]
            }]
        }]
    };
}

function getStaffActionEmbedField(
    message: DiscordInteractionPayload['message'] | undefined,
    fieldName: string,
) {
    const normalizedFieldName = fieldName.trim().toLowerCase();
    for (const embed of message?.embeds || []) {
        const field = embed.fields?.find((candidate) =>
            String(candidate.name || '').trim().toLowerCase() === normalizedFieldName
        );
        if (field?.value) return field.value;
    }
    return '';
}

function getStaffActionServerName(message: DiscordInteractionPayload['message'] | undefined) {
    const serverField = getStaffActionEmbedField(message, 'Server');
    const firstLine = serverField.split('\n')[0]?.trim();
    return firstLine && !firstLine.startsWith('`') ? firstLine : '';
}

function getStaffActionReason(message: DiscordInteractionPayload['message'] | undefined) {
    const reason = getStaffActionEmbedField(message, 'Reason')
        .replace(/^`|`$/g, '')
        .trim();
    return reason && reason !== 'No reason provided.' ? reason : '';
}

async function hasGlobalManagementPermission(discordId: string, permission: string) {
    const normalizedDiscordId = String(discordId ?? '').trim();
    if (!normalizedDiscordId) return false;
    if (normalizedDiscordId === SUPER_ADMIN_DISCORD_ID) return true;

    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('management_users')
        .select('role:management_roles(permissions)')
        .eq('discord_id', normalizedDiscordId)
        .maybeSingle();

    if (error || !data) return false;

    const role = Array.isArray(data.role) ? data.role[0] : data.role;
    const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
    return permissions.includes(permission) || permissions.includes('MANAGE_RO_LINK');
}

async function fetchDiscordGuildSnapshot(guildId: string) {
    const botToken = String(process.env.DISCORD_TOKEN ?? '').trim();
    if (!botToken) return null;

    const response = await fetch(`${DISCORD_API_BASE_URL}/guilds/${encodeURIComponent(guildId)}`, {
        headers: { Authorization: `Bot ${botToken}` },
    }).catch(() => null);

    if (!response?.ok) return null;
    return await response.json().catch(() => null) as { id?: string; name?: string; owner_id?: string } | null;
}

async function dmBlockedServerOwner(input: {
    ownerId: string;
    guildName: string;
    guildId: string;
    reason: string;
}) {
    const botToken = String(process.env.DISCORD_TOKEN ?? '').trim();
    if (!botToken || !input.ownerId) return;

    const dmChannelRes = await fetch(`${DISCORD_API_BASE_URL}/users/@me/channels`, {
        method: 'POST',
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipient_id: input.ownerId }),
    }).catch(() => null);

    const dmChannel = dmChannelRes?.ok
        ? await dmChannelRes.json().catch(() => null) as { id?: string } | null
        : null;
    if (!dmChannel?.id) return;

    await fetch(`${DISCORD_API_BASE_URL}/channels/${encodeURIComponent(dmChannel.id)}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            embeds: [{
                title: 'Server Blocked',
                description: `Your server **${input.guildName}** has been blocked from using Ro-Link.`,
                color: 0xff4444,
                fields: [
                    { name: 'Reference', value: `\`${input.guildId}\`` },
                    { name: 'Reason', value: input.reason },
                    { name: 'Action', value: 'The bot has left your server and Ro-Link setup data has been removed.' },
                    { name: 'Support Server', value: 'https://discord.gg/C3n4nAwYMw' },
                ],
                timestamp: new Date().toISOString(),
            }],
        }),
    }).catch((error) => {
        console.error('[STAFF_ACTION] Failed to DM blocked server owner:', error);
    });
}

async function blockServerFromStaffAction(input: {
    guildId: string;
    fallbackGuildName: string;
    fallbackOwnerId: string;
    blockedBy: string;
    reason: string;
}) {
    const client = getSupabaseAdmin();
    const guildId = input.guildId.trim();
    const existing = await findBlockedServer(client, guildId);
    if (existing) {
        return { alreadyBlocked: true, guildName: input.fallbackGuildName || guildId, ownerId: input.fallbackOwnerId };
    }

    const guildSnapshot = await fetchDiscordGuildSnapshot(guildId);
    const guildName = String(guildSnapshot?.name || input.fallbackGuildName || guildId).trim();
    const ownerId = String(guildSnapshot?.owner_id || input.fallbackOwnerId || '').trim();
    const reason = input.reason.trim() || 'Blocked from Ro-Link after staff removal.';

    const { data, error } = await client
        .from('blocked_servers')
        .insert({
            guild_id: guildId,
            guild_name: guildName,
            owner_id: ownerId || null,
            reason,
            blocked_by: input.blockedBy,
        })
        .select('guild_id')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    const { error: deleteServerError } = await client.from('servers').delete().eq('id', guildId);
    if (deleteServerError) {
        throw new Error(deleteServerError.message);
    }

    const botToken = String(process.env.DISCORD_TOKEN ?? '').trim();
    if (botToken) {
        await fetch(`${DISCORD_API_BASE_URL}/users/@me/guilds/${encodeURIComponent(guildId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bot ${botToken}` },
        }).catch(() => null);
    }

    if (ownerId) {
        await dmBlockedServerOwner({ ownerId, guildName, guildId, reason });
    }

    return { alreadyBlocked: false, guildName, ownerId, guildId: data.guild_id };
}

function buildMiscPanelResponse(): InteractionResponseData {
    return {
        embeds: [{
            title: 'Miscellaneous Actions',
            description: 'Select an action from the menu below to apply it to a Roblox player.',
            color: 0x2b2d31,
            fields: [
                { name: 'Movement', value: "`FLY` `NOCLIP`", inline: true },
                { name: 'Visibility', value: "`INVIS` `GHOST`", inline: true },
                { name: 'Vitality', value: "`HEAL` `KILL` `RESET` `RAGDOLL`", inline: true },
                { name: 'Identity', value: "`SET_CHAR` `REFRESH` `VIEW`", inline: true },
                { name: 'Teams', value: "`TEAM`", inline: true }
            ],
            footer: { text: 'Ro-Link Systems - Admin Tools' },
            timestamp: new Date().toISOString()
        }],
        flags: 64,
        components: [{
            type: 1,
            components: [{
                type: 3,
                custom_id: `misc_menu`,
                placeholder: 'Choose an action...',
                options: [
                    { label: 'Fly', value: 'FLY', description: 'Enable flight for the player' },
                    { label: 'Noclip', value: 'NOCLIP', description: 'Allow player to walk through walls' },
                    { label: 'Invis', value: 'INVIS', description: 'Make the player invisible' },
                    { label: 'Ghost', value: 'GHOST', description: 'Apply a ForceField material' },
                    { label: 'Set Character', value: 'SET_CHAR', description: 'Change appearance' },
                    { label: 'Heal', value: 'HEAL', description: 'Restore health' },
                    { label: 'Damage', value: 'DAMAGE', description: 'Deal damage' },
                    { label: 'Max Health', value: 'MAX_HEALTH', description: 'Set maximum health' },
                    { label: 'Walk Speed', value: 'WALK_SPEED', description: 'Set walk speed' },
                    { label: 'Jump Power', value: 'JUMP_POWER', description: 'Set jump power' },
                    { label: 'Kill', value: 'KILL', description: 'Instant kill' },
                    { label: 'Reset', value: 'RESET', description: 'Reset character' },
                    { label: 'Refresh', value: 'REFRESH', description: 'Refresh character' },
                    { label: 'View', value: 'VIEW', description: 'View or reset your camera' },
                    { label: 'Team', value: 'TEAM', description: 'Move to a team' },
                    { label: 'Freeze', value: 'FREEZE', description: 'Anchor in place' },
                    { label: 'Unfreeze', value: 'UNFREEZE', description: 'Remove freeze' },
                    { label: 'Ragdoll', value: 'RAGDOLL', description: 'Temporarily ragdoll' },
                    { label: 'Bring To Spawn', value: 'BRING_TO_SPAWN', description: 'Move to spawn' },
                    { label: 'Teleport To Me', value: 'TELEPORT_TO_ME', description: 'Move to a moderator' },
                    { label: 'Add ForceField', value: 'FORCEFIELD_ADD', description: 'Add a ForceField' },
                    { label: 'Remove ForceField', value: 'FORCEFIELD_REMOVE', description: 'Remove ForceFields' }
                ]
            }]
        }]
    };
}

function buildManagePanelResponse(): InteractionResponseData {
    const moderationPanel = buildModerationPanelResponse();
    const miscPanel = buildMiscPanelResponse();
    return {
        flags: 64,
        embeds: [
            ...(moderationPanel.embeds || []),
            ...(miscPanel.embeds || []),
        ],
        components: [
            ...(moderationPanel.components || []),
            ...(miscPanel.components || []),
        ],
    };
}

function buildCommandSummary(commandNames: string[]) {
    return commandNames
        .map((commandName) => {
            const description = commandDefinitions.find((command) => command.name === commandName)?.description || 'No description available';
            return `\`/${commandName}\` - ${description}`;
        })
        .join('\n');
}

function getCommandOptionValue(options: CommandOption[] | undefined, name: string) {
    return options?.find((option) => option.name === name)?.value;
}

function getSubcommandOption(options: CommandOption[] | undefined) {
    return options?.find((option) => option.type === 1 || Array.isArray(option.options));
}

function getModalField(components: ModalComponentRow[] | undefined, id: string) {
    const row = components?.find((componentRow) =>
        Array.isArray(componentRow.components)
        && componentRow.components.some((component) => component.custom_id === id)
    );
    const field = row?.components?.find((component) => component.custom_id === id);
    return typeof field?.value === 'string' ? field.value : '';
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}

function truncateText(value: unknown, maxLength = 1024) {
    const text = String(value ?? '').trim();
    if (!text) {
        return '';
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatDiscordTimestamp(value?: string | null, style = 'f') {
    const timestamp = Date.parse(value || '');
    if (Number.isNaN(timestamp)) {
        return 'Unknown';
    }

    return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function formatModerationHistory(entries: LookupHistoryEntry[]) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return 'No prior moderation history found.';
    }

    return entries.slice(0, 5).map((entry) => {
        const action = truncateText(entry?.action || 'UNKNOWN', 24);
        const moderator = truncateText(entry?.moderator || 'Unknown Moderator', 48);
        return `- \`${action}\` by **${moderator}** ${formatDiscordTimestamp(entry?.timestamp, 'R')}`;
    }).join('\n');
}

function formatStaffNotes(notes: StaffNoteRow[]) {
    if (!Array.isArray(notes) || notes.length === 0) {
        return 'No staff notes found for this user.';
    }

    return notes.slice(0, 5).map((note) => {
        const author = truncateText(note.created_by_tag || note.created_by_discord_id || 'Unknown Staff', 48);
        return `- **${author}** ${formatDiscordTimestamp(note.created_at, 'R')}: ${truncateText(note.note, 220)}`;
    }).join('\n');
}

function encodeStaffNoteModalTarget(target: StaffNoteTarget) {
    const normalized = normalizeStaffNoteTarget(target);
    return [
        normalized.discordId || '-',
        normalized.robloxId || '-',
        normalized.robloxUsername ? encodeURIComponent(normalized.robloxUsername) : '-',
    ].join('|');
}

function decodeStaffNoteModalTarget(encoded: string): StaffNoteTarget {
    const [discordId = '-', robloxId = '-', robloxUsername = '-'] = encoded.split('|');
    return {
        discordId: discordId === '-' ? '' : discordId,
        robloxId: robloxId === '-' ? '' : robloxId,
        robloxUsername: robloxUsername === '-' ? '' : decodeURIComponent(robloxUsername),
    };
}

function buildStaffNoteModalCustomId(target: StaffNoteTarget) {
    return `staff_note_modal|${encodeStaffNoteModalTarget(target)}`;
}

function formatDiscordUserTag(user: DiscordUser | null | undefined) {
    if (!user?.username) {
        return 'Unknown User';
    }

    return user.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : `@${user.username}`;
}

function getDiscordAvatarUrl(user: DiscordUser | null | undefined) {
    if (!user?.id || !user.avatar) {
        return '';
    }

    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
}

function getDiscordCreatedAt(discordId: string) {
    try {
        const timestamp = Number((BigInt(discordId) >> 22n) + DISCORD_EPOCH);
        return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
    } catch {
        return '';
    }
}

async function fetchDiscordApi<T>(path: string, allowNotFound = false): Promise<T | null> {
    const token = String(process.env.DISCORD_TOKEN || '').trim();
    if (!token) {
        throw new Error('Missing DISCORD_TOKEN');
    }

    const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: 'no-store',
    });

    if (allowNotFound && response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Discord API request failed (${response.status}).`);
    }

    return response.json() as Promise<T>;
}

function buildEphemeralErrorResponse(message: string): InteractionResponseData {
    return {
        content: `Error: ${message}`,
        flags: 64,
    };
}

async function editOriginalInteractionResponse(applicationId: string, interactionToken: string, data: InteractionResponseData) {
    const normalizedApplicationId = String(applicationId ?? '').trim();
    const normalizedInteractionToken = String(interactionToken ?? '').trim();
    if (!normalizedApplicationId || !normalizedInteractionToken) {
        console.error('[INTERACTIONS] Cannot edit original response without application id and interaction token.');
        return;
    }

    try {
        const { flags: _flags, ...editableData } = data;
        const response = await fetch(
            `${DISCORD_API_BASE_URL}/webhooks/${encodeURIComponent(normalizedApplicationId)}/${encodeURIComponent(normalizedInteractionToken)}/messages/@original`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editableData),
            }
        );

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            console.error(`[INTERACTIONS] Failed to edit original response (${response.status}):`, errorBody);
        }
    } catch (error) {
        console.error('[INTERACTIONS] Failed to edit original response:', error);
    }
}

type DiscordApiMember = {
    user?: DiscordUser | null;
    nick?: string | null;
    roles?: string[] | null;
    joined_at?: string | null;
    premium_since?: string | null;
    communication_disabled_until?: string | null;
};

type DiscordLookupResult = {
    user: DiscordUser | null | undefined;
    member: DiscordApiMember | null;
    verifiedUser: Record<string, string | null | undefined> | null;
    moderationHistory: LookupHistoryEntry[];
    activeServer: LiveServerRow | null;
    activePlayer: LivePlayer | null;
};

function getVisiblePlayerCount(server: LiveServerRow) {
    const players = normalizeLivePlayerList(server.players);
    const rawCount = Number(server.player_count ?? 0);
    return players.length > 0 ? players.length : Number.isFinite(rawCount) ? rawCount : 0;
}

function formatJobId(jobId: unknown) {
    const value = String(jobId ?? '').trim();
    return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value || 'Unknown';
}

function buildRobloxJoinUrl(placeId: unknown, jobId: unknown) {
    const normalizedPlaceId = String(placeId ?? '').trim();
    const normalizedJobId = String(jobId ?? '').trim();
    if (!normalizedPlaceId || !normalizedJobId) {
        return '';
    }

    return `https://www.roblox.com/games/start?placeId=${encodeURIComponent(normalizedPlaceId)}&gameInstanceId=${encodeURIComponent(normalizedJobId)}`;
}

function buildServerActionComponents(jobId: string, placeId?: unknown, player?: LivePlayer | null) {
    const components: Array<Record<string, unknown>> = [
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: player
                        ? `server_player_action|${encodeURIComponent(jobId)}|${encodeURIComponent(player.username)}`
                        : `server_action|${encodeURIComponent(jobId)}`,
                    placeholder: player ? `Manage ${player.username}...` : 'Manage this server...',
                    options: player
                        ? [
                            { label: 'Kick Player', value: 'KICK', description: 'Kick this Roblox user from the live server' },
                            { label: 'Ban Player', value: 'BAN', description: 'Ban this Roblox user' },
                            { label: 'Kill Player', value: 'KILL', description: 'Kill this Roblox user' },
                            { label: 'Heal Player', value: 'HEAL', description: 'Heal this Roblox user' },
                        ]
                        : [
                            { label: 'Shutdown Server', value: 'SHUTDOWN', description: 'Shut down this live server' },
                            { label: 'Update Server', value: 'UPDATE', description: 'Restart this live server' },
                        ],
                },
            ],
        },
    ];

    const joinUrl = buildRobloxJoinUrl(placeId, jobId);
    if (joinUrl) {
        components.push({
            type: 1,
            components: [{
                type: 2,
                style: 5,
                label: 'Join Game',
                url: joinUrl,
            }],
        });
    }

    return components;
}

function buildServerEmbed(server: LiveServerRow, placeId?: unknown, player?: LivePlayer | null) {
    const players = normalizeLivePlayerList(server.players);
    const visiblePlayers = players.slice(0, 10).map((livePlayer) =>
        livePlayer.userId
            ? `${livePlayer.username} (${livePlayer.userId})`
            : livePlayer.username
    );

    return {
        title: player ? `Live Player: ${player.username}` : `Live Server: ${formatJobId(server.id)}`,
        color: player ? 0x10b981 : 0x0ea5e9,
        fields: [
            { name: 'Job ID', value: `\`${server.id || 'Unknown'}\``, inline: false },
            { name: 'Players', value: `${getVisiblePlayerCount(server)}`, inline: true },
            { name: 'Updated', value: server.updated_at ? formatDiscordTimestamp(server.updated_at, 'R') : 'Unknown', inline: true },
            ...(player
                ? [
                    { name: 'Matched Player', value: player.userId ? `${player.username}\n\`ID: ${player.userId}\`` : player.username, inline: false },
                ]
                : [
                    { name: 'Player List', value: visiblePlayers.length > 0 ? visiblePlayers.join('\n') : 'No resolved players reported.', inline: false },
                ]),
            ...(buildRobloxJoinUrl(placeId, server.id) ? [{ name: 'Join', value: '[Open Roblox server](' + buildRobloxJoinUrl(placeId, server.id) + ')', inline: false }] : []),
        ],
        footer: { text: 'Ro-Link Systems - Live Servers' },
        timestamp: new Date().toISOString(),
    };
}

function buildServersListResponse(liveServers: LiveServerRow[], search: string, placeId?: unknown) {
    const normalizedSearch = search.trim().toLowerCase();
    const serverMatches = normalizedSearch
        ? liveServers.filter((server) => {
            const jobId = String(server.id || '').toLowerCase();
            return jobId.includes(normalizedSearch)
                || normalizeLivePlayerList(server.players).some((player) =>
                    player.username.toLowerCase().includes(normalizedSearch)
                    || player.displayName.toLowerCase().includes(normalizedSearch)
                    || (player.userId ? player.userId.toLowerCase() === normalizedSearch : false)
                );
        })
        : liveServers;

    if (normalizedSearch && serverMatches.length === 1) {
        const server = serverMatches[0];
        const player = normalizeLivePlayerList(server.players).find((candidate) =>
            candidate.username.toLowerCase().includes(normalizedSearch)
            || candidate.displayName.toLowerCase().includes(normalizedSearch)
            || (candidate.userId ? candidate.userId.toLowerCase() === normalizedSearch : false)
        ) || null;

        return {
            embeds: [buildServerEmbed(server, placeId, player)],
            components: buildServerActionComponents(String(server.id || ''), placeId, player),
            flags: 64,
        };
    }

    const listedServers = serverMatches.slice(0, 25);
    return {
        embeds: [{
            title: normalizedSearch ? 'Live Server Search Results' : 'Live Servers',
            description: listedServers.length > 0
                ? listedServers.map((server, index) => {
                    const players = normalizeLivePlayerList(server.players);
                    const sample = players.slice(0, 3).map((player) => player.username).join(', ');
                    return `**${index + 1}.** \`${formatJobId(server.id)}\` - ${getVisiblePlayerCount(server)} player(s)${sample ? ` - ${sample}` : ''}`;
                }).join('\n')
                : 'No live servers found.',
            color: 0x0ea5e9,
            footer: { text: 'Ro-Link Systems - Live Servers' },
            timestamp: new Date().toISOString(),
        }],
        components: listedServers.length > 0
            ? [{
                type: 1,
                components: [{
                    type: 3,
                    custom_id: 'servers_select',
                    placeholder: 'Choose a live server...',
                    options: listedServers.map((server) => ({
                        label: `Server ${formatJobId(server.id)}`.slice(0, 100),
                        value: String(server.id || '').slice(0, 100),
                        description: `${getVisiblePlayerCount(server)} player(s) - updated ${server.updated_at ? 'recently' : 'unknown'}`.slice(0, 100),
                    })),
                }],
            }]
            : [],
        flags: 64,
    };
}

async function fetchLiveServers(serverId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const baseQuery = () => supabase
        .from('live_servers')
        .select('id, players, player_count, updated_at')
        .eq('server_id', serverId)
        .order('updated_at', { ascending: false });

    const { data, error } = await baseQuery()
        .gte('updated_at', fiveMinutesAgo);

    if (error) {
        throw new Error('Failed to load live servers.');
    }

    if (Array.isArray(data) && data.length > 0) {
        return data as LiveServerRow[];
    }

    const { data: fallbackData, error: fallbackError } = await baseQuery()
        .limit(25);

    if (fallbackError) {
        throw new Error('Failed to load live servers.');
    }

    return (Array.isArray(fallbackData) ? fallbackData : []) as LiveServerRow[];
}

function findPlayerServer(liveServers: LiveServerRow[], identity: unknown) {
    for (const liveServer of liveServers) {
        const player = findLivePlayer(liveServer.players, identity);
        if (player) {
            return { server: liveServer, player };
        }
    }

    return { server: null, player: null };
}

async function fetchDiscordLookup(userId: string, serverId: string): Promise<DiscordLookupResult> {
    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId) {
        throw new Error('Please choose a Discord user to lookup.');
    }

    const [member, userRecord, verifiedUser] = await Promise.all([
        fetchDiscordApi<DiscordApiMember>(`/guilds/${encodeURIComponent(serverId)}/members/${encodeURIComponent(normalizedUserId)}`, true),
        fetchDiscordApi<DiscordUser>(`/users/${encodeURIComponent(normalizedUserId)}`, true),
        supabase
            .from('verified_users')
            .select('*')
            .eq('discord_id', normalizedUserId)
            .maybeSingle(),
    ]);

    const discordUser = member?.user || userRecord;

    let activeServer: LiveServerRow | null = null;
    let activePlayer: LivePlayer | null = null;
    const robloxUsername = String(verifiedUser.data?.roblox_username ?? '').trim();
    const robloxId = String(verifiedUser.data?.roblox_id ?? '').trim();
    if (robloxUsername || robloxId) {
        const liveServers = await fetchLiveServers(serverId);
        const presence = findPlayerServer(liveServers, robloxUsername || robloxId);
        activeServer = presence.server;
        activePlayer = presence.player;
        if (!activeServer && robloxUsername && robloxId) {
            const fallbackPresence = findPlayerServer(liveServers, robloxId);
            activeServer = fallbackPresence.server;
            activePlayer = fallbackPresence.player;
        }
    }

    return {
        user: discordUser,
        member,
        verifiedUser: verifiedUser.data,
        moderationHistory: [],
        activeServer,
        activePlayer,
    };
}

async function fetchRobloxLookup(username: string, serverId: string, openCloudKey?: string | null): Promise<RobloxLookupResult> {
    const searchUsername = String(username ?? '').trim();
    if (!searchUsername) {
        throw new Error('Please provide a Roblox username to lookup.');
    }

    const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(searchUsername)}&limit=10`, {
        headers: {
            'User-Agent': 'Ro-Link/1.0',
        }
    });

    if (!searchRes.ok) {
        if (searchRes.status === 429) {
            throw new Error('Roblox rate limited the lookup. Try again in a moment.');
        }

        throw new Error(`Roblox search failed (${searchRes.status}).`);
    }

    const searchData = await searchRes.json();
    const matches = (Array.isArray(searchData?.data) ? searchData.data : []) as RobloxSearchCandidate[];
    const exactMatch = matches.find((candidate) =>
        String(candidate?.name || '').toLowerCase() === searchUsername.toLowerCase()
    );
    const matchedUser = exactMatch || matches[0];

    if (!matchedUser?.id) {
        throw new Error('Player not found.');
    }

    const apiKey = String(openCloudKey ?? '').trim();
    const [legacyProfileRes, cloudProfile, thumbnailData] = await Promise.all([
        fetch(`https://users.roblox.com/v1/users/${matchedUser.id}`, {
            headers: {
                'User-Agent': 'Ro-Link/1.0',
            }
        }),
        apiKey
            ? fetch(`https://apis.roblox.com/cloud/v2/users/${matchedUser.id}`, {
                headers: {
                    'x-api-key': apiKey,
                }
            }).then((response) => response.ok ? response.json() : null).catch(() => null)
            : Promise.resolve(null),
        fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${matchedUser.id}&size=150x150&format=Png&isCircular=false`, {
            headers: {
                'User-Agent': 'Ro-Link/1.0',
            }
        }).then((response) => response.ok ? response.json() : { data: [] }).catch(() => ({ data: [] })),
    ]);

    if (!legacyProfileRes.ok) {
        throw new Error(`Roblox profile lookup failed (${legacyProfileRes.status}).`);
    }

    const legacyProfile = await legacyProfileRes.json();
    const resolvedUsername = legacyProfile?.name || matchedUser.name || searchUsername;

    const [liveServersRes, logsRes] = await Promise.all([
        supabase
            .from('live_servers')
            .select('id, players')
            .eq('server_id', serverId),
        supabase
            .from('logs')
            .select('action, moderator, timestamp')
            .eq('server_id', serverId)
            .ilike('target', resolvedUsername)
            .order('timestamp', { ascending: false })
            .limit(5),
    ]);

    if (logsRes.error) {
        throw new Error('Failed to load moderation history.');
    }

    const liveServers = (Array.isArray(liveServersRes.data) ? liveServersRes.data : []) as LiveServerRow[];
    const moderationHistory = Array.isArray(logsRes.data) ? logsRes.data : [];
    const activeServer = liveServers.find((liveServer) => findLivePlayer(liveServer.players, resolvedUsername));

    return {
        id: matchedUser.id,
        username: resolvedUsername,
        displayName: legacyProfile?.displayName || matchedUser.displayName || resolvedUsername,
        description: legacyProfile?.description || cloudProfile?.about || '',
        created: legacyProfile?.created || cloudProfile?.createTime || '',
        isBanned: Boolean(legacyProfile?.isBanned),
        avatarUrl: thumbnailData?.data?.[0]?.imageUrl || '',
        hasApiKey: Boolean(apiKey),
        inGame: Boolean(activeServer),
        jobId: activeServer?.id || null,
        moderationHistory,
    };
}

async function buildLookupInteractionResponse(input: {
    guildId: string;
    options: CommandOption[] | undefined;
    server: InteractionServerRecord;
    userId: string;
    showStaffControls: boolean;
}): Promise<LookupInteractionResult> {
    const { guildId, options, server, userId, showStaffControls } = input;

    // Resolve arguments - default to the command executor if nothing is provided.
    const robloxUserArg = String(getCommandOptionValue(options, 'roblox_user') ?? '').trim();
    const discordUserArg = String(getCommandOptionValue(options, 'discord_user') ?? '').trim();
    const targetDiscordId = discordUserArg || (!robloxUserArg ? userId : '');

    let discordLookup: DiscordLookupResult | null = null;
    let robloxLookup: RobloxLookupResult | null = null;
    let verifiedUserForRoblox: Record<string, string | number | null | undefined> | null = null;

    if (targetDiscordId) {
        discordLookup = await fetchDiscordLookup(targetDiscordId, guildId);
    }

    if (robloxUserArg) {
        robloxLookup = await fetchRobloxLookup(robloxUserArg, guildId, server.open_cloud_key);
        const { data: verified } = await supabase
            .from('verified_users')
            .select('*')
            .eq('roblox_id', robloxLookup.id)
            .maybeSingle<Record<string, string | number | null | undefined>>();

        if (verified) {
            verifiedUserForRoblox = verified;
            if (!discordLookup) {
                try {
                    discordLookup = await fetchDiscordLookup(String(verified.discord_id), guildId);
                } catch {
                    // Non-fatal - Discord user may have left the server.
                }
            }
        }
    } else if (discordLookup?.verifiedUser) {
        try {
            robloxLookup = await fetchRobloxLookup(
                String(discordLookup.verifiedUser.roblox_username ?? '').trim(),
                guildId,
                server.open_cloud_key
            );
        } catch {
            // Non-fatal - fall back to basic verified_users data below.
        }
    }

    if (!discordLookup && !robloxLookup) {
        throw new Error('Could not resolve any Discord or Roblox user to lookup.');
    }

    const matchValues = new Set<string>();
    if (discordLookup?.user) {
        matchValues.add(discordLookup.user.id?.toLowerCase() ?? '');
        matchValues.add(`<@${discordLookup.user.id}>`);
        matchValues.add(`<@!${discordLookup.user.id}>`);
        if (discordLookup.user.username) matchValues.add(discordLookup.user.username.toLowerCase());
        const tag = formatDiscordUserTag(discordLookup.user);
        if (tag) matchValues.add(tag.toLowerCase());
    }
    if (discordLookup?.verifiedUser?.roblox_username) {
        matchValues.add(String(discordLookup.verifiedUser.roblox_username).toLowerCase());
    }
    if (discordLookup?.verifiedUser?.roblox_id) {
        matchValues.add(String(discordLookup.verifiedUser.roblox_id).toLowerCase());
    }
    if (robloxLookup?.username) {
        matchValues.add(robloxLookup.username.toLowerCase());
    }
    if (robloxLookup?.id) {
        matchValues.add(String(robloxLookup.id).toLowerCase());
    }
    if (verifiedUserForRoblox?.roblox_username) {
        matchValues.add(String(verifiedUserForRoblox.roblox_username).toLowerCase());
    }
    if (verifiedUserForRoblox?.roblox_id) {
        matchValues.add(String(verifiedUserForRoblox.roblox_id).toLowerCase());
    }

    let combinedHistory: LookupHistoryEntry[] = [];
    if (showStaffControls) {
        const { data: logsData } = await supabase
            .from('logs')
            .select('id, action, moderator, timestamp, target')
            .eq('server_id', guildId)
            .order('timestamp', { ascending: false })
            .limit(100);

        combinedHistory = ((Array.isArray(logsData) ? logsData : []) as LookupHistoryEntry[])
            .filter((entry) => {
                const action = String(entry?.action || '').toUpperCase();
                const target = String(entry?.target || '').toLowerCase();
                return matchValues.has(target) && (
                    MODERATION_LOG_ACTIONS.has(action)
                    || action.includes('BAN')
                    || action.includes('KICK')
                    || action.includes('MUTE')
                    || action.includes('TIMEOUT')
                );
            })
            .slice(0, 5);
    }

    const embeds: object[] = [];

    if (discordLookup) {
        const discordUser = discordLookup.user;
        const avatarUrl = getDiscordAvatarUrl(discordUser);
        const createdAt = getDiscordCreatedAt(String(discordUser?.id ?? targetDiscordId));
        const linkedRobloxStr = discordLookup.verifiedUser
            ? `[${discordLookup.verifiedUser.roblox_username}](https://www.roblox.com/users/${discordLookup.verifiedUser.roblox_id}/profile)\n\`ID: ${discordLookup.verifiedUser.roblox_id}\``
            : verifiedUserForRoblox
                ? `[${verifiedUserForRoblox.roblox_username}](https://www.roblox.com/users/${verifiedUserForRoblox.roblox_id}/profile)\n\`ID: ${verifiedUserForRoblox.roblox_id}\``
                : 'No linked Roblox account found.';

        embeds.push({
            title: `Discord User Info: ${formatDiscordUserTag(discordUser)}`,
            color: 0x0ea5e9,
            thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
            fields: [
                { name: 'Discord User', value: `<@${discordUser?.id ?? targetDiscordId}>`, inline: true },
                { name: 'Username', value: truncateText(formatDiscordUserTag(discordUser), 256), inline: true },
                { name: 'Discord ID', value: `\`${discordUser?.id ?? targetDiscordId}\``, inline: true },
                { name: 'Account Created', value: createdAt ? formatDiscordTimestamp(createdAt, 'F') : 'Unknown', inline: true },
                { name: 'Joined Server', value: discordLookup.member?.joined_at ? formatDiscordTimestamp(discordLookup.member.joined_at, 'F') : 'Not in server or unknown', inline: true },
                { name: 'Server Roles', value: `${discordLookup.member?.roles?.length ?? 0}`, inline: true },
                { name: 'Linked Roblox', value: linkedRobloxStr, inline: false },
                ...(discordLookup.member?.communication_disabled_until
                    ? [{ name: 'Timeout Ends', value: formatDiscordTimestamp(discordLookup.member.communication_disabled_until, 'F'), inline: false }]
                    : []),
            ],
            footer: { text: 'Ro-Link Systems - Discord Info' },
            timestamp: new Date().toISOString(),
        });
    }

    let finalRobloxLookup = robloxLookup;
    if (!finalRobloxLookup && discordLookup?.verifiedUser) {
        finalRobloxLookup = {
            id: Number(discordLookup.verifiedUser.roblox_id),
            username: String(discordLookup.verifiedUser.roblox_username),
            displayName: String(discordLookup.verifiedUser.roblox_username),
            description: 'Full profile could not be loaded.',
            created: '',
            isBanned: false,
            avatarUrl: '',
            hasApiKey: false,
            inGame: false,
            jobId: null,
            moderationHistory: [],
        };
    }

    if (finalRobloxLookup) {
        const profileUrl = `https://www.roblox.com/users/${finalRobloxLookup.id}/profile`;
        const robloxFields: object[] = [
            { name: 'Username', value: `[${finalRobloxLookup.username}](${profileUrl})`, inline: true },
            { name: 'Display Name', value: truncateText(finalRobloxLookup.displayName || finalRobloxLookup.username, 256), inline: true },
            { name: 'Roblox ID', value: `\`${finalRobloxLookup.id}\``, inline: true },
            { name: 'Account Created', value: finalRobloxLookup.created ? formatDiscordTimestamp(finalRobloxLookup.created, 'F') : 'Unknown', inline: true },
            { name: 'Status', value: finalRobloxLookup.isBanned ? 'Banned' : finalRobloxLookup.inGame ? 'In Game' : 'Offline', inline: true },
            { name: 'Description', value: truncateText(finalRobloxLookup.description || 'No description provided.', 1024), inline: false },
        ];

        if (finalRobloxLookup.inGame && finalRobloxLookup.jobId) {
            robloxFields.push({ name: 'Live Server', value: `User is active in job \`${finalRobloxLookup.jobId}\``, inline: false });
        }

        embeds.push({
            title: `Roblox Profile Info: ${finalRobloxLookup.username}`,
            url: profileUrl,
            color: finalRobloxLookup.isBanned ? 0xef4444 : finalRobloxLookup.inGame ? 0x10b981 : 0x0ea5e9,
            thumbnail: finalRobloxLookup.avatarUrl
                ? { url: finalRobloxLookup.avatarUrl }
                : { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${finalRobloxLookup.id}&width=420&height=420&format=png` },
            fields: robloxFields,
            footer: { text: 'Ro-Link Systems - Roblox Info' },
            timestamp: new Date().toISOString(),
        });
    }

    const staffNoteTarget: StaffNoteTarget = {
        discordId: discordLookup?.user?.id ?? targetDiscordId,
        robloxId: finalRobloxLookup?.id ?? discordLookup?.verifiedUser?.roblox_id ?? verifiedUserForRoblox?.roblox_id,
        robloxUsername: finalRobloxLookup?.username ?? discordLookup?.verifiedUser?.roblox_username ?? verifiedUserForRoblox?.roblox_username,
    };
    let staffNotes: StaffNoteRow[] = [];
    if (showStaffControls) {
        try {
            staffNotes = await fetchStaffNotes(supabase, guildId, staffNoteTarget, 5);
        } catch (error) {
            console.warn('[STAFF_NOTES] Failed to load notes for lookup:', error);
        }

        embeds.push({
            title: 'Server Moderation History',
            color: combinedHistory.length > 0 ? 0xef4444 : 0x0ea5e9,
            description: formatModerationHistory(combinedHistory),
            footer: { text: `Ro-Link Systems - ${combinedHistory.length} prior moderation action(s)` },
            timestamp: new Date().toISOString(),
        });

        embeds.push({
            title: 'Staff Notes',
            color: staffNotes.length > 0 ? 0xf59e0b : 0x64748b,
            description: formatStaffNotes(staffNotes),
            footer: { text: `Ro-Link Systems - ${staffNotes.length} staff note(s)` },
            timestamp: new Date().toISOString(),
        });
    }

    let finalJobId: string | null = null;
    if (finalRobloxLookup?.inGame && finalRobloxLookup?.jobId) {
        finalJobId = finalRobloxLookup.jobId;
    } else if (discordLookup?.activeServer?.id) {
        finalJobId = discordLookup.activeServer.id;
    }

    const joinUrl = finalJobId ? buildRobloxJoinUrl(server.place_id, finalJobId) : null;
    const targetLogStr = targetDiscordId || robloxUserArg || 'self';
    const actionRowComponents: object[] = [];
    if (joinUrl) {
        actionRowComponents.push({ type: 2, style: 5, label: 'Join Game', url: joinUrl });
    }
    if (showStaffControls) {
        actionRowComponents.push(
            { type: 2, style: 1, label: 'Manage', custom_id: 'lookup_manage' },
            { type: 2, style: 1, label: 'Add Staff Note', custom_id: buildStaffNoteModalCustomId(staffNoteTarget) },
        );
    }

    return {
        targetLogStr,
        response: {
            flags: 64,
            embeds,
            components: actionRowComponents.length > 0 ? [{ type: 1, components: actionRowComponents }] : [],
        },
    };
}

async function addStaffNoteFromCommand(input: {
    guildId: string;
    options: CommandOption[] | undefined;
    server: InteractionServerRecord;
    userId: string;
    userTag: string;
}) {
    const { guildId, options, server, userId, userTag } = input;
    const noteBody = String(getCommandOptionValue(options, 'note') ?? '').trim();
    const robloxUserArg = String(getCommandOptionValue(options, 'roblox_user') ?? '').trim();
    const discordUserArg = String(getCommandOptionValue(options, 'discord_user') ?? '').trim();
    const targetDiscordId = discordUserArg || (!robloxUserArg ? userId : '');

    let target: StaffNoteTarget = { discordId: targetDiscordId };

    if (targetDiscordId) {
        const discordLookup = await fetchDiscordLookup(targetDiscordId, guildId);
        target = {
            discordId: targetDiscordId,
            robloxId: discordLookup.verifiedUser?.roblox_id,
            robloxUsername: discordLookup.verifiedUser?.roblox_username,
        };
    }

    if (robloxUserArg) {
        const robloxLookup = await fetchRobloxLookup(robloxUserArg, guildId, server.open_cloud_key);
        const { data: verified } = await supabase
            .from('verified_users')
            .select('discord_id, roblox_id, roblox_username')
            .eq('roblox_id', robloxLookup.id)
            .maybeSingle<Record<string, string | number | null | undefined>>();

        target = {
            discordId: verified?.discord_id ?? targetDiscordId,
            robloxId: robloxLookup.id,
            robloxUsername: robloxLookup.username,
        };
    }

    const note = await createStaffNote(supabase, {
        serverId: guildId,
        target,
        note: noteBody,
        createdByDiscordId: userId,
        createdByTag: userTag,
    });

    await logAction(
        guildId,
        'STAFF_NOTE',
        note.target_roblox_username || note.target_roblox_id || note.target_discord_id || 'Unknown User',
        userId ? `<@${userId}>` : userTag,
        'Staff note added',
    );

    return {
        content: `Saved staff note for **${getStaffNoteTargetLabel(target)}**.`,
        flags: 64,
    };
}

function buildReportCustomId(action: ReportChannelAction, reportId: string, target: string) {
    return `${REPORT_CUSTOM_ID_PREFIX}${action}|${reportId}|${encodeURIComponent(String(target ?? '').trim())}`;
}

function parseReportCustomId(customId: string): ParsedReportChannelAction | null {
    if (!customId.startsWith(REPORT_CUSTOM_ID_PREFIX)) {
        return null;
    }

    const [, action = '', reportId = '', encodedTarget = ''] = customId.split('|');
    if (!action || !reportId || !encodedTarget) {
        return null;
    }

    const allowedActions = new Set<ReportChannelAction>([
        'switch_discord',
        'switch_roblox',
        'discord_kick',
        'discord_ban',
        'roblox_kick',
        'roblox_ban',
        'dismiss',
    ]);

    if (!allowedActions.has(action as ReportChannelAction)) {
        return null;
    }

    return {
        action: action as ReportChannelAction,
        reportId,
        target: decodeURIComponent(encodedTarget),
    };
}

function buildReportChannelComponents(reportId: string, target: string, mode: ReportChannelMode = 'discord', disabled = false) {
    const primaryButtons = mode === 'roblox'
        ? [
            { type: 2, style: 2, label: 'Kick (Roblox)', custom_id: buildReportCustomId('roblox_kick', reportId, target) },
            { type: 2, style: 4, label: 'Ban (Roblox)', custom_id: buildReportCustomId('roblox_ban', reportId, target) },
            { type: 2, style: 1, label: 'Discord Actions', custom_id: buildReportCustomId('switch_discord', reportId, target) },
        ]
        : [
            { type: 2, style: 2, label: 'Kick (Discord)', custom_id: buildReportCustomId('discord_kick', reportId, target) },
            { type: 2, style: 4, label: 'Ban (Discord)', custom_id: buildReportCustomId('discord_ban', reportId, target) },
            { type: 2, style: 1, label: 'Roblox Actions', custom_id: buildReportCustomId('switch_roblox', reportId, target) },
        ];

    return [{
        type: 1,
        components: [
            ...primaryButtons,
            {
                type: 2,
                style: 2,
                label: 'Dismiss',
                custom_id: buildReportCustomId('dismiss', reportId, target),
            },
        ].map((button) => ({
            ...button,
            disabled,
        })),
    }];
}

async function findPendingReportIdByTarget(serverId: string, target: string) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('reports')
        .select('id')
        .eq('server_id', serverId)
        .eq('status', 'PENDING')
        .ilike('reported_roblox_username', String(target ?? '').trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[REPORTS] Failed to find pending report by target:', error);
        return null;
    }

    return data?.id || null;
}

async function updateReportFromChannel(
    reportId: string,
    serverId: string,
    moderatorId: string,
    moderatorNote: string,
    status: 'RESOLVED' | 'DISMISSED',
) {
    const client = getSupabaseAdmin();
    const { error } = await client
        .from('reports')
        .update({
            status,
            moderator_id: moderatorId,
            moderator_note: moderatorNote,
            resolved_at: new Date().toISOString(),
        })
        .eq('server_id', serverId)
        .eq('id', reportId);

    if (error) {
        throw new Error(error.message);
    }
}

async function resolveDiscordTargetId(target: string) {
    let targetId = String(target ?? '').trim();
    if (!targetId) {
        return null;
    }

    if (targetId.includes('<@')) {
        targetId = targetId.replace(/[<@!>]/g, '');
    }

    if (Number.isNaN(Number(targetId))) {
        const { data } = await supabase
            .from('verified_users')
            .select('discord_id')
            .ilike('roblox_username', targetId)
            .maybeSingle<{ discord_id?: string | null }>();

        targetId = String(data?.discord_id ?? '').trim();
    }

    return Number.isNaN(Number(targetId)) ? null : targetId;
}



export async function POST(req: Request) {
    try {
        const { isValid, body } = await verifyDiscordRequest(req);

        if (!isValid || !body) {
            return new NextResponse('Invalid request signature', { status: 401 });
        }

        const interaction = JSON.parse(body) as DiscordInteractionPayload;
        const type = interaction.type;
        const guild_id = String(interaction.guild_id ?? '');
        const member = interaction.member ?? undefined;
        const interactionUser = interaction.user ?? undefined;
        const interactionData = interaction.data ?? undefined;
        const user = interactionUser || member?.user;
        const userId = user?.id ?? '';
        const userTag = user ? `${user.username}${user.discriminator !== '0' ? '#' + user.discriminator : ''}` : 'Unknown';
        const logActor = userId ? `<@${userId}>` : userTag;

        // Helper to check permissions against RBAC
        async function checkPermission(permissionKey: string) {
            if (!member) return false;

            // Administrator/Owner Bypass
            const isAdmin = (BigInt(member.permissions || "0") & 0x8n) === 0x8n;
            if (isAdmin) return true;

            if (!member.roles || member.roles.length === 0) return false;

            const { data: roles } = await supabase
                .from('dashboard_roles')
                .select('*')
                .eq('server_id', guild_id)
                .in('discord_role_id', member.roles);

            if (!roles) return false;

            // Check if any of the user's roles have the required permission
            const roleRows = roles as DashboardRoleRow[];
            return roleRows.some((role) => role[permissionKey] === true);
        }

        async function isServerStaff() {
            const permissions = BigInt(member?.permissions || '0');
            if ((permissions & 0x2n) !== 0n || (permissions & 0x4n) !== 0n || (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n) {
                return true;
            }

            return await checkPermission('can_lookup')
                || await checkPermission('can_kick')
                || await checkPermission('can_ban')
                || await checkPermission('can_access_dashboard');
        }

        // Helper to trigger Messaging Service
        const triggerMessaging = async (command: string, args: Record<string, unknown>, serverData: unknown = null) => {
            if (!guild_id) return;
            await sendRobloxMessage(guild_id, command, args, serverData);
        };

        const queueResolvedCommand = async (
            command: string,
            args: CommandArgs,
            options?: { serverData?: unknown },
        ) => {
            const deliveryTargets = await resolveDeliveryTargets(guild_id, command, args);
            if (deliveryTargets.length === 0) {
                return { error: 'No live server currently has that target player.' };
            }

            const queueRows = deliveryTargets.map((target) => ({
                server_id: guild_id,
                command,
                args: buildDeliveryArgs(args, target),
                status: 'PENDING',
            }));

            const { error } = await supabase.from('command_queue').insert(queueRows);
            if (error) {
                return { error: error.message };
            }

            await Promise.all(deliveryTargets.map((target) =>
                triggerMessaging(command, buildDeliveryArgs(args, target), options?.serverData),
            ));

            return { deliveredTargets: deliveryTargets.length };
        };

        // 2. Handle PING
        if (type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 3. Handle Application Commands
        if (type === 2) {
            const rootName = interactionData?.name;
            const name = rootName;
            let options = interactionData?.options;
            let miscCommand: string | null = null;

            if (rootName === 'misc') {
                const subcommand = getSubcommandOption(options);
                miscCommand = subcommand?.name ? MISC_SUBCOMMAND_TO_COMMAND[subcommand.name] || null : null;
                options = subcommand?.options;
            }

            // Handle Setup (Owner Only)
            if (name === 'setup') {
                if (!guild_id) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ This command can only be used in a Discord Server.`, flags: 64 }
                    });
                }

                const blocked = await findBlockedServer(supabase, guild_id);
                if (blocked) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `âŒ ${getBlockedServerMessage(blocked)}`, flags: 64 }
                    });
                }

                // Verify Owner via Discord API
                const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guild_id}`, {
                    headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
                });

                if (!guildRes.ok) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to verify server owner status.`, flags: 64 }
                    });
                }

                const guildData = await guildRes.json();
                if (userId !== guildData.owner_id) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ This command can only be run by the server owner.`, flags: 64 }
                    });
                }

                // Check if already setup
                const { data: existingServer } = await supabase
                    .from('servers')
                    .select('*')
                    .eq('id', guild_id)
                    .maybeSingle();

                if (existingServer) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: 'ℹ️ **This server is already set up!** Here are your integration details:',
                            embeds: getSetupEmbeds(guild_id, existingServer.api_key),
                            flags: 64
                        }
                    });
                }

                // Return Modal
                return NextResponse.json({
                    type: 9,
                    data: {
                        title: 'Ro-Link Server Setup',
                        custom_id: 'setup_modal',
                        components: [
                            {
                                type: 1,
                                components: [{
                                    type: 4,
                                    custom_id: 'place_id',
                                    label: 'Roblox Place ID',
                                    style: 1,
                                    placeholder: 'Enter your Roblox Place ID (e.g. 123456789)',
                                    required: true
                                }]
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4,
                                    custom_id: 'universe_id',
                                    label: 'Roblox Universe ID',
                                    style: 1,
                                    placeholder: 'Enter your Roblox Universe ID',
                                    required: true
                                }]
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4,
                                    custom_id: 'api_key',
                                    label: 'Roblox Open Cloud API Key',
                                    style: 2,
                                    placeholder: 'Paste your API Key here (Secure)',
                                    required: true
                                }]
                            }
                        ]
                    }
                });
            }

            // Handle 'ping' command immediately (No DB required)
            if (name === 'ping') {
                const timestamp = Number(BigInt(interaction.id) >> 22n) + 1420070400000;
                const latency = Math.abs(Date.now() - timestamp);
                return NextResponse.json({
                    type: 4,
                    data: { content: `🏓 **Pong!**\nLatency: \`${latency}ms\`\nInstance: \`Vercel Edge (Australia/Sydney)\`` }
                });
            }

            // Handle 'help' command
            if (name === 'help') {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: 'Ro-Link System Information',
                                description: "Welcome to **Ro-Link**, the premium bridge between Discord and Roblox. Manage your community with seamless integration, powerful moderation tools, and real-time data syncing.\n\n**Note:** To setup your server, use `/setup`.",
                                url: baseUrl,
                                color: 0x2b2d31,
                                thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                                fields: [
                                    {
                                        name: '**Management Commands**',
                                        value: buildCommandSummary(['setup', 'update']) + '\n`/moderation` - Open moderation actions',
                                        inline: false
                                    },
                                    {
                                        name: '**Moderation Commands**',
                                        value: '`/moderation` - Ban, kick, unban, softban, update, or shutdown\n`/lookup` - Lookup Discord info, linked Roblox info, moderation history, and staff notes\n`/staff-note` - Add a staff-only user note',
                                        inline: false
                                    },
                                    {
                                        name: '**Utility Commands**',
                                        value: buildCommandSummary(['lookup', 'verify', 'ping', 'servers']),
                                        inline: false
                                    },
                                    {
                                        name: '**Misc Commands**',
                                        value: '`/misc` - Open player action tools',
                                        inline: false
                                    }
                                ],
                                footer: { text: 'Ro-Link Systems • Premium Integration', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                                timestamp: new Date().toISOString()
                            }
                        ]
                    }
                });
            }

            if (name === 'verify') {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: 'Account Verification',
                            description: 'Link your Roblox account to unlock all features.',
                            color: 0x2b2d31,
                            thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            fields: [
                                { name: 'Step 1', value: `Navigate to [**Verification Portal**](${baseUrl}/verify)`, inline: true },
                                { name: 'Step 2', value: 'Log in with Discord', inline: true },
                                { name: 'Step 3', value: 'Authorize Roblox', inline: true }
                            ],
                            footer: { text: 'Ro-Link Systems • Verification', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            timestamp: new Date().toISOString()
                        }],
                        components: [{
                            type: 1,
                            components: [{
                                type: 2,
                                style: 5,
                                label: 'Open Verification Portal',
                                url: `${baseUrl}/verify`
                            }]
                        }],
                        flags: 64
                    }
                });
            }



            if (name === 'report') {
                const { data: server, error: serverError } = await supabase
                    .from('servers')
                    .select('reports_enabled')
                    .eq('id', guild_id)
                    .single();

                if (serverError || !server?.reports_enabled) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ The report system is currently **DISABLED** in this server.`, flags: 64 }
                    });
                }

                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: 'Player Reporting System',
                            description: 'Submit a report against a player for rule violations. All reports are reviewed by server moderators.',
                            color: 0xff4444,
                            thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            fields: [
                                { name: 'Warning', value: "False reporting or misuse of this system may result in a ban from the bot and server.", inline: false },
                                { name: 'Process', value: "1. Click the button below\n2. Enter the Roblox Username\n3. Describe the incident and provide proof if possible", inline: false }
                            ],
                            footer: { text: 'Ro-Link Systems • Reports', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            timestamp: new Date().toISOString()
                        }],
                        components: [{
                            type: 1,
                            components: [{
                                type: 2,
                                style: 4, // Danger/Red
                                label: 'Create Report',
                                custom_id: 'report_open',
                                emoji: { name: '🚨' }
                            }]
                        }],
                        flags: 64
                    }
                });
            }


            const isBan = name === 'ban' || name === 'unban' || name === 'softban';
            const isKick = name === 'kick';
            const isTimeout = name === 'timeout' || name === 'mute';
            const isLookup = name === 'lookup';
            const isStaffNote = name === 'staff-note';
            const isUpdateServers = name === 'update-servers';
            const isShutdown = name === 'shutdown';
            const isUpdate = name === 'update';
            const isServers = name === 'servers';
            const isMiscCommand = rootName === 'misc';
            const isModerationMenu = rootName === 'moderation';

            if (isLookup) {
                if (!guild_id) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: This command can only be used in a Discord Server.`, flags: 64 }
                    });
                }

                const applicationId = String(interaction.application_id ?? '').trim();
                const interactionToken = String(interaction.token ?? '').trim();

                if (applicationId && interactionToken) {
                    after(async () => {
                        try {
                            const showStaffControls = await isServerStaff();

                            const { data: server, error: serverError } = await supabase
                                .from('servers')
                                .select('*')
                                .eq('id', guild_id)
                                .maybeSingle<InteractionServerRecord>();

                            if (serverError || !server) {
                                console.error(`[AUTH] Server check failed for ${guild_id}:`, serverError);
                                await editOriginalInteractionResponse(
                                    applicationId,
                                    interactionToken,
                                    buildEphemeralErrorResponse(`This server is not set up with Ro-Link yet.\n\n**Server Owners** can use \`/setup\` to initialize it directly, or visit the dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guild_id}`)
                                );
                                return;
                            }

                            const lookupResult = await buildLookupInteractionResponse({
                                guildId: guild_id,
                                options,
                                server,
                                userId,
                                showStaffControls,
                            });

                            await editOriginalInteractionResponse(applicationId, interactionToken, lookupResult.response);
                            await logAction(guild_id, 'LOOKUP', lookupResult.targetLogStr, logActor, 'Unified lookup command');
                        } catch (error: unknown) {
                            console.error('[LOOKUP] Deferred error:', error);
                            await editOriginalInteractionResponse(
                                applicationId,
                                interactionToken,
                                buildEphemeralErrorResponse(getErrorMessage(error, 'Failed to lookup that user.'))
                            );
                        }
                    });

                    return NextResponse.json({
                        type: 5,
                        data: { flags: 64 },
                    });
                }
            }

            let hasPerms = false;
            if (isBan) hasPerms = await checkPermission('can_ban');
            else if (isKick) hasPerms = await checkPermission('can_kick');
            else if (isTimeout) hasPerms = await checkPermission('can_timeout');
            else if (isLookup) hasPerms = true;
            else if (isStaffNote) hasPerms = await checkPermission('can_lookup');
            else if (isServers) hasPerms = await checkPermission('can_access_dashboard');
            else if (isMiscCommand) hasPerms = await checkPermission('can_access_dashboard');
            else if (isModerationMenu) hasPerms = await checkPermission('can_kick') || await checkPermission('can_ban');
            else if (isUpdateServers || isShutdown) {
                const permissions = BigInt(member?.permissions || '0');
                hasPerms = (permissions & 0x8n) !== 0n || userId === '953414442060746854';
            }
            else if (isUpdate) {
                hasPerms = true;
            }
            else {
                const permissions = BigInt(member?.permissions || '0');
                hasPerms = (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;
            }

            if (!hasPerms) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ You do not have permission to use this command. This action requires specific Ro-Link moderator permissions or Administrator.`, flags: 64 }
                });
            }

            // Check if server is setup
            if (!guild_id) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ This command can only be used in a Discord Server.`, flags: 64 }
                });
            }

            const { data: server, error: serverError } = await supabase
                .from('servers')
                .select('*')
                .eq('id', guild_id)
                .maybeSingle();

            if (serverError || !server) {
                console.error(`[AUTH] Server check failed for ${guild_id}:`, serverError);
                return NextResponse.json({
                    type: 4,
                    data: {
                        content: `❌ This server is not set up with Ro-Link yet.\n\n**Server Owners** can use \`/setup\` to initialize it directly, or visit the dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guild_id}`,
                        flags: 64
                    }
                });
            }

            const targetUser = String(getCommandOptionValue(options, 'username') ?? '').trim();
            const jobId = String(getCommandOptionValue(options, 'job_id') ?? '').trim();
            const reason = String(getCommandOptionValue(options, 'reason') ?? 'No reason provided').trim() || 'No reason provided';

            if (commandRequiresModerationHierarchy(String(name || ''))) {
                try {
                    const hierarchyCheck = await evaluateModerationRoleHierarchy({
                        serverId: guild_id,
                        moderatorDiscordId: userId,
                        targetRobloxUsername: targetUser,
                        enabled: server.enforce_moderation_role_hierarchy,
                    });

                    if (!hierarchyCheck.allowed) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `❌ ${hierarchyCheck.message}`, flags: 64 }
                        });
                    }
                } catch (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${getErrorMessage(error, 'Failed to verify the role hierarchy for that moderation action.')}`, flags: 64 }
                    });
                }
            }

            if (name === 'moderation') {
                return NextResponse.json({
                    type: 4,
                    data: buildModerationPanelResponse()
                });
            }

            if (name === 'lookup') {
                try {
                    const lookupResult = await buildLookupInteractionResponse({
                        guildId: guild_id,
                        options,
                        server,
                        userId,
                        showStaffControls: await isServerStaff(),
                    });

                    await logAction(guild_id, 'LOOKUP', lookupResult.targetLogStr, logActor, 'Unified lookup command');

                    return NextResponse.json({
                        type: 4,
                        data: lookupResult.response,
                    });
                } catch (error: unknown) {
                    console.error('[LOOKUP] Error:', error);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: ${getErrorMessage(error, 'Failed to lookup that user.')}`, flags: 64 }
                    });
                }
            }

            if (name === 'staff-note') {
                try {
                    const response = await addStaffNoteFromCommand({
                        guildId: guild_id,
                        options,
                        server,
                        userId,
                        userTag,
                    });

                    return NextResponse.json({
                        type: 4,
                        data: response,
                    });
                } catch (error: unknown) {
                    console.error('[STAFF_NOTE] Error:', error);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: ${getErrorMessage(error, 'Failed to save that staff note.')}`, flags: 64 }
                    });
                }
            }

            if (name === 'servers') {
                try {
                    const search = String(getCommandOptionValue(options, 'search') ?? '').trim();
                    const liveServers = await fetchLiveServers(guild_id);
                    const response = buildServersListResponse(liveServers, search, server.place_id);

                    return NextResponse.json({
                        type: 4,
                        data: response,
                    });
                } catch (error: unknown) {
                    console.error('[SERVERS] Error:', error);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Failed to load live servers: ${getErrorMessage(error, 'Unknown error')}`, flags: 64 }
                    });
                }
            }



            let message = '';
            if (name === 'ban') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: name.toUpperCase(),
                        args: { username: targetUser, reason: reason, moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging(name.toUpperCase(), { username: targetUser, reason: reason, moderator: userTag }, server),
                    logAction(guild_id, name.toUpperCase(), targetUser, logActor, reason)
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🔨 **Banned** \`${targetUser}\` from Roblox game.`;
            }
            else if (name === 'kick') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'KICK',
                        args: { username: targetUser, reason: reason, moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('KICK', { username: targetUser, reason: reason, moderator: userTag }, server),
                    logAction(guild_id, 'KICK', targetUser, logActor, reason)
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🥾 **Kicked** \`${targetUser}\` from Roblox server.`;
            }
            else if (name === 'unban') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'UNBAN',
                        args: { username: targetUser, reason: reason, moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('UNBAN', { username: targetUser, reason: reason, moderator: userTag }, server),
                    logAction(guild_id, 'UNBAN', targetUser, logActor, reason)
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🔓 **Unbanned** \`${targetUser}\` from Roblox.`;
            }
            else if (name === 'softban') {
                const durationSeconds = Number(getCommandOptionValue(options, 'duration_seconds') ?? 3600);
                const safeDurationSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.floor(durationSeconds) : 3600;
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'SOFTBAN',
                        args: { username: targetUser, reason: reason, duration_seconds: safeDurationSeconds, moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('SOFTBAN', { username: targetUser, reason: reason, duration_seconds: safeDurationSeconds, moderator: userTag }, server),
                    logAction(guild_id, 'SOFTBAN', targetUser, logActor, reason)
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: Failed to queue command.`, flags: 64 }
                    });
                }
                message = `Temporarily banned \`${targetUser}\` from Roblox for ${safeDurationSeconds} seconds.`;
            }
            else if (name === 'update-servers') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'UPDATE',
                        args: { reason: "Manual Update Triggered", moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('UPDATE', { reason: "Manual Update Triggered", moderator: userTag }, server),
                    logAction(guild_id, 'UPDATE_SERVERS', 'ALL', logActor, "Manual Update Triggered")
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🚀 **Update Signal Sent**! All game servers will restart shortly.`;
            }
            else if (name === 'update') {
                const targetUserId = String(getCommandOptionValue(options, 'user') ?? userId);
                const isSelf = targetUserId === userId;

                if (!isSelf) {
                    const canManageRoles = (BigInt(member?.permissions || "0") & 0x10000000n) === 0x10000000n; // Manage Roles
                    const isAdmin = (BigInt(member?.permissions || "0") & 0x8n) === 0x8n;
                    if (!canManageRoles && !isAdmin) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `❌ You do not have permission to update other users.`, flags: 64 }
                        });
                    }
                }

                // 1. Fetch from DB
                const { data: verifiedUser, error: dbError } = await supabase
                    .from('verified_users')
                    .select('*')
                    .eq('discord_id', targetUserId)
                    .maybeSingle();

                if (dbError || !verifiedUser) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ <@${targetUserId}> is not linked with Ro-Link. Use \`/verify\` to get started.`, flags: 64 }
                    });
                }

                try {
                    // 2. Fetch latest from Roblox
                    const robloxRes = await fetch(`https://users.roproxy.com/v1/users/${verifiedUser.roblox_id}`);
                    const robloxData = await robloxRes.json();

                    if (robloxData && robloxData.name) {
                        // 3. Update DB if name changed
                        if (robloxData.name !== verifiedUser.roblox_username) {
                            await supabase
                                .from('verified_users')
                                .update({ roblox_username: robloxData.name })
                                .eq('discord_id', targetUserId);
                        }

                        // 4. Return success (Roles/Nickname updates are best handled by the persistent bot script or via Discord API here if we had full token)
                        // For the Edge runtime, we'll try to trigger a job or just update DB and inform user.
                        // Actually, we CAN try to update nickname/roles if we use the BOT token.

                        const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${targetUserId}`, {
                            headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
                        });
                        const memberData = await memberRes.json();

                        const { data: serverSettings } = await supabase
                            .from('servers')
                            .select('verified_role, nick_template')
                            .eq('id', guild_id)
                            .single();

                        if (serverSettings) {
                            // Add Role
                            if (serverSettings.verified_role) {
                                await fetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${targetUserId}/roles/${serverSettings.verified_role}`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
                                });
                            }

                            // Update Nickname
                            if (serverSettings.nick_template) {
                                const nick = serverSettings.nick_template
                                    .replace(/{roblox_username}/g, robloxData.name)
                                    .replace(/{roblox_id}/g, verifiedUser.roblox_id)
                                    .replace(/{discord_name}/g, (memberData.user?.username || 'User').substring(0, 16));

                                await fetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${targetUserId}`, {
                                    method: 'PATCH',
                                    headers: {
                                        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ nick: nick.substring(0, 32) })
                                }).catch(() => { });
                            }
                        }

                        await logAction(guild_id, 'PROFILE_UPDATE', `<@${targetUserId}>`, logActor, `Updated linked Roblox account: ${robloxData.name}`);

                        return NextResponse.json({
                            type: 4,
                            data: { content: `✅ **Profile Updated**!\nLinked Account: \`${robloxData.name}\` (\`${verifiedUser.roblox_id}\`)`, flags: 64 }
                        });
                    } else {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `❌ Failed to fetch Roblox data. Please try again later.`, flags: 64 }
                        });
                    }
                } catch {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ An error occurred while updating the profile.`, flags: 64 }
                    });
                }
            }
            else if (name === 'shutdown') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'SHUTDOWN',
                        args: { job_id: jobId, moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('SHUTDOWN', { job_id: jobId, moderator: userTag }, server),
                    logAction(guild_id, 'SHUTDOWN', jobId || 'ALL', logActor)
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                const targetMsg = jobId ? `server \`${jobId}\`` : 'all active game servers';
                message = `🛑 **SHUTDOWN SIGNAL SENT**! Closing ${targetMsg}.`;
            }

            else if (name === 'misc') {
                if (miscCommand) {
                    const amountValue = getCommandOptionValue(options, 'amount');
                    const amount = amountValue === undefined ? undefined : Number(amountValue);
                    let resolvedTargetUser = targetUser;
                    const args: MiscCommandArgs = { username: resolvedTargetUser, moderator: userTag };
                    if (miscCommand === 'SET_CHAR') {
                        args.char_user = String(getCommandOptionValue(options, 'char_user') ?? '').trim();
                    }
                    if (miscCommand === 'TEAM') {
                        args.team_name = String(getCommandOptionValue(options, 'team_name') ?? '').trim();
                    }
                    if (miscCommand === 'VIEW') {
                        const linkedRobloxUsername = await getLinkedRobloxUsername(userId);
                        if (!linkedRobloxUsername) {
                            return NextResponse.json({
                                type: 4,
                                data: { content: 'Link your Discord account to Roblox before using View.', flags: 64 }
                            });
                        }
                        args.moderator_roblox_username = linkedRobloxUsername;
                        if (!resolvedTargetUser) {
                            resolvedTargetUser = linkedRobloxUsername;
                            args.username = linkedRobloxUsername;
                        }
                    }
                    if (miscCommand === 'TELEPORT_TO_ME') {
                        args.moderator_roblox_username = String(getCommandOptionValue(options, 'moderator_username') ?? '').trim();
                    }
                    if (VALUE_INPUT_MISC_COMMANDS.has(miscCommand)) {
                        if (!Number.isFinite(amount)) {
                            return NextResponse.json({
                                type: 4,
                                data: { content: 'Please provide a valid amount for that misc command.', flags: 64 }
                            });
                        }
                        args.amount = amount;
                    }

                    const queueRes = await queueResolvedCommand(miscCommand, args, { serverData: server });

                    if (queueRes.error) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: queueRes.error || `Error: Failed to queue command.`, flags: 64 }
                        });
                    }

                    await logAction(guild_id, miscCommand, resolvedTargetUser || 'self', logActor, 'Misc command');

                    return NextResponse.json({
                        type: 4,
                        data: { content: `Queued **${miscCommand}** for \`${resolvedTargetUser || 'self'}\`.`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: 'Miscellaneous Actions',
                            description: 'Select an action from the menu below to apply it to a Roblox player.',
                            color: 0x2b2d31,
                            fields: [
                                { name: 'Movement', value: "`FLY` `NOCLIP`", inline: true },
                                { name: 'Visibility', value: "`INVIS` `GHOST`", inline: true },
                                { name: 'Vitality', value: "`HEAL` `KILL` `RESET` `RAGDOLL`", inline: true },
                                { name: 'Identity', value: "`SET_CHAR` `REFRESH` `VIEW`", inline: true },
                                { name: 'Teams', value: "`TEAM`", inline: true }
                            ],
                            footer: { text: 'Ro-Link Systems • Admin Tools' },
                            timestamp: new Date().toISOString()
                        }],
                        flags: 64,
                        components: [{
                            type: 1,
                            components: [{
                                type: 3,
                                custom_id: `misc_menu`,
                                placeholder: 'Choose an action...',
                                options: [
                                    { label: 'Fly', value: 'FLY', description: 'Enable flight for the player' },
                                    { label: 'Noclip', value: 'NOCLIP', description: 'Allow player to walk through walls' },
                                    { label: 'Invis', value: 'INVIS', description: 'Make the player invisible' },
                                    { label: 'Ghost', value: 'GHOST', description: 'Apply a ForceField material' },
                                    { label: 'Set Character', value: 'SET_CHAR', description: 'Change appearance' },
                                    { label: 'Heal', value: 'HEAL', description: 'Restore health' },
                                    { label: 'Damage', value: 'DAMAGE', description: 'Deal damage' },
                                    { label: 'Max Health', value: 'MAX_HEALTH', description: 'Set maximum health' },
                                    { label: 'Walk Speed', value: 'WALK_SPEED', description: 'Set walk speed' },
                                    { label: 'Jump Power', value: 'JUMP_POWER', description: 'Set jump power' },
                                    { label: 'Kill', value: 'KILL', description: 'Instant kill' },
                                    { label: 'Reset', value: 'RESET', description: 'Reset character' },
                                    { label: 'Refresh', value: 'REFRESH', description: 'Refresh character' },
                                    { label: 'View', value: 'VIEW', description: 'View or reset your camera' },
                                    { label: 'Team', value: 'TEAM', description: 'Move to a team' },
                                    { label: 'Freeze', value: 'FREEZE', description: 'Anchor in place' },
                                    { label: 'Unfreeze', value: 'UNFREEZE', description: 'Remove freeze' },
                                    { label: 'Ragdoll', value: 'RAGDOLL', description: 'Temporarily ragdoll' },
                                    { label: 'Bring To Spawn', value: 'BRING_TO_SPAWN', description: 'Move to spawn' },
                                    { label: 'Teleport To Me', value: 'TELEPORT_TO_ME', description: 'Move to a moderator' },
                                    { label: 'Add ForceField', value: 'FORCEFIELD_ADD', description: 'Add a ForceField' },
                                    { label: 'Remove ForceField', value: 'FORCEFIELD_REMOVE', description: 'Remove ForceFields' }
                                ]
                            }]
                        }]
                    }
                });
            }


            return NextResponse.json({
                type: 4,
                data: { content: message }
            });
        }

        // Handle Button Clicks (Vercel)
        if (type === 3) {
            const cid = interactionData?.custom_id ?? '';
            if (!cid) {
                return NextResponse.json({ error: 'Missing component custom_id' }, { status: 400 });
            }

            const staffBlockServerAction = parseStaffBlockServerCustomId(cid);
            if (staffBlockServerAction) {
                if (!(await hasGlobalManagementPermission(userId, 'BLOCK_SERVERS'))) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: 'You do not have permission to block servers.', flags: 64 }
                    });
                }

                const removalReason = getStaffActionReason(interaction.message);
                const blockReason = removalReason
                    ? `Blocked after staff removal: ${truncateText(removalReason, 900)}`
                    : 'Blocked from Ro-Link after staff removal.';

                try {
                    const result = await blockServerFromStaffAction({
                        guildId: staffBlockServerAction.guildId,
                        fallbackGuildName: getStaffActionServerName(interaction.message),
                        fallbackOwnerId: staffBlockServerAction.ownerId,
                        blockedBy: userId,
                        reason: blockReason,
                    });

                    return NextResponse.json({
                        type: 7,
                        data: {
                            components: buildStaffBlockServerComponents(
                                staffBlockServerAction.guildId,
                                result.ownerId || staffBlockServerAction.ownerId,
                                true,
                            ),
                        },
                    });
                } catch (error) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `Failed to block server: ${String(error instanceof Error ? error.message : error)}`,
                            flags: 64,
                        }
                    });
                }
            }

            // Public Button: Report Form
            if (cid === 'report_open') {
                return NextResponse.json({
                    type: 9,
                    data: {
                        title: "Submit Player Report",
                        custom_id: "report_submit",
                        components: [{
                            type: 1,
                            components: [{
                                type: 4,
                                custom_id: "target_input",
                                label: "Roblox User or Discord ID",
                                style: 1,
                                min_length: 3,
                                max_length: 32,
                                placeholder: "Username or User ID",
                                required: true
                            }]
                        }, {
                            type: 1,
                            components: [{
                                type: 4,
                                custom_id: "reason",
                                label: "Reason & Evidence",
                                style: 2,
                                min_length: 10,
                                max_length: 1000,
                                placeholder: "Describe what happened...",
                                required: true
                            }]
                        }]
                    }
                });
            }

            // Permission Check for buttons/components
            let requiredPerm = 'can_manage_reports'; // Default for most report/moderation buttons

            if (
                cid === 'misc_menu'
                || cid.startsWith('misc_modal_')
                || cid === 'moderation_menu'
                || cid.startsWith('moderation_modal_')
                || cid === 'lookup_manage'
                || cid === 'servers_select'
                || cid.startsWith('server_action|')
                || cid.startsWith('server_player_action|')
            ) {
                // Determine if it should be a misc action check, for now we allow if they have dashboard access
                requiredPerm = cid === 'lookup_manage' ? 'can_lookup' : 'can_access_dashboard';
            } else if (cid === 'report_open' || cid === 'report_submit') {
                // Anyone can OPEN a report form
                requiredPerm = '';
            } else if (cid.startsWith('staff_note_modal|')) {
                requiredPerm = 'can_lookup';
            }

            const hasPerms = cid === 'lookup_manage'
                ? await isServerStaff()
                : requiredPerm === '' ? true : await checkPermission(requiredPerm);

            if (!hasPerms) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ You do not have permission to perform this action. Requires '${requiredPerm.replace('can_', '').replace('_', ' ')}' permission.`, flags: 64 }
                });
            }

            if (cid.startsWith('staff_note_modal|')) {
                return NextResponse.json({
                    type: 9,
                    data: {
                        title: 'Add Staff Note',
                        custom_id: cid,
                        components: [{
                            type: 1,
                            components: [{
                                type: 4,
                                custom_id: 'staff_note',
                                label: 'Staff Note',
                                style: 2,
                                min_length: 1,
                                max_length: 1500,
                                placeholder: 'Add context only server staff should see.',
                                required: true
                            }]
                        }]
                    }
                });
            }

            if (cid === 'lookup_manage') {
                return NextResponse.json({
                    type: 4,
                    data: buildManagePanelResponse(),
                });
            }

            const parsedReportAction = parseReportCustomId(cid);
            if (parsedReportAction) {
                const currentGuildId = String(guild_id || '').trim();
                if (!currentGuildId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: Reports can only be managed from a server channel.`, flags: 64 }
                    });
                }

                const { action: reportAction, target } = parsedReportAction;
                const resolvedReportId = parsedReportAction.reportId || await findPendingReportIdByTarget(currentGuildId, target);
                if (!resolvedReportId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: The matching pending report could not be found for \`${target}\`.`, flags: 64 }
                    });
                }

                if (reportAction === 'switch_roblox' || reportAction === 'switch_discord') {
                    return NextResponse.json({
                        type: 7,
                        data: {
                            components: buildReportChannelComponents(
                                resolvedReportId,
                                target,
                                reportAction === 'switch_roblox' ? 'roblox' : 'discord',
                            ),
                        },
                    });
                }

                if (reportAction === 'dismiss') {
                    try {
                        await updateReportFromChannel(
                            resolvedReportId,
                            currentGuildId,
                            String(user?.id || ''),
                            `Dismissed from reports Discord channel by ${userTag}`,
                            'DISMISSED',
                        );
                        await logAction(currentGuildId, 'REPORT_DISMISSED', target, logActor, 'Dismissed from reports Discord channel');
                    } catch (error) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `Error: Failed to dismiss report: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
                        });
                    }

                    return NextResponse.json({
                        type: 7,
                        data: {
                            components: buildReportChannelComponents(resolvedReportId, target, 'discord', true),
                        },
                    });
                }

                if (reportAction === 'discord_kick' || reportAction === 'discord_ban') {
                    const targetId = await resolveDiscordTargetId(target);
                    if (!targetId) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `Error: Could not resolve Discord ID for \`${target}\`.`, flags: 64 }
                        });
                    }

                    const discordAction = reportAction === 'discord_ban' ? 'ban' : 'kick';
                    const res = await fetch(`https://discord.com/api/v10/guilds/${currentGuildId}/${discordAction === 'ban' ? 'bans' : 'members'}/${targetId}`, {
                        method: discordAction === 'ban' ? 'PUT' : 'DELETE',
                        headers: {
                            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: discordAction === 'ban' ? JSON.stringify({ reason: 'Ro-Link Reporting Action' }) : undefined
                    });

                    if (!res.ok) {
                        const err = await res.text();
                        return NextResponse.json({
                            type: 4,
                            data: { content: `Error: Failed to ${discordAction} user: ${err}`, flags: 64 }
                        });
                    }

                    try {
                        await updateReportFromChannel(
                            resolvedReportId,
                            currentGuildId,
                            String(user?.id || ''),
                            `${discordAction.toUpperCase()} (Discord) executed from reports channel by ${userTag}`,
                            'RESOLVED',
                        );
                        await logAction(currentGuildId, discordAction.toUpperCase(), target, logActor, 'Reports Discord channel action');
                    } catch (error) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `Error: The moderation action succeeded, but updating the report failed: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
                        });
                    }

                    return NextResponse.json({
                        type: 7,
                        data: {
                            components: buildReportChannelComponents(resolvedReportId, target, 'discord', true),
                        },
                    });
                }

                const command = reportAction === 'roblox_ban' ? 'BAN' : 'KICK';
                try {
                    const hierarchyCheck = await evaluateModerationRoleHierarchy({
                        serverId: currentGuildId,
                        moderatorDiscordId: String(user?.id || ''),
                        targetRobloxUsername: target,
                    });

                    if (!hierarchyCheck.allowed) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `❌ ${hierarchyCheck.message}`, flags: 64 }
                        });
                    }
                } catch (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
                    });
                }

                try {
                    await Promise.all([
                        supabase.from('command_queue').insert([{
                            server_id: currentGuildId,
                            command,
                            args: { username: target, reason: 'Reports Discord Channel Action', moderator: userTag },
                            status: 'PENDING'
                        }]),
                        triggerMessaging(command, { username: target, reason: 'Reports Discord Channel Action', moderator: userTag }),
                        logAction(currentGuildId, command, target, logActor, 'Reports Discord channel action'),
                    ]);

                    await updateReportFromChannel(
                        resolvedReportId,
                        currentGuildId,
                        String(user?.id || ''),
                        `${command} (Roblox) executed from reports channel by ${userTag}`,
                        'RESOLVED',
                    );
                } catch (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: Failed to queue ${command} for \`${target}\`: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 7,
                    data: {
                        components: buildReportChannelComponents(resolvedReportId, target, 'roblox', true),
                    },
                });
            }

            if (cid.startsWith('switch_')) {
                const currentGuildId = String(guild_id || '').trim();
                const target = cid.split('_').pop() || '';
                const fallbackReportId = currentGuildId ? await findPendingReportIdByTarget(currentGuildId, target) : null;

                if (fallbackReportId) {
                    return NextResponse.json({
                        type: 7,
                        data: {
                            components: buildReportChannelComponents(
                                fallbackReportId,
                                target,
                                cid.startsWith('switch_roblox') ? 'roblox' : 'discord',
                            ),
                        },
                    });
                }
            }

            if (cid === 'servers_select') {
                const jobId = String(interactionData?.values?.[0] ?? '').trim();
                const liveServers = await fetchLiveServers(guild_id);
                const selectedServer = liveServers.find((liveServer) => String(liveServer.id || '') === jobId);
                const { data: serverSettings } = await supabase
                    .from('servers')
                    .select('place_id')
                    .eq('id', guild_id)
                    .maybeSingle<{ place_id?: string | null }>();

                if (!selectedServer) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: 'That live server is no longer active.', flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 7,
                    data: {
                        embeds: [buildServerEmbed(selectedServer, serverSettings?.place_id)],
                        components: buildServerActionComponents(jobId, serverSettings?.place_id),
                    }
                });
            }

            if (cid.startsWith('server_action|') || cid.startsWith('server_player_action|')) {
                const parts = cid.split('|');
                const isPlayerAction = parts[0] === 'server_player_action';
                const jobId = decodeURIComponent(parts[1] || '');
                const username = isPlayerAction ? decodeURIComponent(parts[2] || '') : '';
                const command = String(interactionData?.values?.[0] ?? '').trim().toUpperCase();
                const args: Record<string, unknown> = {
                    job_id: jobId,
                    moderator: userTag,
                    reason: 'Discord live server action',
                };

                if (isPlayerAction) {
                    args.username = username;
                }

                const target = isPlayerAction ? username : jobId;
                const logActionName = command === 'UPDATE' ? 'UPDATE_SERVERS' : command;
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command,
                        args,
                        status: 'PENDING',
                    }]),
                    triggerMessaging(command, args),
                    logAction(guild_id, logActionName, target, logActor, 'Discord live server action'),
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: 'Failed to queue live server action.', flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: { content: `Queued **${command}** for ${isPlayerAction ? `\`${username}\`` : `server \`${formatJobId(jobId)}\``}.`, flags: 64 }
                });
            }

            if (cid.startsWith('discord_')) {
                const parts = cid.split('_');
                const discAction = parts[1];
                const target = parts.slice(2).join('_');
                const currentGuildId = String(guild_id || '').trim();
                const targetId = await resolveDiscordTargetId(target);

                if (!targetId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: Could not resolve Discord ID for \`${target}\`.`, flags: 64 }
                    });
                }

                const res = await fetch(`https://discord.com/api/v10/guilds/${currentGuildId}/${discAction === 'ban' ? 'bans' : 'members'}/${targetId}`, {
                    method: discAction === 'ban' ? 'PUT' : 'DELETE',
                    headers: {
                        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: discAction === 'ban' ? JSON.stringify({ reason: 'Ro-Link Reporting Action' }) : undefined
                });

                if (!res.ok) {
                    const err = await res.text();
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: Failed to ${discAction} user: ${err}`, flags: 64 }
                    });
                }

                const fallbackReportId = currentGuildId ? await findPendingReportIdByTarget(currentGuildId, target) : null;
                if (fallbackReportId && currentGuildId) {
                    try {
                        await updateReportFromChannel(
                            fallbackReportId,
                            currentGuildId,
                            String(user?.id || ''),
                            `${discAction.toUpperCase()} (Discord) executed from reports channel by ${userTag}`,
                            'RESOLVED',
                        );
                    } catch (error) {
                        console.error('[REPORTS] Failed to resolve legacy Discord report action:', error);
                    }
                }

                await logAction(currentGuildId, discAction.toUpperCase(), target, logActor, 'Reports Discord channel action');

                return NextResponse.json({
                    type: 4,
                    data: { content: `Success: Successfully **${discAction.toUpperCase()}ED** <@${targetId}> from the server.`, flags: 64 }
                });
            }

            if (cid.startsWith('KICK_0_') || cid.startsWith('BAN_0_')) {
                const currentGuildId = String(guild_id || '').trim();
                const action = cid.startsWith('BAN_0_') ? 'BAN' : 'KICK';
                const username = cid.split('_').slice(2).join('_');
                const fallbackReportId = currentGuildId ? await findPendingReportIdByTarget(currentGuildId, username) : null;

                if (fallbackReportId) {
                    try {
                        await Promise.all([
                            supabase.from('command_queue').insert([{
                                server_id: currentGuildId,
                                command: action,
                                args: { username, reason: 'Discord Button Action', moderator: userTag },
                                status: 'PENDING'
                            }]),
                            triggerMessaging(action, { username, reason: 'Discord Button Action', moderator: userTag }),
                            logAction(currentGuildId, action, username, logActor, 'Discord Button Action')
                        ]);

                        await updateReportFromChannel(
                            fallbackReportId,
                            currentGuildId,
                            String(user?.id || ''),
                            `${action} (Roblox) executed from reports channel by ${userTag}`,
                            'RESOLVED',
                        );
                    } catch (error) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `Error: Failed to queue ${action} for \`${username}\`: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
                        });
                    }

                    return NextResponse.json({
                        type: 4,
                        data: { content: `Success: **${action}** command queued for \`${username}\`.`, flags: 64 }
                    });
                }
            }

            if (cid === 'moderation_menu') {
                const action = interactionData?.values?.[0] ?? '';
                if (!MODERATION_MENU_ACTIONS.includes(action as typeof MODERATION_MENU_ACTIONS[number])) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: 'Invalid moderation action.', flags: 64 }
                    });
                }

                const components = [];
                if (['BAN', 'KICK', 'UNBAN', 'SOFTBAN'].includes(action)) {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'username',
                            label: 'Roblox Username',
                            style: 1,
                            placeholder: 'Enter the Roblox username',
                            required: true
                        }]
                    });
                }

                if (['BAN', 'KICK', 'SOFTBAN', 'UPDATE'].includes(action)) {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'reason',
                            label: action === 'UPDATE' ? 'Update Message' : 'Reason',
                            style: 2,
                            placeholder: action === 'UPDATE' ? 'Message shown when players are kicked' : 'Reason for this action',
                            required: false
                        }]
                    });
                }

                if (action === 'SOFTBAN') {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'duration_seconds',
                            label: 'Duration Seconds',
                            style: 1,
                            placeholder: '3600',
                            required: false
                        }]
                    });
                }

                if (action === 'SHUTDOWN') {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'job_id',
                            label: 'Job ID',
                            style: 1,
                            placeholder: 'Leave blank for all active servers',
                            required: false
                        }]
                    });
                }

                return NextResponse.json({
                    type: 9,
                    data: {
                        title: `Moderation: ${action}`,
                        custom_id: `moderation_modal_${action}`,
                        components
                    }
                });
            }

            if (cid === 'misc_menu') {
                const action = interactionData?.values?.[0] ?? '';
                if (!action) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: '❌ Invalid misc action.', flags: 64 }
                    });
                }

                const components = [{
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'target_user',
                        label: "Target Username",
                        style: 1,
                        placeholder: action === 'VIEW' ? 'Leave blank to reset your camera' : 'Enter the Roblox username',
                        required: action !== 'VIEW'
                    }]
                }];

                if (action === 'SET_CHAR') {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'char_user',
                            label: "Character Username",
                            style: 1,
                            placeholder: 'Username of appearance to copy',
                            required: true
                        }]
                    });
                }

                if (VALUE_INPUT_MISC_COMMANDS.has(action)) {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'amount',
                            label: 'Amount',
                            style: 1,
                            placeholder: 'Enter a number',
                            required: true
                        }]
                    });
                }

                if (action === 'TEAM') {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'team_name',
                            label: 'Roblox Team Name',
                            style: 1,
                            placeholder: 'Exact team name',
                            required: true
                        }]
                    });
                }

                if (action === 'TELEPORT_TO_ME') {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'moderator_username',
                            label: 'Your Roblox Username',
                            style: 1,
                            placeholder: 'Moderator username in-game',
                            required: true
                        }]
                    });
                }

                return NextResponse.json({
                    type: 9,
                    data: {
                        title: `Action: ${action}`,
                        custom_id: `misc_modal_${action}`,
                        components: components
                    }
                });
            }

            if (cid.startsWith('switch_')) {
                const isRoblox = cid.startsWith('switch_roblox');
                const target = cid.split('_').pop();

                const components = [{
                    type: 1,
                    components: isRoblox ? [
                        { type: 2, style: 2, label: 'Kick (Roblox)', custom_id: `KICK_0_${target}` },
                        { type: 2, style: 4, label: 'Ban (Roblox)', custom_id: `BAN_0_${target}` },
                        { type: 2, style: 1, label: 'Discord Actions', custom_id: `switch_discord_${target}` }
                    ] : [
                        { type: 2, style: 2, label: 'Kick (Discord)', custom_id: `discord_kick_${target}` },
                        { type: 2, style: 4, label: 'Ban (Discord)', custom_id: `discord_ban_${target}` },
                        { type: 2, style: 1, label: 'Roblox Actions', custom_id: `switch_roblox_${target}` }
                    ]
                }];

                return NextResponse.json({
                    type: 7, // UPDATE_MESSAGE
                    data: { components }
                });
            }

            if (cid.startsWith('discord_')) {
                const parts = cid.split('_');
                const discAction = parts[1]; // kick or ban
                const target = parts.slice(2).join('_');

                let targetId = target;
                if (target.includes('<@')) {
                    targetId = target.replace(/[<@!>]/g, '');
                }

                // If not numeric, it might be a username, try resolving
                if (isNaN(Number(targetId))) {
                    const { data } = await supabase.from('verified_users').select('discord_id').ilike('roblox_username', target).maybeSingle();
                    if (data) targetId = data.discord_id;
                }

                if (isNaN(Number(targetId))) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Could not resolve Discord ID for \`${target}\`.`, flags: 64 }
                    });
                }

                const res = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/${discAction === 'ban' ? 'bans' : 'members'}/${targetId}`, {
                    method: discAction === 'ban' ? 'PUT' : 'DELETE',
                    headers: {
                        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: discAction === 'ban' ? JSON.stringify({ reason: 'Ro-Link Reporting Action' }) : undefined
                });

                if (!res.ok) {
                    const err = await res.text();
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to ${discAction} user: ${err}`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: { content: `✅ Successfully **${discAction.toUpperCase()}ED** <@${targetId}> from the server.`, flags: 64 }
                });
            }

            const parts = cid.split('_');
            const action = parts[0];
            const username = parts.slice(2).join('_');

            // Parallelize Button Actions
            await Promise.all([
                supabase.from('command_queue').insert([{
                    server_id: guild_id,
                    command: action.toUpperCase(),
                    args: { username, reason: 'Discord Button Action', moderator: userTag },
                    status: 'PENDING'
                }]),
                triggerMessaging(action.toUpperCase(), { username, reason: 'Discord Button Action', moderator: userTag }), // Will fetch server internally
                logAction(guild_id, action.toUpperCase(), username, logActor, 'Discord Button Action')
            ]);

            return NextResponse.json({
                type: 4,
                data: { content: `✅ **${action.toUpperCase()}** command queued for \`${username}\`.`, flags: 64 }
            });
        }

        // Handle Modal Submissions (Vercel)
        if (type === 5) {
            const custom_id = interactionData?.custom_id ?? '';
            const modalComponents = interactionData?.components ?? [];

            if (!custom_id) {
                return NextResponse.json({ error: 'Missing modal custom_id' }, { status: 400 });
            }

            if (custom_id.startsWith('staff_note_modal|')) {
                const hasLookupPerms = await checkPermission('can_lookup');
                if (!hasLookupPerms) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: 'You do not have permission to add staff notes.', flags: 64 }
                    });
                }

                try {
                    const target = decodeStaffNoteModalTarget(custom_id.replace('staff_note_modal|', ''));
                    const note = await createStaffNote(supabase, {
                        serverId: guild_id,
                        target,
                        note: getModalField(modalComponents, 'staff_note'),
                        createdByDiscordId: userId,
                        createdByTag: userTag,
                    });

                    await logAction(
                        guild_id,
                        'STAFF_NOTE',
                        note.target_roblox_username || note.target_roblox_id || note.target_discord_id || 'Unknown User',
                        logActor,
                        'Staff note added',
                    );

                    return NextResponse.json({
                        type: 4,
                        data: { content: `Saved staff note for **${getStaffNoteTargetLabel(target)}**.`, flags: 64 }
                    });
                } catch (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: ${getErrorMessage(error, 'Failed to save staff note.')}`, flags: 64 }
                    });
                }
            }

            if (custom_id.startsWith('moderation_modal_')) {
                const action = custom_id.replace('moderation_modal_', '');
                const targetUser = getModalField(modalComponents, 'username');
                const reason = getModalField(modalComponents, 'reason') || 'No reason provided';
                const jobId = getModalField(modalComponents, 'job_id');
                const durationValue = Number(getModalField(modalComponents, 'duration_seconds') || 3600);
                const durationSeconds = Number.isFinite(durationValue) && durationValue > 0 ? Math.floor(durationValue) : 3600;
                const command = action === 'UPDATE' ? 'UPDATE' : action;
                const args: Record<string, unknown> = { moderator: userTag };
                let target = targetUser || 'ALL';
                let msgContent = `Queued **${command}**.`;

                if (['BAN', 'KICK', 'UNBAN', 'SOFTBAN'].includes(command)) {
                    args.username = targetUser;
                    args.reason = reason;
                    target = targetUser;
                    msgContent = `Queued **${command}** for \`${targetUser}\`.`;
                }

                if (command === 'SOFTBAN') {
                    args.duration_seconds = durationSeconds;
                    msgContent = `Queued **SOFTBAN** for \`${targetUser}\` for ${durationSeconds} seconds.`;
                }

                if (command === 'UPDATE') {
                    args.reason = reason === 'No reason provided' ? 'Manual Update Triggered' : reason;
                    target = 'ALL';
                    msgContent = 'Queued **UPDATE** for all game servers.';
                }

                if (command === 'SHUTDOWN') {
                    args.job_id = jobId;
                    target = jobId || 'ALL';
                    msgContent = jobId ? `Queued **SHUTDOWN** for job \`${jobId}\`.` : 'Queued **SHUTDOWN** for all active game servers.';
                }

                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command,
                        args,
                        status: 'PENDING'
                    }]),
                    triggerMessaging(command, args),
                    logAction(guild_id, command === 'UPDATE' ? 'UPDATE_SERVERS' : command, target, logActor, reason)
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: 'Failed to queue moderation command.', flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: { content: msgContent, flags: 64 }
                });
            }

            if (custom_id.startsWith('misc_modal_')) {
                const action = custom_id.replace('misc_modal_', '');

                let targetUser = getModalField(modalComponents, 'target_user');
                const args: MiscCommandArgs = { username: targetUser, moderator: userTag };

                let msgContent = `✅ Queuing **${action}** for **${targetUser}**...`;

                if (action === 'SET_CHAR') {
                    const charUser = getModalField(modalComponents, 'char_user');
                    args.char_user = charUser;
                    msgContent = `✅ Queuing **Set Character** (to ${charUser}) for **${targetUser}**...`;
                }

                if (VALUE_INPUT_MISC_COMMANDS.has(action)) {
                    const amount = Number(getModalField(modalComponents, 'amount'));
                    if (!Number.isFinite(amount)) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: 'Please provide a valid amount.', flags: 64 }
                        });
                    }
                    args.amount = amount;
                    msgContent = `Queuing **${action}** (${amount}) for **${targetUser}**...`;
                }

                if (action === 'TEAM') {
                    const teamName = getModalField(modalComponents, 'team_name').trim();
                    if (!teamName) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: 'Please provide a Roblox team name.', flags: 64 }
                        });
                    }
                    args.team_name = teamName;
                    msgContent = `Queuing **Team** (${teamName}) for **${targetUser}**...`;
                }

                if (action === 'VIEW') {
                    const linkedRobloxUsername = await getLinkedRobloxUsername(userId);
                    if (!linkedRobloxUsername) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: 'Link your Discord account to Roblox before using View.', flags: 64 }
                        });
                    }
                    args.moderator_roblox_username = linkedRobloxUsername;
                    if (!targetUser) {
                        targetUser = linkedRobloxUsername;
                        args.username = linkedRobloxUsername;
                    }
                    msgContent = targetUser === linkedRobloxUsername
                        ? 'Queuing **View** camera reset...'
                        : `Queuing **View** for **${targetUser}**...`;
                }

                if (action === 'TELEPORT_TO_ME') {
                    args.moderator_roblox_username = getModalField(modalComponents, 'moderator_username');
                    msgContent = `Queuing **Teleport To Me** for **${targetUser}**...`;
                }

                const queueRes = await queueResolvedCommand(action, args);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: queueRes.error || 'Failed to queue misc action.', flags: 64 }
                    });
                }

                await logAction(guild_id, action, targetUser || 'self', logActor, action === 'SET_CHAR' ? `Set character to ${args.char_user}` : 'Misc Action');

                return NextResponse.json({
                    type: 4,
                    data: { content: msgContent, flags: 64 }
                });
            }

            if (custom_id === 'report_submit') {
                const targetInput = getModalField(modalComponents, 'target_input');
                const reason = getModalField(modalComponents, 'reason');

                // 1. Save to Database
                const reportClient = getSupabaseAdmin();
                const { data: createdReport, error: dbError } = await reportClient.from('reports').insert([{
                    server_id: guild_id,
                    reporter_discord_id: member?.user?.id || interactionUser?.id,
                    reporter_roblox_username: null,
                    reported_roblox_username: targetInput,
                    reason: reason,
                    status: 'PENDING'
                }]).select('id').single();

                if (dbError) {
                    console.error('Report DB Error:', dbError);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to submit report. Please try again later.`, flags: 64 }
                    });
                }

                if (!createdReport?.id) {
                    console.error('Report DB Error: missing report id after insert');
                    return NextResponse.json({
                        type: 4,
                        data: { content: `Error: Failed to create the report record. Please try again later.`, flags: 64 }
                    });
                }

                // 2. Send Notification to Channel (if configured)
                const { data: server } = await reportClient
                    .from('servers')
                    .select('reports_channel_id')
                    .eq('id', guild_id)
                    .single();

                let reportForwardWarning = '';

                if (server?.reports_channel_id) {
                    console.log(`[REPORTS] Forwarding report to channel: ${server.reports_channel_id}`);

                    // Fetch roles with "Manage Reports" permission
                    const { data: modRoles } = await reportClient
                        .from('dashboard_roles')
                        .select('discord_role_id')
                        .eq('server_id', guild_id)
                        .eq('can_manage_reports', true);

                    const roleMention = modRoles && modRoles.length > 0
                        ? modRoles.map((r: { discord_role_id?: string | null }) => `<@&${r.discord_role_id}>`).join(' ')
                        : '';

                    const forwardResponse = await fetch(`https://discord.com/api/v10/channels/${server.reports_channel_id}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: roleMention,
                            embeds: [{
                                title: '🚨 New User Report',
                                color: 0xff4444,
                                fields: [
                                    { name: 'Reported User', value: `\`${targetInput}\``, inline: true },
                                    { name: 'Reporter', value: `<@${member?.user?.id || interactionUser?.id}>`, inline: true },
                                    { name: 'Reason', value: reason }
                                ],
                                footer: { text: `Ro-Link Systems • ID: ${guild_id}` },
                                timestamp: new Date().toISOString()
                            }],
                            components: buildReportChannelComponents(createdReport.id, targetInput, 'discord')
                        })
                    }).catch((err) => {
                        console.error('[REPORTS] Error forwarding report to Discord:', err);
                        return null;
                    });

                    if (!forwardResponse) {
                        reportForwardWarning = ' Your report was saved, but forwarding it to the reports channel failed.';
                    } else if (!forwardResponse.ok) {
                        const forwardErrorBody = await forwardResponse.text().catch(() => '');
                        console.error(`[REPORTS] Failed to send to channel ${server.reports_channel_id}: ${forwardResponse.status}${forwardErrorBody ? ` - ${forwardErrorBody}` : ''}`);
                        reportForwardWarning = ' Your report was saved, but the reports channel notification failed.';
                    } else {
                        console.log(`[REPORTS] Successfully forwarded report to channel ${server.reports_channel_id}`);
                    }
                } else {
                    console.log(`[REPORTS] No reports channel configured for guild ${guild_id}`);
                }

                if (reportForwardWarning) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `Report Submitted!${reportForwardWarning}`,
                            flags: 64
                        }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: { content: `✅ **Report Submitted!** The moderation team has been notified.`, flags: 64 }
                });
            }

            if (custom_id === 'setup_modal') {
                const placeId = getModalField(modalComponents, 'place_id').trim();
                const universeId = getModalField(modalComponents, 'universe_id').trim();
                const openCloudKey = getModalField(modalComponents, 'api_key').trim();
                const blocked = await findBlockedServer(supabase, guild_id);
                if (blocked) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `âŒ ${getBlockedServerMessage(blocked)}`, flags: 64 }
                    });
                }

                const { data: existingServer } = await supabase
                    .from('servers')
                    .select('api_key')
                    .eq('id', guild_id)
                    .maybeSingle<{ api_key?: string | null }>();
                const generatedKey = existingServer?.api_key?.trim() || ('rl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

                const { error: dbError } = await supabase
                    .from('servers')
                    .upsert({
                        id: guild_id,
                        place_id: placeId,
                        universe_id: universeId,
                        open_cloud_key: openCloudKey,
                        api_key: generatedKey
                    });

                if (dbError) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Setup failed: ${dbError.message}`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        content: '✅ **Setup Successful!** Please follow the instructions below to complete the integration:',
                        embeds: getSetupEmbeds(guild_id, generatedKey),
                        flags: 64
                    }
                });
            }
        }

        return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 });
    } catch (error) {
        console.error('Interaction error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Helper for Setup Instructions
function getSetupEmbeds(guildId: string, apiKey: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const installerPluginUrl = 'https://create.roblox.com/store/asset/87859041511603/RoLink-installer';

    return [
        {
            title: 'Studio Setup Instructions',
            color: 0x2b2d31,
            description: "Follow these steps to integrate Ro-Link with your Roblox game.",
            thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
            fields: [
                { name: '1. Installer Plugin', value: `[Install the RoLink installer plugin](${installerPluginUrl}) from the Roblox Creator Store.`, inline: false },
                { name: '2. Open in Studio', value: "Open your experience in Roblox Studio, then launch **RoLink installer** from the **Plugins** tab.", inline: false },
                { name: '3. Security Key', value: "Copy the Security Key from the next embed and paste it into the installer when prompted.", inline: false },
                { name: '4. Publish', value: "Let the plugin place the Ro-Link bridge, then enable **HTTP Requests** and **API Services** if your experience requires them before publishing.", inline: false },
                { name: 'Dashboard', value: `[**Manage Server**](${baseUrl}/dashboard/${guildId})`, inline: false }
            ],
            footer: { text: 'Ro-Link Systems • Setup', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
            timestamp: new Date().toISOString()
        },
        {
            title: 'Ro-Link Security Key',
            color: 0x2b2d31,
            description: `Paste this key into the RoLink installer plugin in Roblox Studio.\n\n\`\`\`\n${apiKey}\n\`\`\``,
            footer: { text: 'KEEP YOUR SECURITY KEY PRIVATE!' },
            timestamp: new Date().toISOString()
        }
    ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getLuaCode(baseUrl: string, apiKey: string) {
    return `-- RoLink Core Bridge
local RoLink = {}
local Http = game:GetService("HttpService")
local Players = game:GetService("Players")
local MS = game:GetService("MessagingService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Teams = game:GetService("Teams")

local URL = "${baseUrl}"
local KEY = "${apiKey}"
local POLL_INTERVAL = 5

function RoLink:Initialize()
	-- 1. Fetch Server Settings
	task.spawn(function()
		local s, r = pcall(function()
			return Http:RequestAsync({
				Url = URL .. "/api/v1/settings",
				Method = "GET",
				Headers = { ["x-api-key"] = KEY }
			})
		end)
		if s and r.StatusCode == 200 then
			self.settings = Http:JSONDecode(r.Body)
		end
	end)

	self.loadedModules = self.loadedModules or {}
	self.moduleCommands = self.moduleCommands or {}
	self.moduleCommandDefinitions = self.moduleCommandDefinitions or {}
	self.moduleHooks = self.moduleHooks or {
		AdminPanelOpened = {},
		CommandBarOpened = {}
	}

	task.spawn(function()
		self:LoadModules()
		while true do
			task.wait(60)
			self:LoadModules()
		end
	end)

	-- 2. Security Check (Block Unverified Joins)
	Players.PlayerAdded:Connect(function(player)
		-- Wait for settings to load if they haven't yet
		for i=1, 5 do
			if self.settings then break end
			task.wait(0.5)
		end
		
		if self.settings and self.settings.blockUnverified then
			local s, r = pcall(function()
				return Http:RequestAsync({
					Url = URL .. "/api/v1/lookup?robloxId=" .. player.UserId,
					Method = "GET"
				})
			end)
			
			-- 404 means the user has no mapping in Ro-Link
			if s and r.StatusCode == 404 then
				player:Kick("\n[Ro-Link Security]\n\nThis game requires a linked Discord account.\n\nLink your account at: " .. URL .. "/verify")
			end
		end
	end)

	-- 3. Subscribe to Command Service
	task.spawn(function()
		pcall(function()
			MS:SubscribeAsync("AdminActions", function(msg)
				local d = msg.Data
				if typeof(d) == "string" then d = Http:JSONDecode(d) end
				self:Execute(d)
			end)
		end)
	end)

	-- 4. Command Polling Fallback
	task.spawn(function()
		while true do
			local id = game.JobId ~= "" and game.JobId or "STUDIO"
			local s, r = pcall(function()
				return Http:RequestAsync({
					Url = URL .. "/api/roblox/poll",
					Method = "POST",
					Headers = { ["Content-Type"] = "application/json", ["Authorization"] = "Bearer " .. KEY, ["x-api-key"] = KEY },
					Body = Http:JSONEncode({
						apiKey = KEY,
						jobId = id,
						playerCount = #Players:GetPlayers(),
						players = (function()
							local list = {}
							for _, p in ipairs(Players:GetPlayers()) do
								table.insert(list, {
									username = p.Name,
									displayName = p.DisplayName,
									userId = p.UserId
								})
							end
							return list
						end)()
					})
				})
			end)
			if s and r.StatusCode == 200 then
				local d = Http:JSONDecode(r.Body)
                if d.settings then
                    self.settings = self.settings or {}
                    self.settings.adminCmdsEnabled = d.settings.adminCmdsEnabled
                    self.settings.miscCmdsEnabled = d.settings.miscCmdsEnabled
                end
				for _, c in ipairs(d.commands or {}) do self:Execute(c) end
			end
			task.wait(POLL_INTERVAL)
		end
	end)
end

local function moduleKeyOf(moduleInfo)
	return tostring((moduleInfo and (moduleInfo.slug or moduleInfo.id)) or "unknown")
end

local function resolvePlayers(target, defaultAll)
	if target == nil then
		return defaultAll and Players:GetPlayers() or {}
	end
	if typeof(target) == "Instance" and target:IsA("Player") then
		return { target }
	end
	if type(target) == "number" then
		for _, player in ipairs(Players:GetPlayers()) do
			if player.UserId == target then
				return { player }
			end
		end
		return {}
	end
	if type(target) == "string" then
		local value = string.gsub(string.gsub(target, "^%s+", ""), "%s+$", "")
		local lowered = string.lower(value)
		if lowered == "all" or lowered == "server" or lowered == "everyone" then
			return Players:GetPlayers()
		end
		local exact = Players:FindFirstChild(value)
		if exact then
			return { exact }
		end
		local userId = tonumber(value)
		if userId then
			for _, player in ipairs(Players:GetPlayers()) do
				if player.UserId == userId then
					return { player }
				end
			end
		end
	end
	return {}
end

local function attachUiResult(playerGui, moduleInfo, result)
	if typeof(result) ~= "Instance" then
		return result
	end
	if result.Parent then
		return result
	end
	if result:IsA("ScreenGui") then
		result.ResetOnSpawn = false
		result.Parent = playerGui
		return result
	end
	local screenGui = Instance.new("ScreenGui")
	screenGui.Name = "RoLinkModuleUI_" .. moduleKeyOf(moduleInfo)
	screenGui.ResetOnSpawn = false
	screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	screenGui.Parent = playerGui
	result.Parent = screenGui
	return result
end

local function buildUiTree(spec, parent)
	if type(spec) ~= "table" then
		return nil
	end
	local className = tostring(spec.ClassName or spec.className or spec[1] or "")
	if className == "" then
		return nil
	end
	local ok, instance = pcall(function()
		return Instance.new(className)
	end)
	if not ok or not instance then
		return nil
	end
	local props = type(spec.Properties) == "table" and spec.Properties or spec.props
	if type(props) == "table" then
		for key, value in pairs(props) do
			if key ~= "Parent" then
				pcall(function()
					instance[key] = value
				end)
			end
		end
	end
	instance.Parent = parent
	local children = type(spec.Children) == "table" and spec.Children or spec.children
	if type(children) == "table" then
		for _, childSpec in ipairs(children) do
			buildUiTree(childSpec, instance)
		end
	end
	return instance
end

function RoLink:RequestModuleJson(path, method, body)
	local request = {
		Url = URL .. path,
		Method = method or "GET",
		Headers = { ["Content-Type"] = "application/json", ["x-api-key"] = KEY }
	}
	if body ~= nil then
		local encodeOk, encoded = pcall(function()
			return Http:JSONEncode(body)
		end)
		if not encodeOk then
			return false, "Failed to encode request body: " .. tostring(encoded)
		end
		request.Body = encoded
	end
	local ok, response = pcall(function()
		return Http:RequestAsync(request)
	end)
	if not ok or not response then
		return false, tostring(response)
	end
	if not response.Success and response.StatusCode ~= 200 then
		local message = tostring(response.StatusCode)
		local decodeOk, decoded = pcall(function()
			return Http:JSONDecode(response.Body or "{}")
		end)
		if decodeOk and typeof(decoded) == "table" and decoded.error then
			message = tostring(decoded.error)
		end
		return false, message
	end
	local bodyText = tostring(response.Body or "")
	if bodyText == "" then
		return true, nil
	end
	local decodeOk, payload = pcall(function()
		return Http:JSONDecode(bodyText)
	end)
	if not decodeOk then
		return false, "Invalid JSON response."
	end
	return true, payload
end

function RoLink:SendModuleBotMessage(moduleInfo, target, user, channelId, content)
	local normalizedUser = user
	if typeof(user) == "Instance" and user:IsA("Player") then
		normalizedUser = {
			robloxUserId = user.UserId,
			username = user.Name,
			displayName = user.DisplayName
		}
	end
	return self:RequestModuleJson("/api/v1/game-admin/bot-message", "POST", {
		target = tostring(target or "channel"),
		user = normalizedUser,
		channelId = channelId,
		content = content,
		moduleId = moduleInfo and moduleInfo.id or nil,
		moduleSlug = moduleInfo and moduleInfo.slug or nil
	})
end

function RoLink:GetModuleDiscordChannels()
	local ok, payload = self:RequestModuleJson("/api/v1/game-admin/channels", "GET")
	if not ok then
		return false, payload
	end
	return true, payload and payload.channels or {}
end

function RoLink:GetModuleUserData(user)
	local identity = user
	if typeof(user) == "Instance" and user:IsA("Player") then
		identity = {
			robloxId = user.UserId,
			robloxUsername = user.Name
		}
	elseif type(user) == "number" then
		identity = {
			robloxId = user
		}
	elseif type(user) == "string" then
		local numeric = tonumber(user)
		if numeric then
			identity = {
				robloxId = user
			}
		else
			identity = {
				robloxUsername = user
			}
		end
	end
	return self:RequestModuleJson("/api/v1/game-admin/user-data", "POST", {
		user = identity
	})
end

function RoLink:GetModuleReports(options)
	local query = ""
	if type(options) == "table" then
		local params = {}
		for key, value in pairs(options) do
			if value ~= nil and value ~= "" then
				table.insert(params, Http:UrlEncode(tostring(key)) .. "=" .. Http:UrlEncode(tostring(value)))
			end
		end
		if #params > 0 then
			query = "?" .. table.concat(params, "&")
		end
	end
	local ok, payload = self:RequestModuleJson("/api/v1/game-admin/reports" .. query, "GET")
	if not ok then
		return false, payload
	end
	return true, payload and payload.reports or {}
end

function RoLink:GetModuleReport(reportId)
	local id = tostring(reportId or "")
	if id == "" then
		return false, "Report ID is required."
	end
	local ok, payload = self:RequestModuleJson("/api/v1/game-admin/reports/" .. Http:UrlEncode(id), "GET")
	if not ok then
		return false, payload
	end
	return true, payload and payload.report or nil
end

function RoLink:CreateModuleReport(body)
	return self:RequestModuleJson("/api/v1/game-admin/reports", "POST", body or {})
end

function RoLink:UpdateModuleReport(reportId, updates)
	local id = tostring(reportId or "")
	if id == "" then
		return false, "Report ID is required."
	end
	local ok, payload = self:RequestModuleJson("/api/v1/game-admin/reports/" .. Http:UrlEncode(id), "PATCH", updates or {})
	if not ok then
		return false, payload
	end
	return true, payload and payload.report or nil
end

function RoLink:CreateModuleUi(moduleInfo, target, sourceOrTree, props)
	if sourceOrTree == nil then
		sourceOrTree = target
		target = "all"
	end
	local latestModuleInfo = self:RefreshModuleConfig(moduleInfo)
	local results = {}
	for _, player in ipairs(resolvePlayers(target, true)) do
		local playerGui = player:FindFirstChildOfClass("PlayerGui") or player:WaitForChild("PlayerGui", 5)
		if playerGui then
			if type(sourceOrTree) == "table" then
				local result = buildUiTree(sourceOrTree, playerGui)
				results[player.Name] = result ~= nil
			elseif type(sourceOrTree) == "function" then
				local ok, result = pcall(sourceOrTree, { Player = player, PlayerGui = playerGui, Module = latestModuleInfo, Config = latestModuleInfo and latestModuleInfo.configSchema or {}, Settings = latestModuleInfo and latestModuleInfo.settings or {} }, player, props or {})
				results[player.Name] = ok and attachUiResult(playerGui, moduleInfo, result) or tostring(result)
			elseif type(sourceOrTree) == "string" and type(loadstring) == "function" then
				local chunk, loadError = loadstring(sourceOrTree)
				if chunk then
					local ok, result = pcall(chunk, { Player = player, PlayerGui = playerGui, Module = latestModuleInfo, Config = latestModuleInfo and latestModuleInfo.configSchema or {}, Settings = latestModuleInfo and latestModuleInfo.settings or {} }, player, props or {})
					results[player.Name] = ok and attachUiResult(playerGui, moduleInfo, result) or tostring(result)
				else
					results[player.Name] = tostring(loadError)
				end
			else
				results[player.Name] = "CreateUI expects source code, a function, or a UI tree table."
			end
		else
			results[player.Name] = "PlayerGui is not available."
		end
	end
	return results
end

function RoLink:RegisterModuleHook(hookName, moduleInfo, handler)
	if type(handler) ~= "function" then return end
	self.moduleHooks = self.moduleHooks or { AdminPanelOpened = {}, CommandBarOpened = {} }
	self.moduleHooks[hookName] = self.moduleHooks[hookName] or {}
	table.insert(self.moduleHooks[hookName], {
		handler = handler,
		moduleKey = moduleKeyOf(moduleInfo),
		module = moduleInfo
	})
end

function RoLink:FireModuleHook(hookName, player, payload)
	local hooks = self.moduleHooks and self.moduleHooks[hookName]
	if type(hooks) ~= "table" then return end
	for _, binding in ipairs(hooks) do
		local ok, hookError = pcall(binding.handler, player, payload or {}, self:BuildModuleContext(binding.module))
		if not ok then
			warn("[Ro-Link] Module hook failed: " .. tostring(hookError))
		end
	end
end

local function moduleConfigOf(moduleInfo)
	if type(moduleInfo) ~= "table" then
		return {}
	end
	return type(moduleInfo.configSchema) == "table" and moduleInfo.configSchema
		or type(moduleInfo.config) == "table" and moduleInfo.config
		or type(moduleInfo.CONFIG) == "table" and moduleInfo.CONFIG
		or {}
end

local function moduleSettingsOf(moduleInfo)
	if type(moduleInfo) == "table" and type(moduleInfo.settings) == "table" then
		return moduleInfo.settings
	end
	return {}
end

function RoLink:RefreshModuleConfig(moduleInfo)
	if type(moduleInfo) ~= "table" then
		return moduleInfo
	end

	local params = { "configOnly=1" }
	local moduleId = tostring(moduleInfo.id or "")
	local moduleSlug = tostring(moduleInfo.slug or "")
	if moduleId ~= "" then
		table.insert(params, "moduleId=" .. Http:UrlEncode(moduleId))
	end
	if moduleSlug ~= "" then
		table.insert(params, "moduleSlug=" .. Http:UrlEncode(moduleSlug))
	end

	local ok, payload = self:RequestModuleJson("/api/v1/game-admin/modules?" .. table.concat(params, "&"), "GET")
	if ok and type(payload) == "table" and type(payload.module) == "table" then
		for key, value in pairs(payload.module) do
			if key ~= "sourceCode" then
				moduleInfo[key] = value
			end
		end
	end

	return moduleInfo
end

function RoLink:BuildFreshModuleValue(moduleInfo, valueName)
	return setmetatable({}, {
		__index = function(_, key)
			local latestModule = self:RefreshModuleConfig(moduleInfo)
			local values = valueName == "Config" and moduleConfigOf(latestModule) or moduleSettingsOf(latestModule)
			return values[key]
		end,
		__newindex = function(_, key, value)
			local values = valueName == "Config" and moduleConfigOf(moduleInfo) or moduleSettingsOf(moduleInfo)
			values[key] = value
		end,
		__pairs = function()
			local latestModule = self:RefreshModuleConfig(moduleInfo)
			local values = valueName == "Config" and moduleConfigOf(latestModule) or moduleSettingsOf(latestModule)
			return pairs(values)
		end,
		__iter = function()
			local latestModule = self:RefreshModuleConfig(moduleInfo)
			local values = valueName == "Config" and moduleConfigOf(latestModule) or moduleSettingsOf(latestModule)
			return next, values
		end,
		__len = function()
			local latestModule = self:RefreshModuleConfig(moduleInfo)
			local values = valueName == "Config" and moduleConfigOf(latestModule) or moduleSettingsOf(latestModule)
			return #values
		end
	})
end

function RoLink:BuildModuleContext(moduleInfo)
	return {
		RoLink = self,
		Module = moduleInfo,
		Config = self:BuildFreshModuleValue(moduleInfo, "Config"),
		Settings = self:BuildFreshModuleValue(moduleInfo, "Settings"),
		GetConfig = function()
			return moduleConfigOf(self:RefreshModuleConfig(moduleInfo))
		end,
		GetSettings = function()
			return moduleSettingsOf(self:RefreshModuleConfig(moduleInfo))
		end,
		RefreshConfig = function()
			return self:RefreshModuleConfig(moduleInfo)
		end,
		Services = {
			HttpService = Http,
			Players = Players,
			MessagingService = MS
		},
		RegisterCommand = function(commandName, handler)
			if type(commandName) ~= "string" or type(handler) ~= "function" then return end
			local key = string.upper(commandName)
			self.moduleCommands[key] = {
				handler = handler,
				moduleKey = tostring((moduleInfo and (moduleInfo.slug or moduleInfo.id)) or "unknown"),
				module = moduleInfo
			}
			self.moduleCommandDefinitions[key] = self.moduleCommandDefinitions[key] or {
				Name = commandName,
				Title = commandName,
				Description = "Registered by " .. tostring((moduleInfo and (moduleInfo.name or moduleInfo.slug)) or "marketplace module"),
				Category = "Marketplace",
				TargetRequired = false,
				Fields = {}
			}
		end,
		RegisterPanelCommand = function(definition, handler)
			if type(definition) ~= "table" or type(handler) ~= "function" then return end
			local commandName = tostring(definition.Name or definition.name or definition.Command or definition.command or definition.Id or definition.id or "")
			if commandName == "" then return end
			local key = string.upper(commandName)
			self.moduleCommands[key] = {
				handler = handler,
				moduleKey = tostring((moduleInfo and (moduleInfo.slug or moduleInfo.id)) or "unknown"),
				module = moduleInfo
			}
			self.moduleCommandDefinitions[key] = definition
		end,
		OnAdminPanelOpened = function(handler)
			self:RegisterModuleHook("AdminPanelOpened", moduleInfo, handler)
		end,
		OnCommandBarOpened = function(handler)
			self:RegisterModuleHook("CommandBarOpened", moduleInfo, handler)
		end,
		SendBotMessage = function(target, user, channelId, content)
			return self:SendModuleBotMessage(moduleInfo, target, user, channelId, content)
		end,
		sendbotmessage = function(target, user, channelId, content)
			return self:SendModuleBotMessage(moduleInfo, target, user, channelId, content)
		end,
		GetDiscordChannels = function()
			return self:GetModuleDiscordChannels()
		end,
		GetUserData = function(user)
			return self:GetModuleUserData(user)
		end,
		GetReports = function(options)
			return self:GetModuleReports(options)
		end,
		GetReport = function(reportId)
			return self:GetModuleReport(reportId)
		end,
		CreateReport = function(body)
			return self:CreateModuleReport(body)
		end,
		UpdateReport = function(reportId, updates)
			return self:UpdateModuleReport(reportId, updates)
		end,
		CreateUI = function(target, sourceOrTree, props)
			return self:CreateModuleUi(moduleInfo, target, sourceOrTree, props)
		end,
		FindPlayer = function(target)
			return resolvePlayers(target, false)[1]
		end,
		GetPlayers = function()
			return Players:GetPlayers()
		end,
		Notify = function(target, message)
			print("[Ro-Link Module Notify]", tostring(message or target or ""))
			return true
		end,
		Log = function(...)
			print("[Ro-Link Module]", ...)
		end
	}
end

function RoLink:LoadModules()
	local loader = loadstring
	if type(loader) ~= "function" then
		warn("[Ro-Link] Add-on modules require ServerScriptService.LoadStringEnabled.")
		return
	end

	local ok, response = pcall(function()
		return Http:RequestAsync({
			Url = URL .. "/api/v1/game-admin/modules",
			Method = "GET",
			Headers = { ["x-api-key"] = KEY }
		})
	end)

	if not ok or not response or response.StatusCode ~= 200 then
		return
	end

	local decodedOk, payload = pcall(function()
		return Http:JSONDecode(response.Body)
	end)

	if not decodedOk or type(payload) ~= "table" or type(payload.modules) ~= "table" then
		return
	end

	for _, moduleInfo in ipairs(payload.modules) do
		local moduleKey = tostring(moduleInfo.slug or moduleInfo.id or "")
		local source = tostring(moduleInfo.sourceCode or "")
		local checksum = tostring(moduleInfo.sourceChecksum or moduleInfo.version or "")

		if moduleKey ~= "" and source ~= "" then
			local existing = self.loadedModules[moduleKey]
			if not existing or existing.checksum ~= checksum then
				for commandName, binding in pairs(self.moduleCommands) do
					if binding.moduleKey == moduleKey then
						self.moduleCommands[commandName] = nil
						if self.moduleCommandDefinitions then
							self.moduleCommandDefinitions[commandName] = nil
						end
					end
				end
				for _, handlers in pairs(self.moduleHooks or {}) do
					for index = #handlers, 1, -1 do
						if handlers[index].moduleKey == moduleKey then
							table.remove(handlers, index)
						end
					end
				end

				local chunk, loadError = loader(source)
				if not chunk then
					warn("[Ro-Link] Failed to load module " .. moduleKey .. ": " .. tostring(loadError))
				else
					local runOk, exported = pcall(chunk)
					if not runOk then
						warn("[Ro-Link] Module " .. moduleKey .. " failed during startup: " .. tostring(exported))
					else
						local context = self:BuildModuleContext(moduleInfo)
						local initFailed = false
						if type(exported) == "function" then
							exported = { Init = exported }
						end
						if type(exported) == "table" then
							if type(exported.Commands) == "table" then
								for commandName, handler in pairs(exported.Commands) do
									context.RegisterCommand(commandName, handler)
								end
							end
							if type(exported.OnAdminPanelOpened) == "function" then
								context.OnAdminPanelOpened(exported.OnAdminPanelOpened)
							elseif type(exported.AdminPanelOpened) == "function" then
								context.OnAdminPanelOpened(exported.AdminPanelOpened)
							end
							if type(exported.OnCommandBarOpened) == "function" then
								context.OnCommandBarOpened(exported.OnCommandBarOpened)
							elseif type(exported.CommandBarOpened) == "function" then
								context.OnCommandBarOpened(exported.CommandBarOpened)
							end
							if type(exported.Init) == "function" then
								local initOk, initError = pcall(exported.Init, context, moduleSettingsOf(context.RefreshConfig()))
								if not initOk then
									warn("[Ro-Link] Module " .. moduleKey .. " init failed: " .. tostring(initError))
									for commandName, binding in pairs(self.moduleCommands) do
										if binding.moduleKey == moduleKey then
											self.moduleCommands[commandName] = nil
											if self.moduleCommandDefinitions then
												self.moduleCommandDefinitions[commandName] = nil
											end
										end
									end
									for _, handlers in pairs(self.moduleHooks or {}) do
										for index = #handlers, 1, -1 do
											if handlers[index].moduleKey == moduleKey then
												table.remove(handlers, index)
											end
										end
									end
									initFailed = true
								end
							end
						end
						if not initFailed then
							self.loadedModules[moduleKey] = {
								checksum = checksum,
								module = moduleInfo,
								exported = exported
							}
						end
					end
				end
			end
		end
	end
end

function RoLink:Execute(cmd)
	if not cmd or not cmd.command then return end
	cmd.args = cmd.args or {}
	cmd.command = string.upper(tostring(cmd.command))

	if self.moduleCommands and self.moduleCommands[cmd.command] then
		local binding = self.moduleCommands[cmd.command]
		local ok, moduleError = pcall(binding.handler, cmd, self:BuildModuleContext(binding.module), cmd.args)
		if not ok then
			warn("[Ro-Link] Module command " .. tostring(cmd.command) .. " failed: " .. tostring(moduleError))
		end
		return
	end

	if cmd.command == "MODULE_LIVE" then
		local moduleId = tostring(cmd.args.module_id or "")
		local moduleSlug = tostring(cmd.args.module_slug or "")
		local fieldKey = tostring(cmd.args.field_key or "")
		local value = cmd.args.value
		local targetEntry = nil
		for _, entry in pairs(self.loadedModules or {}) do
			local moduleInfo = entry and entry.module
			if moduleInfo and ((moduleId ~= "" and tostring(moduleInfo.id or "") == moduleId) or (moduleSlug ~= "" and tostring(moduleInfo.slug or "") == moduleSlug)) then
				targetEntry = entry
				break
			end
		end
		if not targetEntry then return end

		local exported = targetEntry.exported
		local context = self:BuildModuleContext(targetEntry.module)
		local handler = nil
		if type(exported) == "table" then
			local liveTables = { exported.LiveConfig, exported.LiveActions, exported.Live }
			for _, liveTable in ipairs(liveTables) do
				if type(liveTable) == "table" then
					handler = liveTable[fieldKey] or liveTable[tostring(cmd.args.field_label or "")]
					if type(handler) == "function" then
						break
					end
				end
			end
			if type(handler) == "function" then
				local ok, liveError = pcall(handler, cmd, context, value, fieldKey)
				if not ok then
					warn("[Ro-Link] Module live config " .. fieldKey .. " failed: " .. tostring(liveError))
				end
			elseif type(exported.OnLiveConfig) == "function" then
				local ok, liveError = pcall(exported.OnLiveConfig, cmd, context, value, fieldKey)
				if not ok then
					warn("[Ro-Link] Module OnLiveConfig failed: " .. tostring(liveError))
				end
			end
		end
		return
	end

	local u, r = cmd.args.username, cmd.args.reason or "No reason"
	local p = Players:FindFirstChild(u) 
    if cmd.command == "VIEW" and not p then
        local viewerPlayer = Players:FindFirstChild(cmd.args.moderator_roblox_username or "")
        if viewerPlayer then
            p = viewerPlayer
            u = viewerPlayer.Name
        end
    end
    
    -- Permission Checks (Default to TRUE if settings not loaded or key missing)
    local function isAdmin() return not self.settings or self.settings.adminCmdsEnabled ~= false end
    local function isMisc() return not self.settings or self.settings.miscCmdsEnabled ~= false end

    local commandsWithoutLiveTarget = {
        UPDATE = true,
        SHUTDOWN = true,
        BAN = true,
        UNBAN = true,
        SOFTBAN = true,
        BROADCAST = true,
        GRAVITY = true,
        BRIGHTNESS = true
    }

    if not p and not commandsWithoutLiveTarget[cmd.command] then return end

	if cmd.command == "KICK" and isAdmin() then
		p:Kick(r)
	elseif cmd.command == "BAN" and isAdmin() then
		task.spawn(function()
			local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(u) end)
			if s and uid then pcall(function() Players:BanAsync({UserIds={uid},Duration=-1,DisplayReason=r,PrivateReason="RoLink"}) end) end
            if p then p:Kick("Banned: "..r) end
		end)
	elseif cmd.command == "UNBAN" and isAdmin() then
		task.spawn(function()
			local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(u) end)
			if s and uid then pcall(function() Players:UnbanAsync({UserIds={uid}}) end) end
		end)
    elseif cmd.command == "SOFTBAN" and isAdmin() then
        task.spawn(function()
            local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(u) end)
            local durationSeconds = tonumber(cmd.args.duration_seconds) or 3600
            if s and uid then
                pcall(function()
                    Players:BanAsync({
                        UserIds = {uid},
                        Duration = durationSeconds,
                        DisplayReason = r,
                        PrivateReason = "RoLink Kernel (Temporary): " .. (cmd.args.moderator or "System")
                    })
                end)
            end
            if p then p:Kick("Temporarily banned: " .. r) end
        end)
    elseif cmd.command == "FLY" and isMisc() then
        if p and p.Character and p.Character:FindFirstChild("HumanoidRootPart") then
            local hrp = p.Character.HumanoidRootPart
            local bv = hrp:FindFirstChild("RoLinkFly")
            if bv then 
                bv:Destroy() 
            else
                bv = Instance.new("BodyVelocity", hrp)
                bv.Name = "RoLinkFly"
                bv.MaxForce = Vector3.new(1,1,1) * 1000000
                bv.Velocity = Vector3.new(0,0,0)
            end
        end
    elseif cmd.command == "NOCLIP" and isMisc() then
         if p and p.Character then
            local attr = "RoLink_Noclip"
            local state = not p.Character:GetAttribute(attr)
            p.Character:SetAttribute(attr, state)
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") then v.CanCollide = not state end
            end
         end
    elseif cmd.command == "INVIS" and isMisc() then
         if p and p.Character then
            local attr = "RoLink_Invis"
            local state = not p.Character:GetAttribute(attr)
            p.Character:SetAttribute(attr, state)
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") or v:IsA("Decal") then v.Transparency = state and 1 or 0 end
            end
            if p.Character:FindFirstChild("Head") and p.Character.Head:FindFirstChild("face") then
                p.Character.Head.face.Transparency = state and 1 or 0
            end
         end
    elseif cmd.command == "GHOST" and isMisc() then
        if p and p.Character then
            local attr = "RoLink_Ghost"
            local state = not p.Character:GetAttribute(attr)
            p.Character:SetAttribute(attr, state)
            for _, v in pairs(p.Character:GetDescendants()) do
                 if v:IsA("BasePart") or v:IsA("MeshPart") then v.Material = state and Enum.Material.ForceField or Enum.Material.Plastic end
            end
        end
    elseif cmd.command == "SET_CHAR" and isMisc() then
        if p and cmd.args.char_user then
            task.spawn(function()
                 local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(cmd.args.char_user) end)
                 if s and uid then
                     p:LoadCharacterWithHumanoidDescription(Players:GetHumanoidDescriptionFromUserId(uid))
                 end
            end)
        end
    elseif cmd.command == "HEAL" and isMisc() then
        if p and p.Character and p.Character:FindFirstChild("Humanoid") then
            p.Character.Humanoid.Health = p.Character.Humanoid.MaxHealth
        end
    elseif cmd.command == "DAMAGE" and isMisc() then
        local amount = tonumber(cmd.args.amount)
        local humanoid = p and p.Character and p.Character:FindFirstChild("Humanoid")
        if humanoid and amount then
            humanoid:TakeDamage(math.max(amount, 0))
        end
    elseif cmd.command == "MAX_HEALTH" and isMisc() then
        local amount = tonumber(cmd.args.amount)
        local humanoid = p and p.Character and p.Character:FindFirstChild("Humanoid")
        if humanoid and amount then
            humanoid.MaxHealth = math.max(amount, 1)
            if humanoid.Health > humanoid.MaxHealth then
                humanoid.Health = humanoid.MaxHealth
            end
        end
    elseif cmd.command == "WALK_SPEED" and isMisc() then
        local amount = tonumber(cmd.args.amount)
        local humanoid = p and p.Character and p.Character:FindFirstChild("Humanoid")
        if humanoid and amount then
            humanoid.WalkSpeed = amount
        end
    elseif cmd.command == "JUMP_POWER" and isMisc() then
        local amount = tonumber(cmd.args.amount)
        local humanoid = p and p.Character and p.Character:FindFirstChild("Humanoid")
        if humanoid and amount then
            humanoid.UseJumpPower = true
            humanoid.JumpPower = amount
        end
    elseif cmd.command == "KILL" and isMisc() then
        if p and p.Character and p.Character:FindFirstChild("Humanoid") then
            p.Character.Humanoid.Health = 0
        end
    elseif cmd.command == "RESET" and isMisc() then
        if p then p:LoadCharacter() end
    elseif cmd.command == "REFRESH" and isMisc() then
        if p and p.Character then
            local cf = p.Character:GetPrimaryPartCFrame()
            p:LoadCharacter()
            p.CharacterAdded:Wait()
            p.Character:SetPrimaryPartCFrame(cf)
        end
    elseif cmd.command == "FREEZE" and isMisc() then
        local hrp = p and p.Character and p.Character:FindFirstChild("HumanoidRootPart")
        if hrp then
            hrp.Anchored = true
        end
    elseif cmd.command == "UNFREEZE" and isMisc() then
        local hrp = p and p.Character and p.Character:FindFirstChild("HumanoidRootPart")
        if hrp then
            hrp.Anchored = false
        end
    elseif cmd.command == "RAGDOLL" and isMisc() then
        local character = p and p.Character
        local humanoid = character and character:FindFirstChildOfClass("Humanoid")
        if character and humanoid and not character:GetAttribute("RoLink_Ragdoll") then
            local durationSeconds = tonumber(cmd.args.duration_seconds or cmd.args.duration) or 4
            durationSeconds = math.clamp(durationSeconds, 0.5, 30)

            local createdInstances = {}
            local disabledMotors = {}
            local oldPlatformStand = humanoid.PlatformStand
            local oldAutoRotate = humanoid.AutoRotate
            local oldRequiresNeck = humanoid.RequiresNeck

            character:SetAttribute("RoLink_Ragdoll", true)
            humanoid.PlatformStand = true
            humanoid.AutoRotate = false
            humanoid.RequiresNeck = false

            for _, descendant in ipairs(character:GetDescendants()) do
                if descendant:IsA("Motor6D") and descendant.Part0 and descendant.Part1 then
                    local attachment0 = Instance.new("Attachment")
                    attachment0.Name = "RoLinkRagdollAttachment0"
                    attachment0.CFrame = descendant.C0
                    attachment0.Parent = descendant.Part0

                    local attachment1 = Instance.new("Attachment")
                    attachment1.Name = "RoLinkRagdollAttachment1"
                    attachment1.CFrame = descendant.C1
                    attachment1.Parent = descendant.Part1

                    local socket = Instance.new("BallSocketConstraint")
                    socket.Name = "RoLinkRagdollConstraint"
                    socket.Attachment0 = attachment0
                    socket.Attachment1 = attachment1
                    socket.LimitsEnabled = true
                    socket.TwistLimitsEnabled = true
                    socket.UpperAngle = 45
                    socket.TwistLowerAngle = -45
                    socket.TwistUpperAngle = 45
                    socket.Parent = descendant.Part0

                    table.insert(createdInstances, socket)
                    table.insert(createdInstances, attachment0)
                    table.insert(createdInstances, attachment1)
                    table.insert(disabledMotors, descendant)
                    descendant.Enabled = false
                end
            end

            pcall(function()
                humanoid:ChangeState(Enum.HumanoidStateType.Ragdoll)
            end)
            task.delay(durationSeconds, function()
                for _, motor in ipairs(disabledMotors) do
                    if motor and motor.Parent then
                        motor.Enabled = true
                    end
                end
                for _, instance in ipairs(createdInstances) do
                    if instance and instance.Parent then
                        instance:Destroy()
                    end
                end
                if character and character.Parent then
                    character:SetAttribute("RoLink_Ragdoll", nil)
                end
                if humanoid and humanoid.Parent then
                    humanoid.PlatformStand = oldPlatformStand
                    humanoid.AutoRotate = oldAutoRotate
                    humanoid.RequiresNeck = oldRequiresNeck
                    pcall(function()
                        humanoid:ChangeState(Enum.HumanoidStateType.GettingUp)
                    end)
                end
            end)
        end
    elseif cmd.command == "BRING_TO_SPAWN" and isMisc() then
        local hrp = p and p.Character and p.Character:FindFirstChild("HumanoidRootPart")
        local spawnLocation = workspace:FindFirstChildWhichIsA("SpawnLocation", true)
        if hrp and spawnLocation then
            hrp.CFrame = spawnLocation.CFrame + Vector3.new(0, 5, 0)
        end
    elseif cmd.command == "TELEPORT_TO_ME" and isMisc() then
        local hrp = p and p.Character and p.Character:FindFirstChild("HumanoidRootPart")
        local moderatorPlayer = Players:FindFirstChild(cmd.args.moderator_roblox_username or "")
        local moderatorRoot = moderatorPlayer and moderatorPlayer.Character and moderatorPlayer.Character:FindFirstChild("HumanoidRootPart")
        if hrp and moderatorRoot then
            hrp.CFrame = moderatorRoot.CFrame * CFrame.new(2, 0, 0)
        end
    elseif cmd.command == "FORCEFIELD_ADD" and isMisc() then
        if p and p.Character and not p.Character:FindFirstChildOfClass("ForceField") then
            local forceField = Instance.new("ForceField")
            forceField.Parent = p.Character
        end
    elseif cmd.command == "FORCEFIELD_REMOVE" and isMisc() then
        if p and p.Character then
            for _, child in ipairs(p.Character:GetChildren()) do
                if child:IsA("ForceField") then
                    child:Destroy()
                end
            end
        end
    elseif cmd.command == "VIEW" and isMisc() then
        local viewerPlayer = Players:FindFirstChild(cmd.args.moderator_roblox_username or "") or p
        local viewRemote = ReplicatedStorage:FindFirstChild("RoLinkViewCamera")
        if viewerPlayer and viewRemote and viewRemote:IsA("RemoteEvent") then
            viewRemote:FireClient(viewerPlayer, p and p.UserId or viewerPlayer.UserId)
        end
    elseif cmd.command == "TEAM" and isMisc() then
        local teamName = tostring(cmd.args.team_name or cmd.args.teamName or cmd.args.team or "")
        local targetTeam = nil
        for _, team in ipairs(Teams:GetTeams()) do
            if string.lower(team.Name) == string.lower(teamName) then
                targetTeam = team
                break
            end
        end
        if p and targetTeam then
            p.Team = targetTeam
            p.Neutral = false
        end
    elseif cmd.command == "BROADCAST" and isAdmin() then
        local message = tostring(cmd.args.message or r)
        if message ~= "" then
            local isTargetedBroadcast = u and u ~= ""
            local playerGui = p and p:FindFirstChildOfClass("PlayerGui")
            if isTargetedBroadcast and playerGui then
                local gui = Instance.new("ScreenGui")
                gui.Name = "RoLinkBroadcast"
                gui.ResetOnSpawn = false
                gui.DisplayOrder = 100000
                local label = Instance.new("TextLabel")
                label.Name = "Message"
                label.AnchorPoint = Vector2.new(0.5, 0)
                label.Position = UDim2.new(0.5, 0, 0.08, 0)
                label.Size = UDim2.new(0.86, 0, 0, 54)
                label.BackgroundColor3 = Color3.fromRGB(15, 23, 42)
                label.BackgroundTransparency = 0.12
                label.BorderSizePixel = 0
                label.Font = Enum.Font.GothamBold
                label.Text = message
                label.TextColor3 = Color3.fromRGB(255, 255, 255)
                label.TextScaled = true
                label.TextWrapped = true
                label.Parent = gui
                gui.Parent = playerGui
                task.delay(10, function()
                    if gui and gui.Parent then
                        gui:Destroy()
                    end
                end)
            elseif not isTargetedBroadcast then
                local hint = Instance.new("Hint")
                hint.Name = "RoLinkBroadcast"
                hint.Text = message
                hint.Parent = workspace
                task.delay(10, function()
                    if hint and hint.Parent then
                        hint:Destroy()
                    end
                end)
            end
        end
    elseif cmd.command == "GRAVITY" and isAdmin() then
        local amount = tonumber(cmd.args.amount)
        if amount then
            workspace.Gravity = amount
        end
    elseif cmd.command == "BRIGHTNESS" and isAdmin() then
        local amount = tonumber(cmd.args.amount)
        if amount then
            game:GetService("Lighting").Brightness = amount
        end
	elseif cmd.command == "UPDATE" and isAdmin() then
        local updateMessage = r ~= "" and r or "Updating..."
		for _, p in ipairs(Players:GetPlayers()) do p:Kick(updateMessage) end
	elseif cmd.command == "SHUTDOWN" and isAdmin() then
		if not cmd.args.job_id or cmd.args.job_id == game.JobId then
			for _, p in ipairs(Players:GetPlayers()) do p:Kick(r ~= "" and r or "Shutdown.") end
		end
	end
end
return RoLink`;
}

export async function GET() {
    return NextResponse.json({
        status: 'API Active',
        message: 'Interactions endpoint ready for Discord webhooks (POST)'
    }, { status: 200 });
}
