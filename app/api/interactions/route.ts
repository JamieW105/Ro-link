import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';
import { logAction } from '@/lib/logger';
import { findLivePlayer } from '@/lib/livePlayers';
import { commandRequiresModerationHierarchy, evaluateModerationRoleHierarchy } from '@/lib/moderationRoleHierarchy';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import discordCommands from '@/lib/discordCommands.json';

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

type DiscordInteractionPayload = {
    id: string;
    type: number;
    guild_id?: string | null;
    member?: DiscordMember | null;
    user?: DiscordUser | null;
    data?: InteractionData | null;
};

type MiscCommandArgs = {
    username: string;
    moderator: string;
    char_user?: string;
    amount?: number;
    moderator_roblox_username?: string;
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
    freeze: 'FREEZE',
    unfreeze: 'UNFREEZE',
    'bring-to-spawn': 'BRING_TO_SPAWN',
    'teleport-to-me': 'TELEPORT_TO_ME',
    'forcefield-add': 'FORCEFIELD_ADD',
    'forcefield-remove': 'FORCEFIELD_REMOVE',
};
const VALUE_INPUT_MISC_COMMANDS = new Set(['DAMAGE', 'MAX_HEALTH', 'WALK_SPEED', 'JUMP_POWER']);
const MODERATION_MENU_ACTIONS = ['BAN', 'KICK', 'UNBAN', 'SOFTBAN', 'UPDATE', 'SHUTDOWN'] as const;
const MODERATION_LOG_ACTIONS = new Set(['BAN', 'KICK', 'UNBAN', 'SOFTBAN', 'DISCORD_BAN', 'DISCORD_KICK', 'TIMEOUT', 'MUTE']);

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

type DiscordApiMember = {
    user?: DiscordUser | null;
    nick?: string | null;
    roles?: string[] | null;
    joined_at?: string | null;
    premium_since?: string | null;
    communication_disabled_until?: string | null;
};

async function fetchDiscordLookup(userId: string, serverId: string) {
    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId) {
        throw new Error('Please choose a Discord user to lookup.');
    }

    const [member, userRecord, verifiedUser, logsRes] = await Promise.all([
        fetchDiscordApi<DiscordApiMember>(`/guilds/${encodeURIComponent(serverId)}/members/${encodeURIComponent(normalizedUserId)}`, true),
        fetchDiscordApi<DiscordUser>(`/users/${encodeURIComponent(normalizedUserId)}`, true),
        supabase
            .from('verified_users')
            .select('*')
            .eq('discord_id', normalizedUserId)
            .maybeSingle(),
        supabase
            .from('logs')
            .select('id, action, moderator, timestamp, target')
            .eq('server_id', serverId)
            .order('timestamp', { ascending: false })
            .limit(100),
    ]);

    if (logsRes.error) {
        throw new Error('Failed to load moderation history.');
    }

    const discordUser = member?.user || userRecord;
    const matchValues = new Set(
        [
            normalizedUserId,
            `<@${normalizedUserId}>`,
            `<@!${normalizedUserId}>`,
            verifiedUser.data?.roblox_username,
            discordUser?.username,
            formatDiscordUserTag(discordUser),
        ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())
    );

    const moderationHistory = ((Array.isArray(logsRes.data) ? logsRes.data : []) as LookupHistoryEntry[])
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

    return {
        user: discordUser,
        member,
        verifiedUser: verifiedUser.data,
        moderationHistory,
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

        // Helper to trigger Messaging Service
        const triggerMessaging = async (command: string, args: Record<string, unknown>, serverData: unknown = null) => {
            if (!guild_id) return;
            await sendRobloxMessage(guild_id, command, args, serverData);
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
                                        value: '`/moderation` - Ban, kick, unban, softban, update, or shutdown\n`/lookup` - Lookup a Discord user and moderation history',
                                        inline: false
                                    },
                                    {
                                        name: '**Utility Commands**',
                                        value: buildCommandSummary(['get-discord', 'get-roblox', 'verify', 'ping']),
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

            if (name === 'get-discord') {
                const robloxUsername = String(getCommandOptionValue(options, 'roblox_username') ?? '').trim();
                const { data, error } = await supabase
                    .from('verified_users')
                    .select('*')
                    .ilike('roblox_username', robloxUsername)
                    .maybeSingle();

                if (error || !data) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ No Discord account found for **${robloxUsername}**.`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `Player Lookup: ${data.roblox_username}`,
                            color: 0x2b2d31,
                            thumbnail: { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${data.roblox_id}&width=420&height=420&format=png` },
                            fields: [
                                { name: 'Roblox Account', value: `[${data.roblox_username}](https://www.roblox.com/users/${data.roblox_id}/profile)\n\`ID: ${data.roblox_id}\``, inline: true },
                                { name: 'Discord Account', value: `<@${data.discord_id}>\n\`ID: ${data.discord_id}\``, inline: true },
                                { name: 'Linked Date', value: `<t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`, inline: false }
                            ],
                            footer: { text: 'Ro-Link Systems • Lookup Service' },
                            timestamp: new Date().toISOString()
                        }]
                    }
                });
            }

            if (name === 'get-roblox') {
                const discordUserId = String(getCommandOptionValue(options, 'discord_user') ?? '').trim();
                const { data, error } = await supabase
                    .from('verified_users')
                    .select('*')
                    .eq('discord_id', discordUserId)
                    .maybeSingle();

                if (error || !data) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ No Roblox account found for <@${discordUserId}>.`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `Player Lookup`,
                            color: 0x2b2d31,
                            thumbnail: { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${data.roblox_id}&width=420&height=420&format=png` },
                            fields: [
                                { name: 'Discord Account', value: `<@${data.discord_id}>\n\`ID: ${data.discord_id}\``, inline: true },
                                { name: 'Roblox Account', value: `[${data.roblox_username}](https://www.roblox.com/users/${data.roblox_id}/profile)\n\`ID: ${data.roblox_id}\``, inline: true },
                                { name: 'Linked Date', value: `<t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`, inline: false }
                            ],
                            footer: { text: 'Ro-Link Systems • Lookup Service' },
                            timestamp: new Date().toISOString()
                        }]
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
            const isUpdateServers = name === 'update-servers';
            const isShutdown = name === 'shutdown';
            const isUpdate = name === 'update';
            const isMiscCommand = rootName === 'misc';
            const isModerationMenu = rootName === 'moderation';

            let hasPerms = false;
            if (isBan) hasPerms = await checkPermission('can_ban');
            else if (isKick) hasPerms = await checkPermission('can_kick');
            else if (isTimeout) hasPerms = await checkPermission('can_timeout');
            else if (isLookup) hasPerms = await checkPermission('can_lookup');
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
                    data: {
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
                    }
                });
            }

            if (name === 'lookup') {
                try {
                    const discordUserId = String(getCommandOptionValue(options, 'user') ?? '').trim();
                    const lookup = await fetchDiscordLookup(discordUserId, guild_id);
                    const discordUser = lookup.user;
                    const avatarUrl = getDiscordAvatarUrl(discordUser);
                    const createdAt = getDiscordCreatedAt(discordUserId);
                    const linkedRoblox = lookup.verifiedUser
                        ? `[${lookup.verifiedUser.roblox_username}](https://www.roblox.com/users/${lookup.verifiedUser.roblox_id}/profile)\n\`ID: ${lookup.verifiedUser.roblox_id}\``
                        : 'No linked Roblox account found.';

                    await logAction(guild_id, 'LOOKUP', discordUserId, userTag, 'Discord user lookup command');

                    return NextResponse.json({
                        type: 4,
                        data: {
                            flags: 64,
                            embeds: [{
                                title: `Discord Lookup: ${formatDiscordUserTag(discordUser)}`,
                                color: lookup.moderationHistory.length > 0 ? 0xef4444 : 0x0ea5e9,
                                thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                                fields: [
                                    { name: 'Discord User', value: `<@${discordUserId}>`, inline: true },
                                    { name: 'Username', value: truncateText(formatDiscordUserTag(discordUser), 256), inline: true },
                                    { name: 'Discord ID', value: `\`${discordUserId}\``, inline: true },
                                    { name: 'Account Created', value: createdAt ? formatDiscordTimestamp(createdAt, 'F') : 'Unknown', inline: true },
                                    { name: 'Joined Server', value: lookup.member?.joined_at ? formatDiscordTimestamp(lookup.member.joined_at, 'F') : 'Not in server or unknown', inline: true },
                                    { name: 'Server Roles', value: `${lookup.member?.roles?.length ?? 0}`, inline: true },
                                    { name: 'Linked Roblox', value: linkedRoblox, inline: false },
                                    { name: 'Moderation History', value: formatModerationHistory(lookup.moderationHistory), inline: false },
                                    ...(lookup.member?.communication_disabled_until
                                        ? [{ name: 'Timeout Ends', value: formatDiscordTimestamp(lookup.member.communication_disabled_until, 'F'), inline: false }]
                                        : []),
                                ],
                                footer: { text: `Ro-Link Systems - Lookup Service - ${lookup.moderationHistory.length} prior moderation action(s)` },
                                timestamp: new Date().toISOString(),
                            }]
                        }
                    });
                } catch (error: unknown) {
                    console.error('[LOOKUP] Error:', error);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `âŒ ${getErrorMessage(error, 'Failed to lookup that Discord user.')}`, flags: 64 }
                    });
                }
            }

            if (name === '__legacy_roblox_lookup_disabled') {
                try {
                    const lookup = await fetchRobloxLookup(String(targetUser || ''), guild_id, server.open_cloud_key);
                    const profileUrl = `https://www.roblox.com/users/${lookup.id}/profile`;

                    await logAction(guild_id, 'LOOKUP', lookup.username, userTag, 'Discord lookup command');

                    return NextResponse.json({
                        type: 4,
                        data: {
                            flags: 64,
                            embeds: [{
                                title: `Roblox Lookup: ${lookup.username}`,
                                url: profileUrl,
                                color: lookup.isBanned ? 0xef4444 : lookup.inGame ? 0x10b981 : 0x0ea5e9,
                                thumbnail: lookup.avatarUrl ? { url: lookup.avatarUrl } : undefined,
                                fields: [
                                    { name: 'Username', value: `[${lookup.username}](${profileUrl})`, inline: true },
                                    { name: 'Display Name', value: truncateText(lookup.displayName || lookup.username, 256), inline: true },
                                    { name: 'Roblox ID', value: `\`${lookup.id}\``, inline: true },
                                    { name: 'Account Created', value: lookup.created ? formatDiscordTimestamp(lookup.created, 'F') : 'Unknown', inline: true },
                                    { name: 'Status', value: lookup.isBanned ? 'Banned' : lookup.inGame ? 'In Game' : 'Offline', inline: true },
                                    { name: 'Profile Source', value: lookup.hasApiKey ? 'Public Roblox API + configured Open Cloud key' : 'Public Roblox API', inline: true },
                                    { name: 'Description', value: truncateText(lookup.description || 'No description provided.', 1024), inline: false },
                                    { name: 'Moderation History', value: formatModerationHistory(lookup.moderationHistory), inline: false },
                                    ...(lookup.inGame && lookup.jobId
                                        ? [{ name: 'Live Server', value: `User is active in job \`${lookup.jobId}\``, inline: false }]
                                        : []),
                                ],
                                footer: { text: `Ro-Link Systems • Lookup Service • ${lookup.moderationHistory.length} prior action(s)` },
                                timestamp: new Date().toISOString(),
                            }]
                        }
                    });
                } catch (error: unknown) {
                    console.error('[LOOKUP] Error:', error);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${getErrorMessage(error, 'Failed to lookup that Roblox user.')}`, flags: 64 }
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
                    logAction(guild_id, name.toUpperCase(), targetUser, userTag, reason)
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
                    logAction(guild_id, 'KICK', targetUser, userTag, reason)
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
                    logAction(guild_id, 'UNBAN', targetUser, userTag, reason)
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
                    logAction(guild_id, 'SOFTBAN', targetUser, userTag, reason)
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `âŒ Failed to queue command.`, flags: 64 }
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
                    logAction(guild_id, 'UPDATE_SERVERS', 'ALL', userTag, "Manual Update Triggered")
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

                        await logAction(guild_id, 'PROFILE_UPDATE', (memberData.user?.username || targetUserId), userTag, `Updated linked Roblox account: ${robloxData.name}`);

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
                    logAction(guild_id, 'SHUTDOWN', jobId || 'ALL', userTag)
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
                    const args: MiscCommandArgs = { username: targetUser, moderator: userTag };
                    if (miscCommand === 'SET_CHAR') {
                        args.char_user = String(getCommandOptionValue(options, 'char_user') ?? '').trim();
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

                    const [queueRes] = await Promise.all([
                        supabase.from('command_queue').insert([{
                            server_id: guild_id,
                            command: miscCommand,
                            args,
                            status: 'PENDING'
                        }]),
                        triggerMessaging(miscCommand, args, server),
                        logAction(guild_id, miscCommand, targetUser, userTag, 'Misc command')
                    ]);

                    if (queueRes.error) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `âŒ Failed to queue command.`, flags: 64 }
                        });
                    }

                    return NextResponse.json({
                        type: 4,
                        data: { content: `Queued **${miscCommand}** for \`${targetUser}\`.`, flags: 64 }
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
                                { name: 'Vitality', value: "`HEAL` `KILL` `RESET`", inline: true },
                                { name: 'Identity', value: "`SET_CHAR` `REFRESH`", inline: true }
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
                                    { label: 'Freeze', value: 'FREEZE', description: 'Anchor in place' },
                                    { label: 'Unfreeze', value: 'UNFREEZE', description: 'Remove freeze' },
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

            if (cid === 'misc_menu' || cid.startsWith('misc_modal_') || cid === 'moderation_menu' || cid.startsWith('moderation_modal_')) {
                // Determine if it should be a misc action check, for now we allow if they have dashboard access
                requiredPerm = 'can_access_dashboard';
            } else if (cid === 'report_open' || cid === 'report_submit') {
                // Anyone can OPEN a report form
                requiredPerm = '';
            }

            const hasPerms = requiredPerm === '' ? true : await checkPermission(requiredPerm);

            if (!hasPerms) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ You do not have permission to perform this action. Requires '${requiredPerm.replace('can_', '').replace('_', ' ')}' permission.`, flags: 64 }
                });
            }

            const parsedReportAction = parseReportCustomId(cid);
            if (parsedReportAction) {
                const currentGuildId = String(guild_id || '').trim();
                if (!currentGuildId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `âŒ Reports can only be managed from a server channel.`, flags: 64 }
                    });
                }

                const { action: reportAction, target } = parsedReportAction;
                const resolvedReportId = parsedReportAction.reportId || await findPendingReportIdByTarget(currentGuildId, target);
                if (!resolvedReportId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `âŒ The matching pending report could not be found for \`${target}\`.`, flags: 64 }
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
                        await logAction(currentGuildId, 'REPORT_DISMISSED', target, userTag, 'Dismissed from reports Discord channel');
                    } catch (error) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `âŒ Failed to dismiss report: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
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
                            data: { content: `âŒ Could not resolve Discord ID for \`${target}\`.`, flags: 64 }
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
                            data: { content: `âŒ Failed to ${discordAction} user: ${err}`, flags: 64 }
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
                        await logAction(currentGuildId, discordAction.toUpperCase(), target, userTag, 'Reports Discord channel action');
                    } catch (error) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `âŒ The moderation action succeeded, but updating the report failed: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
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
                        logAction(currentGuildId, command, target, userTag, 'Reports Discord channel action'),
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
                        data: { content: `âŒ Failed to queue ${command} for \`${target}\`: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
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

            if (cid.startsWith('discord_')) {
                const parts = cid.split('_');
                const discAction = parts[1];
                const target = parts.slice(2).join('_');
                const currentGuildId = String(guild_id || '').trim();
                const targetId = await resolveDiscordTargetId(target);

                if (!targetId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `âŒ Could not resolve Discord ID for \`${target}\`.`, flags: 64 }
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
                        data: { content: `âŒ Failed to ${discAction} user: ${err}`, flags: 64 }
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

                await logAction(currentGuildId, discAction.toUpperCase(), target, userTag, 'Reports Discord channel action');

                return NextResponse.json({
                    type: 4,
                    data: { content: `âœ… Successfully **${discAction.toUpperCase()}ED** <@${targetId}> from the server.`, flags: 64 }
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
                            logAction(currentGuildId, action, username, userTag, 'Discord Button Action')
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
                            data: { content: `âŒ Failed to queue ${action} for \`${username}\`: ${String(error instanceof Error ? error.message : error)}`, flags: 64 }
                        });
                    }

                    return NextResponse.json({
                        type: 4,
                        data: { content: `âœ… **${action}** command queued for \`${username}\`.`, flags: 64 }
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
                        placeholder: 'Enter the Roblox username',
                        required: true
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
                logAction(guild_id, action.toUpperCase(), username, userTag, 'Discord Button Action')
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
                    logAction(guild_id, command === 'UPDATE' ? 'UPDATE_SERVERS' : command, target, userTag, reason)
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

                const targetUser = getModalField(modalComponents, 'target_user');
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

                if (action === 'TELEPORT_TO_ME') {
                    args.moderator_roblox_username = getModalField(modalComponents, 'moderator_username');
                    msgContent = `Queuing **Teleport To Me** for **${targetUser}**...`;
                }

                await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: action,
                        args: args,
                        status: 'PENDING'
                    }]),
                    triggerMessaging(action, args),
                    logAction(guild_id, action, targetUser, userTag, action === 'SET_CHAR' ? `Set character to ${args.char_user}` : 'Misc Action')
                ]);

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
                        data: { content: `âŒ Failed to create the report record. Please try again later.`, flags: 64 }
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
	local results = {}
	for _, player in ipairs(resolvePlayers(target, true)) do
		local playerGui = player:FindFirstChildOfClass("PlayerGui") or player:WaitForChild("PlayerGui", 5)
		if playerGui then
			if type(sourceOrTree) == "table" then
				local result = buildUiTree(sourceOrTree, playerGui)
				results[player.Name] = result ~= nil
			elseif type(sourceOrTree) == "function" then
				local ok, result = pcall(sourceOrTree, { Player = player, PlayerGui = playerGui, Module = moduleInfo, Config = moduleInfo and moduleInfo.configSchema or {}, Settings = moduleInfo and moduleInfo.settings or {} }, player, props or {})
				results[player.Name] = ok and attachUiResult(playerGui, moduleInfo, result) or tostring(result)
			elseif type(sourceOrTree) == "string" and type(loadstring) == "function" then
				local chunk, loadError = loadstring(sourceOrTree)
				if chunk then
					local ok, result = pcall(chunk, { Player = player, PlayerGui = playerGui, Module = moduleInfo, Config = moduleInfo and moduleInfo.configSchema or {}, Settings = moduleInfo and moduleInfo.settings or {} }, player, props or {})
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

function RoLink:BuildModuleContext(moduleInfo)
	return {
		RoLink = self,
		Module = moduleInfo,
		Config = moduleInfo and moduleInfo.configSchema or {},
		Settings = moduleInfo and moduleInfo.settings or {},
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
								local initOk, initError = pcall(exported.Init, context, moduleInfo.settings or {})
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
								module = moduleInfo
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

	local u, r = cmd.args.username, cmd.args.reason or "No reason"
	local p = Players:FindFirstChild(u) 
    
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
    elseif cmd.command == "BROADCAST" and isAdmin() then
        local message = tostring(cmd.args.message or r)
        if message ~= "" then
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
