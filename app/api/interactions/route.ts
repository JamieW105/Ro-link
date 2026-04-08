import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';
import { logAction } from '@/lib/logger';
import { findLivePlayer } from '@/lib/livePlayers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
    action?: string | null;
    moderator?: string | null;
    timestamp?: string | null;
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

const REPORT_CUSTOM_ID_PREFIX = 'report|';

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
        return `• \`${action}\` by **${moderator}** ${formatDiscordTimestamp(entry?.timestamp, 'R')}`;
    }).join('\n');
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
    const matches = Array.isArray(searchData?.data) ? searchData.data : [];
    const exactMatch = matches.find((candidate: any) =>
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

    const liveServers = Array.isArray(liveServersRes.data) ? liveServersRes.data : [];
    const moderationHistory = Array.isArray(logsRes.data) ? logsRes.data : [];
    const activeServer = liveServers.find((liveServer: any) => findLivePlayer(liveServer?.players, resolvedUsername));

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

        const interaction = JSON.parse(body);
        const { type, guild_id, member, user: interactionUser } = interaction;
        const user = interactionUser || member?.user;
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
            return roles.some((role: any) => role[permissionKey] === true);
        }

        // Helper to trigger Messaging Service
        const triggerMessaging = async (command: string, args: any, serverData: any = null) => {
            if (!guild_id) return;
            await sendRobloxMessage(guild_id, command, args, serverData);
        };

        // 2. Handle PING
        if (type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 3. Handle Application Commands
        if (type === 2) {
            const { name, options } = interaction.data;

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
                if (user.id !== guildData.owner_id) {
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
                                        value: "`/setup` - Initialize the bridge (Owner Only)\n`/update-servers` - Global Server Soft-Shutdown\n`/shutdown` - Emergency Server Shutdown",
                                        inline: false
                                    },
                                    {
                                        name: '**Moderation Commands**',
                                        value: "`/ban` - Permanently ban a user\n`/kick` - Kick a user from the server\n`/unban` - Revoke a ban\n`/lookup` - Roblox profile + moderation history\n`/misc` - Player actions (Fly, Heal, etc.)",
                                        inline: false
                                    },
                                    {
                                        name: '**Utility Commands**',
                                        value: "`/get-discord` - Find Discord from Roblox\n`/get-roblox` - Find Roblox from Discord\n`/verify` - Link your account\n`/update` - Sync your linked profile",
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
                const robloxUsername = options?.find((o: any) => o.name === 'roblox_username')?.value;
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
                const discordUserId = options?.find((o: any) => o.name === 'discord_user')?.value;
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


            const isBan = name === 'ban';
            const isKick = name === 'kick';
            const isTimeout = name === 'timeout' || name === 'mute';
            const isLookup = name === 'lookup';
            const isUpdateServers = name === 'update-servers';
            const isShutdown = name === 'shutdown';
            const isUpdate = name === 'update';

            let hasPerms = false;
            if (isBan) hasPerms = await checkPermission('can_ban');
            else if (isKick) hasPerms = await checkPermission('can_kick');
            else if (isTimeout) hasPerms = await checkPermission('can_timeout');
            else if (isLookup) hasPerms = await checkPermission('can_lookup');
            else if (isUpdateServers || isShutdown) {
                const permissions = BigInt(member?.permissions || '0');
                hasPerms = (permissions & 0x8n) !== 0n || user.id === '953414442060746854';
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

            const targetUser = options?.find((o: any) => o.name === 'username')?.value;
            const jobId = options?.find((o: any) => o.name === 'job_id')?.value;
            const reason = options?.find((o: any) => o.name === 'reason')?.value || 'No reason provided';

            if (name === 'lookup') {
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
                } catch (error: any) {
                    console.error('[LOOKUP] Error:', error);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${error?.message || 'Failed to lookup that Roblox user.'}`, flags: 64 }
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
                const targetUserId = options?.find((o: any) => o.name === 'user')?.value || user.id;
                const isSelf = targetUserId === user.id;

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
                } catch (e) {
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
                                    { label: 'Kill', value: 'KILL', description: 'Instant kill' },
                                    { label: 'Reset', value: 'RESET', description: 'Reset character' },
                                    { label: 'Refresh', value: 'REFRESH', description: 'Refresh character' }
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
            // Public Button: Report Form
            if (interaction.data.custom_id === 'report_open') {
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
            const cid = interaction.data.custom_id;

            if (cid === 'misc_menu' || cid.startsWith('misc_modal_')) {
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
                const target = interaction.data.custom_id.split('_').pop() || '';
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

            if (interaction.data.custom_id === 'misc_menu') {
                const action = interaction.data.values[0];

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

                return NextResponse.json({
                    type: 9,
                    data: {
                        title: `Action: ${action}`,
                        custom_id: `misc_modal_${action}`,
                        components: components
                    }
                });
            }

            if (interaction.data.custom_id.startsWith('switch_')) {
                const isRoblox = interaction.data.custom_id.startsWith('switch_roblox');
                const target = interaction.data.custom_id.split('_').pop();

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

            if (interaction.data.custom_id.startsWith('discord_')) {
                const parts = interaction.data.custom_id.split('_');
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

            const customId = interaction.data.custom_id;
            const parts = customId.split('_');
            const action = parts[0];
            const userId = parts[1];
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
            const { custom_id, components: modalComponents } = interaction.data;

            if (custom_id.startsWith('misc_modal_')) {
                const action = custom_id.replace('misc_modal_', '');

                const getField = (id: string) => {
                    const row = modalComponents.find((c: any) => c.components.some((ic: any) => ic.custom_id === id));
                    return row ? row.components.find((ic: any) => ic.custom_id === id).value : '';
                };

                const targetUser = getField('target_user');
                let args: any = { username: targetUser, moderator: userTag };
                let msgContent = `✅ Queuing **${action}** for **${targetUser}**...`;

                if (action === 'SET_CHAR') {
                    const charUser = getField('char_user');
                    args.char_user = charUser;
                    msgContent = `✅ Queuing **Set Character** (to ${charUser}) for **${targetUser}**...`;
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
                const getField = (id: string) => {
                    const row = modalComponents.find((c: any) => c.components.some((ic: any) => ic.custom_id === id));
                    return row ? row.components.find((ic: any) => ic.custom_id === id).value : '';
                };

                const targetInput = getField('target_input');
                const reason = getField('reason');

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

                    fetch(`https://discord.com/api/v10/channels/${server.reports_channel_id}/messages`, {
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
                    }).then(res => {
                        if (!res.ok) {
                            console.error(`[REPORTS] Failed to send to channel ${server.reports_channel_id}: ${res.status}`);
                        } else {
                            console.log(`[REPORTS] Successfully forwarded report to channel ${server.reports_channel_id}`);
                        }
                    }).catch(err => console.error('[REPORTS] Error forwarding report to Discord:', err));
                } else {
                    console.log(`[REPORTS] No reports channel configured for guild ${guild_id}`);
                }

                return NextResponse.json({
                    type: 4,
                    data: { content: `✅ **Report Submitted!** The moderation team has been notified.`, flags: 64 }
                });
            }

            if (custom_id === 'setup_modal') {
                const getField = (id: string) => {
                    const row = modalComponents.find((c: any) => c.components.some((ic: any) => ic.custom_id === id));
                    return row ? row.components.find((ic: any) => ic.custom_id === id).value : '';
                };

                const placeId = getField('place_id').trim();
                const universeId = getField('universe_id').trim();
                const openCloudKey = getField('api_key').trim();
                const generatedKey = 'rl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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

    return [
        {
            title: 'Studio Setup Instructions',
            color: 0x2b2d31,
            description: "Follow these steps to integrate Ro-Link with your Roblox game.",
            thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
            fields: [
                { name: '1. ModuleScript', value: "Create a `ModuleScript` in `ReplicatedStorage` named `RoLink`.", inline: false },
                { name: '2. Paste Code', value: "Copy the **Code Block** below and paste it into the `RoLink` script.", inline: false },
                { name: '3. Starter Script', value: "Create a `Script` in `ServerScriptService` with:\n```lua\nlocal RoLink = require(game.ReplicatedStorage:WaitForChild('RoLink'))\nRoLink:Initialize()\n```", inline: false },
                { name: '4. Permissions', value: "Enable **HTTP Requests** and **API Services** in Game Settings.", inline: false },
                { name: 'Dashboard', value: `[**Manage Server**](${baseUrl}/dashboard/${guildId})`, inline: false }
            ],
            footer: { text: 'Ro-Link Systems • Setup', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
            timestamp: new Date().toISOString()
        },
        {
            title: 'Core Bridge Code (RoLink Module)',
            color: 0x2b2d31,
            description: '```lua\n' + getLuaCode(baseUrl, apiKey) + '\n```',
            footer: { text: 'KEEP YOUR SECURITY KEY PRIVATE!' },
            timestamp: new Date().toISOString()
        }
    ];
}

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
					Headers = { ["Content-Type"] = "application/json", ["Authorization"] = "Bearer " .. KEY },
					Body = Http:JSONEncode({
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

function RoLink:Execute(cmd)
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
