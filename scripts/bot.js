const { Client, GatewayIntentBits, ActivityType, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { setGlobalDispatcher, Agent } = require('undici');
const discordCommands = require('../lib/discordCommands.json');
require('dotenv').config({ path: '.env.local', quiet: true });

const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const supabase = hasSupabaseConfig
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

setGlobalDispatcher(new Agent({
    connect: { timeout: 60_000 },
    headersTimeout: 60_000,
    bodyTimeout: 60_000,
}));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
let metadataSyncEnabled = Boolean(
    process.env.DISCORD_BEARER_TOKEN
    && process.env.DISCORD_BEARER_TOKEN !== '0'
);
const DISCORD_EPOCH = 1420070400000n;
const MISC_SUBCOMMAND_TO_COMMAND = {
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
const MODERATION_LOG_ACTIONS = new Set(['BAN', 'KICK', 'UNBAN', 'SOFTBAN', 'DISCORD_BAN', 'DISCORD_KICK', 'TIMEOUT', 'MUTE']);

async function getLinkedRobloxUsername(discordId) {
    if (!supabase || !discordId) return '';

    const { data } = await supabase
        .from('verified_users')
        .select('roblox_username')
        .eq('discord_id', discordId)
        .maybeSingle();

    return String(data?.roblox_username || '').trim();
}

async function findBlockedServerForGuild(guildId) {
    if (!supabase || !guildId) return null;

    const { data, error } = await supabase
        .from('blocked_servers')
        .select('guild_id, reason')
        .eq('guild_id', guildId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

function getBlockedServerMessage(blocked) {
    const reason = String(blocked?.reason || '').trim();
    return reason
        ? `This server is blocked from using Ro-Link. Reason: ${reason}`
        : 'This server is blocked from using Ro-Link.';
}

function buildModerationPanel() {
    const embed = new EmbedBuilder()
        .setTitle('Moderation Actions')
        .setDescription('Select an action from the menu below.')
        .setColor('#ef4444')
        .addFields(
            { name: 'Player Actions', value: '`BAN` `KICK` `UNBAN` `SOFTBAN`', inline: false },
            { name: 'Server Actions', value: '`UPDATE` `SHUTDOWN`', inline: false }
        )
        .setFooter({ text: 'Ro-Link Moderation System' });

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('moderation_menu')
                .setPlaceholder('Choose a moderation action...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Ban').setDescription('Permanently ban a Roblox user').setValue('BAN'),
                    new StringSelectMenuOptionBuilder().setLabel('Kick').setDescription('Kick a Roblox user from the server').setValue('KICK'),
                    new StringSelectMenuOptionBuilder().setLabel('Unban').setDescription('Lift a Roblox ban').setValue('UNBAN'),
                    new StringSelectMenuOptionBuilder().setLabel('Softban').setDescription('Temporarily ban and remove a Roblox user').setValue('SOFTBAN'),
                    new StringSelectMenuOptionBuilder().setLabel('Update Servers').setDescription('Restart all Roblox servers').setValue('UPDATE'),
                    new StringSelectMenuOptionBuilder().setLabel('Shutdown').setDescription('Shut down Roblox servers').setValue('SHUTDOWN'),
                ),
        );

    return { embed, row };
}

function buildMiscPanel() {
    const embed = new EmbedBuilder()
        .setTitle('Miscellaneous Player Actions')
        .setDescription('Select an action from the menu below to apply it to a Roblox player.')
        .setColor('#0ea5e9')
        .addFields(
            { name: 'Fly', value: 'Enables hover/flight for the target player.', inline: false },
            { name: 'Noclip', value: 'Allows the player to pass through walls.', inline: false },
            { name: 'Invis', value: 'Makes the player and their accessories fully invisible.', inline: false },
            { name: 'Ghost', value: 'Applies a ForceField material to the player character.', inline: false },
            { name: 'Set Char', value: 'Copies the appearance/bundle of another Roblox user.', inline: false },
            { name: 'Heal', value: 'Restores player health to maximum.', inline: false },
            { name: 'Kill', value: 'Immediately kills the target player.', inline: false },
            { name: 'Ragdoll', value: 'Temporarily forces the target player into a ragdoll state.', inline: false },
            { name: 'Reset', value: 'Resets the player character.', inline: false },
            { name: 'Refresh', value: 'Respawn the player character.', inline: false },
            { name: 'View', value: 'View a player or reset your camera to yourself.', inline: false },
            { name: 'Team', value: 'Move a player to a Roblox team.', inline: false }
        )
        .setFooter({ text: 'Ro-Link Utility System' });

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('misc_menu')
                .setPlaceholder('Choose an action...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Fly').setDescription('Enable flight for the player').setValue('FLY'),
                    new StringSelectMenuOptionBuilder().setLabel('Noclip').setDescription('Allow player to walk through walls').setValue('NOCLIP'),
                    new StringSelectMenuOptionBuilder().setLabel('Invis').setDescription('Make the player invisible').setValue('INVIS'),
                    new StringSelectMenuOptionBuilder().setLabel('Ghost').setDescription('Apply a ForceField material').setValue('GHOST'),
                    new StringSelectMenuOptionBuilder().setLabel('Set Character').setDescription('Change appearance').setValue('SET_CHAR'),
                    new StringSelectMenuOptionBuilder().setLabel('Heal').setDescription('Restore health').setValue('HEAL'),
                    new StringSelectMenuOptionBuilder().setLabel('Damage').setDescription('Deal damage').setValue('DAMAGE'),
                    new StringSelectMenuOptionBuilder().setLabel('Max Health').setDescription('Set maximum health').setValue('MAX_HEALTH'),
                    new StringSelectMenuOptionBuilder().setLabel('Walk Speed').setDescription('Set walk speed').setValue('WALK_SPEED'),
                    new StringSelectMenuOptionBuilder().setLabel('Jump Power').setDescription('Set jump power').setValue('JUMP_POWER'),
                    new StringSelectMenuOptionBuilder().setLabel('Kill').setDescription('Instant kill').setValue('KILL'),
                    new StringSelectMenuOptionBuilder().setLabel('Reset').setDescription('Reset character').setValue('RESET'),
                    new StringSelectMenuOptionBuilder().setLabel('Refresh').setDescription('Refresh character').setValue('REFRESH'),
                    new StringSelectMenuOptionBuilder().setLabel('View').setDescription('View or reset your camera').setValue('VIEW'),
                    new StringSelectMenuOptionBuilder().setLabel('Team').setDescription('Move to a team').setValue('TEAM'),
                    new StringSelectMenuOptionBuilder().setLabel('Freeze').setDescription('Anchor in place').setValue('FREEZE'),
                    new StringSelectMenuOptionBuilder().setLabel('Unfreeze').setDescription('Remove freeze').setValue('UNFREEZE'),
                    new StringSelectMenuOptionBuilder().setLabel('Ragdoll').setDescription('Temporarily ragdoll').setValue('RAGDOLL'),
                    new StringSelectMenuOptionBuilder().setLabel('Bring To Spawn').setDescription('Move to spawn').setValue('BRING_TO_SPAWN'),
                    new StringSelectMenuOptionBuilder().setLabel('Teleport To Me').setDescription('Move to a moderator').setValue('TELEPORT_TO_ME'),
                    new StringSelectMenuOptionBuilder().setLabel('Add ForceField').setDescription('Add a ForceField').setValue('FORCEFIELD_ADD'),
                    new StringSelectMenuOptionBuilder().setLabel('Remove ForceField').setDescription('Remove ForceFields').setValue('FORCEFIELD_REMOVE'),
                ),
        );

    return { embed, row };
}

async function isServerStaffInteraction(interaction) {
    if (!interaction?.member) return false;
    if (
        interaction.member.permissions.has('Administrator')
        || interaction.member.permissions.has('BanMembers')
        || interaction.member.permissions.has('KickMembers')
        || interaction.member.permissions.has('ManageGuild')
    ) {
        return true;
    }

    const roleIds = interaction.member.roles?.cache?.map((role) => role.id) || [];
    if (!roleIds.length) return false;

    const { data: roles } = await supabase
        .from('dashboard_roles')
        .select('can_lookup, can_kick, can_ban, can_access_dashboard')
        .eq('server_id', interaction.guildId)
        .in('discord_role_id', roleIds);

    return Array.isArray(roles) && roles.some((role) =>
        role.can_lookup === true
        || role.can_kick === true
        || role.can_ban === true
        || role.can_access_dashboard === true
    );
}

async function refreshCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: discordCommands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

let statusIndex = 0;

async function syncStats() {
    if (!supabase) return;

    let serverCount = client.guilds.cache.size;
    try {
        await supabase
            .from('bot_stats')
            .upsert({ id: 'global', guild_count: serverCount, updated_at: new Date() });
    } catch (e) {
        console.error('[STATS] Failed to sync server count:', e.message);
    }
}

async function cleanupLiveServers() {
    if (!supabase) return;

    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { error, count } = await supabase
            .from('live_servers')
            .delete({ count: 'exact' })
            .lt('updated_at', fiveMinutesAgo);

        if (!error && count && count > 0) {
            console.log(`[CLEANUP] Removed ${count} stale servers.`);
        }
    } catch (e) {
        console.error('[CLEANUP] Failed to remove stale servers:', e.message);
    }
}

async function updateStatus() {
    let serverCount = client.guilds.cache.size;
    const supportUrl = "https://discord.gg/C3n4nAwYMw";

    const statuses = [
        `CONNECTING YOUR ROBLOX GAME TO DISCORD. JOIN OUR SUPPORT SERVER: \`\`\` ${supportUrl} \`\`\``,
        `CONNECTING ${serverCount} SERVERS TO ROBLOX. JOIN OUR SUPPORT SERVER: \`\`\` ${supportUrl} \`\`\``
    ];

    if (metadataSyncEnabled) {
        try {
            // Using the raw Discord API with an Application Bearer Token
            const response = await fetch(`https://discord.com/api/v10/applications/${process.env.DISCORD_CLIENT_ID}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${process.env.DISCORD_BEARER_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: statuses[statusIndex]
                })
            });

            if (!response.ok) {
                const err = await response.text();

                if (response.status === 401 || response.status === 403) {
                    metadataSyncEnabled = false;
                    console.warn(`[BOT] Metadata sync disabled after Discord API ${response.status}. Check DISCORD_BEARER_TOKEN.`);
                } else {
                    console.error(`[BOT] API Error: ${response.status} - ${err}`);
                }
            } else {
                console.log(`[BOT] Description updated: Page ${statusIndex + 1}`);
                statusIndex = (statusIndex + 1) % statuses.length;
            }
        } catch (e) {
            console.error('[BOT] Failed to patch application description:', e.message);
        }
    }

    syncStats();
}

function truncateText(value, maxLength = 1024) {
    const text = String(value ?? '').trim();
    if (!text) {
        return '';
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatDiscordTimestamp(value, style = 'f') {
    const timestamp = Date.parse(value || '');
    if (Number.isNaN(timestamp)) {
        return 'Unknown';
    }

    return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function formatModerationHistory(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return 'No prior moderation history found.';
    }

    return entries.slice(0, 5).map((entry) => {
        const action = truncateText(entry?.action || 'UNKNOWN', 24);
        const moderator = truncateText(entry?.moderator || 'Unknown Moderator', 48);
        return `- \`${action}\` by **${moderator}** ${formatDiscordTimestamp(entry?.timestamp, 'R')}`;
    }).join('\n');
}

function normalizeStaffNoteTarget(target = {}) {
    const discordId = String(target.discordId ?? '').trim().slice(0, 32);
    const robloxId = String(target.robloxId ?? '').trim().slice(0, 32);
    const robloxUsername = String(target.robloxUsername ?? '').trim().slice(0, 64);

    return {
        discordId: discordId || null,
        robloxId: robloxId || null,
        robloxUsername: robloxUsername || null,
        robloxUsernameLower: robloxUsername ? robloxUsername.toLowerCase() : null,
    };
}

function getStaffNoteTargetLabel(target) {
    const normalized = normalizeStaffNoteTarget(target);
    if (normalized.robloxUsername) return normalized.robloxUsername;
    if (normalized.robloxId) return `Roblox ID ${normalized.robloxId}`;
    if (normalized.discordId) return `Discord ID ${normalized.discordId}`;
    return 'Unknown User';
}

function formatStaffNotes(notes) {
    if (!Array.isArray(notes) || notes.length === 0) {
        return 'No staff notes found for this user.';
    }

    return notes.slice(0, 5).map((note) => {
        const author = truncateText(note.created_by_tag || note.created_by_discord_id || 'Unknown Staff', 48);
        return `- **${author}** ${formatDiscordTimestamp(note.created_at, 'R')}: ${truncateText(note.note, 220)}`;
    }).join('\n');
}

function encodeStaffNoteModalTarget(target) {
    const normalized = normalizeStaffNoteTarget(target);
    return [
        normalized.discordId || '-',
        normalized.robloxId || '-',
        normalized.robloxUsername ? encodeURIComponent(normalized.robloxUsername) : '-',
    ].join('|');
}

function decodeStaffNoteModalTarget(encoded) {
    const [discordId = '-', robloxId = '-', robloxUsername = '-'] = String(encoded || '').split('|');
    return {
        discordId: discordId === '-' ? '' : discordId,
        robloxId: robloxId === '-' ? '' : robloxId,
        robloxUsername: robloxUsername === '-' ? '' : decodeURIComponent(robloxUsername),
    };
}

function buildStaffNoteModalCustomId(target) {
    return `staff_note_modal|${encodeStaffNoteModalTarget(target)}`;
}

async function fetchStaffNotes(serverId, target, limit = 5) {
    const normalized = normalizeStaffNoteTarget(target);
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 25));
    if (!serverId || (!normalized.discordId && !normalized.robloxId && !normalized.robloxUsernameLower)) return [];

    const baseQuery = () => supabase
        .from('staff_notes')
        .select('id, server_id, target_discord_id, target_roblox_id, target_roblox_username, note, created_by_discord_id, created_by_tag, created_at')
        .eq('server_id', serverId)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

    const queries = [];
    if (normalized.discordId) queries.push(baseQuery().eq('target_discord_id', normalized.discordId));
    if (normalized.robloxId) queries.push(baseQuery().eq('target_roblox_id', normalized.robloxId));
    if (normalized.robloxUsernameLower) queries.push(baseQuery().eq('target_roblox_username_lower', normalized.robloxUsernameLower));

    const results = await Promise.all(queries);
    const rows = new Map();
    for (const { data, error } of results) {
        if (error) throw new Error(error.message || 'Failed to load staff notes.');
        for (const row of Array.isArray(data) ? data : []) {
            rows.set(row.id, row);
        }
    }

    return Array.from(rows.values())
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, safeLimit);
}

async function createStaffNote({ serverId, target, note, createdByDiscordId, createdByTag }) {
    const normalized = normalizeStaffNoteTarget(target);
    const safeNote = String(note ?? '').trim().slice(0, 1500);

    if (!normalized.discordId && !normalized.robloxId && !normalized.robloxUsername) {
        throw new Error('Choose a Discord user or Roblox user before adding a note.');
    }
    if (!safeNote) {
        throw new Error('Note cannot be empty.');
    }

    const { data, error } = await supabase
        .from('staff_notes')
        .insert([{
            server_id: serverId,
            target_discord_id: normalized.discordId,
            target_roblox_id: normalized.robloxId,
            target_roblox_username: normalized.robloxUsername,
            target_roblox_username_lower: normalized.robloxUsernameLower,
            note: safeNote,
            created_by_discord_id: String(createdByDiscordId ?? '').trim().slice(0, 32) || null,
            created_by_tag: String(createdByTag ?? '').trim().slice(0, 128) || 'Unknown Staff',
        }])
        .select('id, target_discord_id, target_roblox_id, target_roblox_username, note')
        .single();

    if (error) throw new Error(error.message || 'Failed to save staff note.');
    return data;
}

function getDiscordCreatedAt(discordId) {
    try {
        const timestamp = Number((BigInt(discordId) >> 22n) + DISCORD_EPOCH);
        return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
    } catch {
        return '';
    }
}

function formatDiscordUserTag(discordUser) {
    if (!discordUser?.username) {
        return 'Unknown User';
    }

    return discordUser.discriminator && discordUser.discriminator !== '0'
        ? `${discordUser.username}#${discordUser.discriminator}`
        : `@${discordUser.username}`;
}

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getLivePlayerScore(record) {
    let score = 0;
    if (String(record.username || record.name || '').trim()) score += 2;
    if (String(record.displayName || '').trim()) score += 1;
    if (String(record.userId || record.id || '').trim()) score += 1;
    if (String(record.avatarUrl || record.thumbnailUrl || record.characterThumbnail || record.headshotUrl || '').trim()) score += 1;
    return score;
}

function unwrapLivePlayerObject(value, seen = new WeakSet()) {
    if (!isRecord(value) || seen.has(value)) {
        return null;
    }

    seen.add(value);
    const currentScore = getLivePlayerScore(value);
    let bestMatch = currentScore > 0 ? value : null;
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

function collectNestedLivePlayerEntries(value, depth = 0) {
    if (depth > 3) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.flatMap((entry) => collectNestedLivePlayerEntries(entry, depth + 1));
    }

    if (!isRecord(value)) {
        return [];
    }

    if (getLivePlayerScore(value) > 0) {
        return [value];
    }

    return Object.values(value).flatMap((entry) => collectNestedLivePlayerEntries(entry, depth + 1));
}

function toRawLivePlayerEntries(rawPlayers) {
    if (Array.isArray(rawPlayers)) {
        return rawPlayers;
    }

    if (!isRecord(rawPlayers)) {
        return [];
    }

    if (getLivePlayerScore(rawPlayers) > 0) {
        return [rawPlayers];
    }

    const nestedEntries = Object.values(rawPlayers).flatMap((entry) => collectNestedLivePlayerEntries(entry));
    return nestedEntries.length > 0 ? nestedEntries : Object.values(rawPlayers);
}

function normalizeLivePlayer(rawPlayer) {
    if (typeof rawPlayer === 'string') {
        const username = rawPlayer.trim();
        return username ? { username, displayName: username, userId: null, avatarUrl: null } : null;
    }

    const player = unwrapLivePlayerObject(rawPlayer);
    if (!player) {
        return null;
    }

    const username = String(player.username || player.name || '').trim();
    if (!username) {
        return null;
    }

    const userId = String(player.userId || player.id || '').trim() || null;
    return {
        username,
        displayName: String(player.displayName || username).trim(),
        userId,
        avatarUrl: String(player.avatarUrl || player.thumbnailUrl || player.characterThumbnail || player.headshotUrl || '').trim() || null,
    };
}

function normalizeLivePlayerList(rawPlayers) {
    const players = [];
    const seen = new Set();

    for (const rawPlayer of toRawLivePlayerEntries(rawPlayers)) {
        const player = normalizeLivePlayer(rawPlayer);
        if (!player) continue;

        const key = player.userId ? `id:${player.userId}` : `username:${player.username.toLowerCase()}`;
        if (seen.has(key)) continue;

        seen.add(key);
        players.push(player);
    }

    return players;
}

function findLivePlayerInList(rawPlayers, identity) {
    const normalizedIdentity = String(identity || '').trim().toLowerCase();
    if (!normalizedIdentity) {
        return null;
    }

    return normalizeLivePlayerList(rawPlayers).find((player) =>
        player.username.toLowerCase() === normalizedIdentity
        || (player.userId ? player.userId.toLowerCase() === normalizedIdentity : false)
    ) || null;
}

function getVisiblePlayerCount(server) {
    const players = normalizeLivePlayerList(server?.players);
    const count = Number(server?.player_count || 0);
    return players.length > 0 ? players.length : Number.isFinite(count) ? count : 0;
}

function formatJobId(jobId) {
    const value = String(jobId || '').trim();
    return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value || 'Unknown';
}

function buildRobloxJoinUrl(placeId, jobId) {
    const normalizedPlaceId = String(placeId || '').trim();
    const normalizedJobId = String(jobId || '').trim();
    if (!normalizedPlaceId || !normalizedJobId) {
        return '';
    }

    return `https://www.roblox.com/games/start?placeId=${encodeURIComponent(normalizedPlaceId)}&gameInstanceId=${encodeURIComponent(normalizedJobId)}`;
}

async function fetchLiveServers(serverId) {
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
        return data;
    }

    const { data: fallbackData, error: fallbackError } = await baseQuery()
        .limit(25);

    if (fallbackError) {
        throw new Error('Failed to load live servers.');
    }

    return Array.isArray(fallbackData) ? fallbackData : [];
}

function findPlayerServer(liveServers, identity) {
    for (const liveServer of liveServers) {
        const player = findLivePlayerInList(liveServer.players, identity);
        if (player) {
            return { server: liveServer, player };
        }
    }

    return { server: null, player: null };
}

async function fetchDiscordLookup(discordUser, guild, serverId) {
    const userId = String(discordUser?.id || '').trim();
    if (!userId) {
        throw new Error('Please choose a Discord user to lookup.');
    }

    const [member, verifiedUserRes, logsRes] = await Promise.all([
        guild?.members?.fetch(userId).catch(() => null),
        supabase
            .from('verified_users')
            .select('*')
            .eq('discord_id', userId)
            .maybeSingle(),
        supabase
            .from('logs')
            .select('id, action, moderator, timestamp, target')
            .eq('server_id', serverId)
            .order('timestamp', { ascending: false })
            .limit(100),
    ]);

    const resolvedUser = member?.user || discordUser;
    const matchValues = new Set(
        [
            userId,
            `<@${userId}>`,
            `<@!${userId}>`,
            verifiedUserRes.data?.roblox_username,
            resolvedUser?.username,
            formatDiscordUserTag(resolvedUser),
        ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())
    );

    const moderationHistory = (Array.isArray(logsRes.data) ? logsRes.data : [])
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

    let activeServer = null;
    let activePlayer = null;
    const robloxUsername = String(verifiedUserRes.data?.roblox_username || '').trim();
    const robloxId = String(verifiedUserRes.data?.roblox_id || '').trim();
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
        user: resolvedUser,
        member,
        verifiedUser: verifiedUserRes.data,
        moderationHistory,
        activeServer,
        activePlayer,
    };
}

async function fetchRobloxLookup(username, serverId) {
    const searchUsername = String(username ?? '').trim();
    if (!searchUsername) {
        throw new Error('Please provide a Roblox username to lookup.');
    }

    const { data: serverSettings, error: serverError } = await supabase
        .from('servers')
        .select('open_cloud_key')
        .eq('id', serverId)
        .maybeSingle();

    if (serverError) {
        throw new Error('Failed to load this server configuration.');
    }

    const apiKey = typeof serverSettings?.open_cloud_key === 'string'
        ? serverSettings.open_cloud_key.trim()
        : '';

    const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(searchUsername)}&limit=10`, {
        headers: {
            'User-Agent': 'Ro-Link Bot/1.0',
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
    const exactMatch = matches.find((candidate) =>
        String(candidate?.name || '').toLowerCase() === searchUsername.toLowerCase()
    );
    const matchedUser = exactMatch || matches[0];

    if (!matchedUser?.id) {
        throw new Error('Player not found.');
    }

    let cloudProfile = null;
    if (apiKey) {
        try {
            const cloudRes = await fetch(`https://apis.roblox.com/cloud/v2/users/${matchedUser.id}`, {
                headers: {
                    'x-api-key': apiKey,
                }
            });

            if (cloudRes.ok) {
                cloudProfile = await cloudRes.json();
            }
        } catch (error) {
            console.warn('[LOOKUP] Open Cloud profile fetch failed:', error?.message || error);
        }
    }

    const legacyProfileRes = await fetch(`https://users.roblox.com/v1/users/${matchedUser.id}`, {
        headers: {
            'User-Agent': 'Ro-Link Bot/1.0',
        }
    });

    if (!legacyProfileRes.ok) {
        throw new Error(`Roblox profile lookup failed (${legacyProfileRes.status}).`);
    }

    const [legacyProfile, thumbnailData] = await Promise.all([
        legacyProfileRes.json(),
        fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${matchedUser.id}&size=150x150&format=Png&isCircular=false`, {
            headers: {
                'User-Agent': 'Ro-Link Bot/1.0',
            }
        }).then((response) => response.ok ? response.json() : { data: [] }).catch(() => ({ data: [] })),
    ]);

    const resolvedUsername = legacyProfile?.name || matchedUser.name || searchUsername;

    const [liveServersRes, logsRes] = await Promise.all([
        supabase
            .from('live_servers')
            .select('id, players')
            .eq('server_id', serverId),
        supabase
            .from('logs')
            .select('id, action, moderator, timestamp, target')
            .eq('server_id', serverId)
            .ilike('target', resolvedUsername)
            .order('timestamp', { ascending: false })
            .limit(5),
    ]);

    const liveServers = Array.isArray(liveServersRes.data) ? liveServersRes.data : [];
    const moderationHistory = Array.isArray(logsRes.data) ? logsRes.data : [];
    const activeServer = liveServers.find((server) =>
        findLivePlayerInList(server.players, resolvedUsername)
        || findLivePlayerInList(server.players, matchedUser.id)
    );

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

client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    let serverCount = client.guilds.cache.size;
    console.log(`The bot is in ${serverCount} servers.`);
    if (!supabase) {
        console.warn('[BOT] Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY. Running in Discord-only mode for command registration.');
    }

    updateStatus();
    refreshCommands();
    cleanupLiveServers();
    setInterval(updateStatus, 15000); // Cycle every 15 seconds
    setInterval(cleanupLiveServers, 60000); // Cleanup every minute
});

client.on('guildCreate', async guild => {
    console.log(`[GUILD] Joined new guild: ${guild.name} (${guild.id})`);
    if (supabase) {
        try {
            const blocked = await findBlockedServerForGuild(guild.id);
            if (blocked) {
                console.warn(`[GUILD] Leaving blocked guild: ${guild.name} (${guild.id})`);
                await guild.leave();
                syncStats();
                updateStatus();
                return;
            }
        } catch (error) {
            console.error(`[GUILD] Failed to check blocked status for ${guild.id}:`, error.message);
        }
    }

    syncStats();
    updateStatus();
});

client.on('guildDelete', guild => {
    console.log(`[GUILD] Left guild: ${guild.name} (${guild.id})`);
    syncStats();
    updateStatus();
});

client.on('guildMemberAdd', async member => {
    if (!supabase) return;

    const { guild, id: userId } = member;

    try {
        // 1. Fetch Server Settings
        const { data: server, error } = await supabase
            .from('servers')
            .select('verification_enabled, on_join_role, verified_role')
            .eq('id', guild.id)
            .single();

        if (error || !server || !server.verification_enabled) return;

        async function addConfiguredRole(roleId, label) {
            if (!roleId || member.roles.cache.has(roleId)) return;

            await member.roles.add(roleId).catch(e => {
                console.error(`[ROLES] Failed to add ${label}:`, e.message);
            });
        }

        // 2. Give On Join Role if it exists
        if (server.on_join_role) {
            await addConfiguredRole(server.on_join_role, 'on-join role');
        }

        // 3. Check if user is verified
        const { data: verifiedUser } = await supabase
            .from('verified_users')
            .select('roblox_id')
            .eq('discord_id', userId)
            .maybeSingle();

        if (verifiedUser && server.verified_role) {
            await addConfiguredRole(server.verified_role, 'verified role');
        }
    } catch (e) {
        console.error(`[JOIN] Error handling member join:`, e.message);
    }
});

client.on('interactionCreate', async interaction => {
    if (!supabase) return;

    if (!interaction.isChatInputCommand()) return;

    const { commandName: rawCommandName, guildId, user, guild } = interaction;
    let commandName = rawCommandName;
    let miscCommand = null;
    if (rawCommandName === 'misc') {
        const subcommand = interaction.options.getSubcommand(false);
        miscCommand = subcommand ? MISC_SUBCOMMAND_TO_COMMAND[subcommand] || null : null;
    }

    // 1. Handle Setup separately (Owner Only)
    if (commandName === 'setup') {
        if (user.id !== guild?.ownerId) {
            return interaction.reply({
                content: 'This command can only be run by the server owner.',
                ephemeral: true
            });
        }

        let blockedServer = null;
        try {
            blockedServer = await findBlockedServerForGuild(guildId);
        } catch (error) {
            console.error(`[SETUP] Failed to check blocked status for ${guildId}:`, error.message);
            return interaction.reply({
                content: 'Unable to verify whether this server is allowed to use Ro-Link. Try again later.',
                ephemeral: true
            });
        }

        if (blockedServer) {
            return interaction.reply({
                content: getBlockedServerMessage(blockedServer),
                ephemeral: true
            });
        }

        // Check if already setup
        const { data: existingServer } = await supabase
            .from('servers')
            .select('*')
            .eq('id', guildId)
            .maybeSingle();

        if (existingServer) {
            const embeds = getSetupEmbeds(guildId, existingServer.api_key);
            return interaction.reply({
                content: '**This server is already set up!** Here are your integration details:',
                embeds: embeds,
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('setup_modal')
            .setTitle('Ro-Link Server Setup');

        const placeIdInput = new TextInputBuilder()
            .setCustomId('place_id')
            .setLabel("Roblox Place ID")
            .setPlaceholder('Enter your Place ID (e.g. 123456789)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const universeIdInput = new TextInputBuilder()
            .setCustomId('universe_id')
            .setLabel("Roblox Universe ID")
            .setPlaceholder('Enter your Universe ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const apiKeyInput = new TextInputBuilder()
            .setCustomId('api_key')
            .setLabel("Open Cloud API Key")
            .setPlaceholder('Enter your Roblox API Key (Hidden)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(placeIdInput),
            new ActionRowBuilder().addComponents(universeIdInput),
            new ActionRowBuilder().addComponents(apiKeyInput)
        );

        return await interaction.showModal(modal);
    }

    // 2. Handle Ping (Public)
    if (commandName === 'ping') {
        const latency = Math.abs(Date.now() - interaction.createdTimestamp);
        return interaction.reply(`**Pong!** \nLatency: \`${latency}ms\`\nStatus: \`Online (Vercel Integration Active)\``);
    }

    // 3. Handle Help (Public)
    if (commandName === 'help') {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const infoEmbed = new EmbedBuilder()
            .setTitle('Info')
            .setURL(baseUrl)
            .setImage(`${baseUrl}/Media/Ro-LinkIcon.png`)
            .setColor('#0ea5e9')
            .setDescription("Welcome to Ro-Link. We are a platform that enables you to connect your Discord / cmds to Roblox. We make the connection between Discord and Roblox feel like a very small gap. We allow kick, ban and unban cmds along with an advanced dashboard to show you your servers and player count.\n\nGive us a try, we are aways looking to help all community's no matter the size. Ro-link is perfect for any game and allows you to respond to urgent reports without the bother of having to join in game.");

        const commandsEmbed = new EmbedBuilder()
            .setTitle('Commands')
            .setURL(`${baseUrl}/docs`)
            .setColor('#10b981')
            .addFields(
                { name: '/setup', value: 'Initializes Ro-Link for this server (Owner Only).' },
                { name: '/ping', value: 'Check the bot response time and connection status.' },
                { name: '/moderation', value: 'Open Ban, Kick, Unban, Softban, Update, and Shutdown actions.' },
                { name: '/lookup', value: 'Lookup Discord info, linked Roblox info, server moderation history, and staff notes.' },
                { name: '/staff-note', value: 'Add a staff-only note to a Discord or Roblox user.' },
                { name: '/servers', value: 'View and manage live Roblox servers.' },
                { name: '/update', value: 'Update your linked Roblox profile and roles.' },
                { name: '/misc', value: 'Open Fly, Kill, Heal, Freeze, and other miscellaneous actions.' },
                { name: '/help', value: 'Show info and list of available commands.' }
            );

        return interaction.reply({ embeds: [infoEmbed, commandsEmbed] });
    }

    // 3. Check if server is setup in Ro-Link for all other commands
    const { data: server, error: serverError } = await supabase
        .from('servers')
        .select('id')
        .eq('id', guildId)
        .single();

    if (!server) {
        return interaction.reply({
            content: `This server is not set up with Ro-Link yet.\n\n**Server Owners** can use \`/setup\` to initialize it directly, or visit the dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guildId}`,
            ephemeral: true
        });
    }

    // 4. Permission Check for Moderation Commands
    if (commandName !== 'lookup' && !interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('BanMembers') && !interaction.member.permissions.has('KickMembers')) {
        return interaction.reply({
            content: 'You do not have permission to use moderation commands. (Requires Kick/Ban Members or Admin)',
            ephemeral: true
        });
    }

    if (commandName === 'ban') {
        const targetUser = interaction.options.getString('username');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await Promise.all([
            supabase.from('logs').insert([{
                server_id: guildId,
                action: 'BAN',
                target: targetUser,
                moderator: user.tag
            }]),
            supabase.from('command_queue').insert([{
                server_id: guildId,
                command: 'BAN',
                args: { username: targetUser, reason: reason, moderator: user.tag },
                status: 'PENDING'
            }]),
            interaction.reply(`🔨 **Banned** \`\${targetUser}\` from Roblox game. Reason: \${reason}`)
        ]);
    } else if (commandName === 'kick') {
        const targetUser = interaction.options.getString('username');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await Promise.all([
            supabase.from('logs').insert([{
                server_id: guildId,
                action: 'KICK',
                target: targetUser,
                moderator: user.tag
            }]),
            supabase.from('command_queue').insert([{
                server_id: guildId,
                command: 'KICK',
                args: { username: targetUser, reason: reason, moderator: user.tag },
                status: 'PENDING'
            }]),
            interaction.reply(`🥾 **Kicked** \`\${targetUser}\` from Roblox server. Reason: \${reason}`)
        ]);
    } else if (commandName === 'unban') {
        const targetUser = interaction.options.getString('username');

        await Promise.all([
            supabase.from('logs').insert([{
                server_id: guildId,
                action: 'UNBAN',
                target: targetUser,
                moderator: user.tag
            }]),
            supabase.from('command_queue').insert([{
                server_id: guildId,
                command: 'UNBAN',
                args: { username: targetUser, moderator: user.tag },
                status: 'PENDING'
            }]),
            interaction.reply(`🔓 **Unbanned** \`\${targetUser}\` from Roblox. Command sent to game servers.`)
        ]);
    } else if (commandName === 'softban') {
        const targetUser = interaction.options.getString('username');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const durationSeconds = interaction.options.getInteger('duration_seconds') || 3600;

        await Promise.all([
            supabase.from('logs').insert([{
                server_id: guildId,
                action: 'SOFTBAN',
                target: targetUser,
                moderator: user.tag
            }]),
            supabase.from('command_queue').insert([{
                server_id: guildId,
                command: 'SOFTBAN',
                args: { username: targetUser, reason: reason, duration_seconds: durationSeconds, moderator: user.tag },
                status: 'PENDING'
            }]),
            interaction.reply(`Temporarily banned \`${targetUser}\` from Roblox for ${durationSeconds} seconds. Reason: ${reason}`)
        ]);
    } else if (commandName === 'lookup') {
        let robloxUserArg = interaction.options.getString('roblox_user');
        let discordUserArg = interaction.options.getUser('discord_user');

        await interaction.deferReply({ ephemeral: true });

        try {
            const showStaffControls = await isServerStaffInteraction(interaction);

            // If neither is provided, default to the command runner (interaction.user)
            if (!robloxUserArg && !discordUserArg) {
                discordUserArg = interaction.user;
            }

            let discordLookup = null;
            let robloxLookup = null;
            let verifiedUserForRoblox = null;

            // Step 1: Query Discord if resolved/provided
            if (discordUserArg) {
                discordLookup = await fetchDiscordLookup(discordUserArg, guild, guildId);
            }

            // Step 2: Query Roblox if resolved/provided
            if (robloxUserArg) {
                robloxLookup = await fetchRobloxLookup(robloxUserArg, guildId);
                // Since they searched by Roblox username, see if there is a linked Discord user
                const { data: verified } = await supabase
                    .from('verified_users')
                    .select('*')
                    .eq('roblox_id', robloxLookup.id)
                    .maybeSingle();
                if (verified) {
                    verifiedUserForRoblox = verified;
                    // If we don't already have discordLookup fetched, fetch it now!
                    if (!discordLookup) {
                        try {
                            const linkedUser = await client.users.fetch(verified.discord_id).catch(() => null);
                            if (linkedUser) {
                                discordLookup = await fetchDiscordLookup(linkedUser, guild, guildId);
                            }
                        } catch (err) {
                            console.warn('[LOOKUP] Failed to fetch linked Discord user:', err.message);
                        }
                    }
                }
            } else if (discordLookup && discordLookup.verifiedUser) {
                // If they didn't search Roblox directly, but the Discord user has a linked Roblox account,
                // fetch the full Roblox profile info!
                try {
                    robloxLookup = await fetchRobloxLookup(discordLookup.verifiedUser.roblox_username, guildId);
                } catch (err) {
                    console.warn('[LOOKUP] Failed to fetch Roblox profile for verified user:', err.message);
                }
            }

            // If we found neither, throw an error
            if (!discordLookup && !robloxLookup) {
                throw new Error('Could not resolve any Discord or Roblox user to lookup.');
            }

            // Step 3: Combined Moderation History
            // We want to gather all prior moderation actions for all matched aliases/identities.
            const matchValues = new Set();
            if (discordLookup && discordLookup.user) {
                matchValues.add(discordLookup.user.id);
                matchValues.add(`<@${discordLookup.user.id}>`);
                matchValues.add(`<@!${discordLookup.user.id}>`);
                matchValues.add(discordLookup.user.username.toLowerCase());
                if (discordLookup.user.tag) matchValues.add(discordLookup.user.tag.toLowerCase());
            }
            if (robloxLookup) {
                matchValues.add(robloxLookup.username.toLowerCase());
                matchValues.add(String(robloxLookup.id).toLowerCase());
            }
            if (discordLookup && discordLookup.verifiedUser) {
                matchValues.add(String(discordLookup.verifiedUser.roblox_username || '').toLowerCase());
                matchValues.add(String(discordLookup.verifiedUser.roblox_id).toLowerCase());
            }
            if (verifiedUserForRoblox) {
                matchValues.add(String(verifiedUserForRoblox.roblox_username || '').toLowerCase());
                matchValues.add(String(verifiedUserForRoblox.roblox_id).toLowerCase());
            }

            let moderationHistory = [];
            if (showStaffControls) {
                const { data: logsRes, error: logsError } = await supabase
                    .from('logs')
                    .select('id, action, moderator, timestamp, target')
                    .eq('server_id', guildId)
                    .order('timestamp', { ascending: false })
                    .limit(100);

                if (!logsError && Array.isArray(logsRes)) {
                moderationHistory = logsRes
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
            }

            const embeds = [];

            // 1. Build Discord Embed
            if (discordLookup) {
                const createdAt = getDiscordCreatedAt(discordLookup.user.id);
                const linkedRobloxStr = discordLookup.verifiedUser
                    ? `[${discordLookup.verifiedUser.roblox_username}](https://www.roblox.com/users/${discordLookup.verifiedUser.roblox_id}/profile)\n\`ID: ${discordLookup.verifiedUser.roblox_id}\``
                    : (verifiedUserForRoblox 
                        ? `[${verifiedUserForRoblox.roblox_username}](https://www.roblox.com/users/${verifiedUserForRoblox.roblox_id}/profile)\n\`ID: ${verifiedUserForRoblox.roblox_id}\``
                        : 'No linked Roblox account found.');

                const discordEmbed = new EmbedBuilder()
                    .setTitle(`Discord User Info: ${formatDiscordUserTag(discordLookup.user)}`)
                    .setColor('#0ea5e9')
                    .setThumbnail(discordLookup.user?.displayAvatarURL?.({ size: 256 }) || null)
                    .addFields(
                        { name: 'Discord User', value: `<@${discordLookup.user.id}>`, inline: true },
                        { name: 'Username', value: truncateText(formatDiscordUserTag(discordLookup.user), 256), inline: true },
                        { name: 'Discord ID', value: `\`${discordLookup.user.id}\``, inline: true },
                        { name: 'Account Created', value: createdAt ? formatDiscordTimestamp(createdAt, 'F') : 'Unknown', inline: true },
                        { name: 'Joined Server', value: discordLookup.member?.joinedAt ? formatDiscordTimestamp(discordLookup.member.joinedAt.toISOString(), 'F') : 'Not in server or unknown', inline: true },
                        { name: 'Server Roles', value: `${discordLookup.member?.roles?.cache?.size ?? 0}`, inline: true },
                        { name: 'Linked Roblox', value: linkedRobloxStr, inline: false }
                    );
                embeds.push(discordEmbed);
            }

            // 2. Build Roblox Embed
            let finalRobloxLookup = robloxLookup;
            if (!finalRobloxLookup && discordLookup && discordLookup.verifiedUser) {
                // In case the full lookup failed above, fall back to whatever verifiedUser has
                finalRobloxLookup = {
                    id: discordLookup.verifiedUser.roblox_id,
                    username: discordLookup.verifiedUser.roblox_username,
                    displayName: discordLookup.verifiedUser.roblox_username,
                    description: 'Full profile could not be loaded.',
                    created: '',
                    isBanned: false,
                    avatarUrl: '',
                    inGame: false,
                    jobId: null
                };
            }

            if (finalRobloxLookup) {
                const profileUrl = `https://www.roblox.com/users/${finalRobloxLookup.id}/profile`;
                const robloxEmbed = new EmbedBuilder()
                    .setTitle(`Roblox Profile Info: ${finalRobloxLookup.username}`)
                    .setURL(profileUrl)
                    .setColor(finalRobloxLookup.isBanned ? '#ef4444' : finalRobloxLookup.inGame ? '#10b981' : '#0ea5e9')
                    .setThumbnail(finalRobloxLookup.avatarUrl || `https://www.roblox.com/headshot-thumbnail/image?userId=${finalRobloxLookup.id}&width=420&height=420&format=png`)
                    .addFields(
                        { name: 'Username', value: `[${finalRobloxLookup.username}](${profileUrl})`, inline: true },
                        { name: 'Display Name', value: truncateText(finalRobloxLookup.displayName || finalRobloxLookup.username, 256), inline: true },
                        { name: 'Roblox ID', value: `\`${finalRobloxLookup.id}\``, inline: true },
                        { name: 'Account Created', value: finalRobloxLookup.created ? formatDiscordTimestamp(finalRobloxLookup.created, 'F') : 'Unknown', inline: true },
                        { name: 'Status', value: finalRobloxLookup.isBanned ? 'Banned' : finalRobloxLookup.inGame ? 'In Game' : 'Offline', inline: true },
                        { name: 'Description', value: truncateText(finalRobloxLookup.description || 'No description provided.', 1024), inline: false }
                    );

                if (finalRobloxLookup.inGame && finalRobloxLookup.jobId) {
                    robloxEmbed.addFields({
                        name: 'Live Server',
                        value: `User is active in job \`${finalRobloxLookup.jobId}\``,
                        inline: false,
                    });
                }
                embeds.push(robloxEmbed);
            }

            const staffNoteTarget = {
                discordId: discordLookup?.user?.id || discordUserArg?.id || '',
                robloxId: finalRobloxLookup?.id || discordLookup?.verifiedUser?.roblox_id || verifiedUserForRoblox?.roblox_id || '',
                robloxUsername: finalRobloxLookup?.username || discordLookup?.verifiedUser?.roblox_username || verifiedUserForRoblox?.roblox_username || '',
            };
            let staffNotes = [];
            if (showStaffControls) {
                try {
                    staffNotes = await fetchStaffNotes(guildId, staffNoteTarget, 5);
                } catch (err) {
                    console.warn('[STAFF_NOTES] Failed to load notes for lookup:', err.message);
                }

                // 3. Build Moderation Embed
                const modEmbed = new EmbedBuilder()
                    .setTitle(`Server Moderation History`)
                    .setColor(moderationHistory.length > 0 ? '#ef4444' : '#0ea5e9')
                    .setDescription(formatModerationHistory(moderationHistory))
                    .setFooter({ text: `Ro-Link Utility System - ${moderationHistory.length} prior moderation action(s)` });
                embeds.push(modEmbed);

                const notesEmbed = new EmbedBuilder()
                    .setTitle('Staff Notes')
                    .setColor(staffNotes.length > 0 ? '#f59e0b' : '#64748b')
                    .setDescription(formatStaffNotes(staffNotes))
                    .setFooter({ text: `Ro-Link Systems - ${staffNotes.length} staff note(s)` });
                embeds.push(notesEmbed);
            }

            // Determine if Join button is needed
            let finalJobId = null;
            if (finalRobloxLookup && finalRobloxLookup.inGame && finalRobloxLookup.jobId) {
                finalJobId = finalRobloxLookup.jobId;
            } else if (discordLookup && discordLookup.activeServer && discordLookup.activeServer.id) {
                finalJobId = discordLookup.activeServer.id;
            }

            const actionButtons = [];
            if (finalJobId) {
                const { data: serverSettings } = await supabase
                    .from('servers')
                    .select('place_id')
                    .eq('id', guildId)
                    .maybeSingle();
                const joinUrl = buildRobloxJoinUrl(serverSettings?.place_id, finalJobId);
                if (joinUrl) {
                    actionButtons.push(new ButtonBuilder().setLabel('Join Game').setURL(joinUrl).setStyle(ButtonStyle.Link));
                }
            }

            if (showStaffControls) {
                actionButtons.push(
                    new ButtonBuilder().setLabel('Manage').setCustomId('lookup_manage').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setLabel('Add Staff Note').setCustomId(buildStaffNoteModalCustomId(staffNoteTarget)).setStyle(ButtonStyle.Primary)
                );
            }

            const components = actionButtons.length > 0
                ? [new ActionRowBuilder().addComponents(...actionButtons)]
                : [];

            await interaction.editReply({ embeds, components });

            // Log action
            await supabase.from('logs').insert([{
                server_id: guildId,
                action: 'LOOKUP',
                target: discordUserArg ? discordUserArg.id : (finalRobloxLookup ? finalRobloxLookup.username : 'Unknown'),
                moderator: user.tag
            }]);

        } catch (e) {
            console.error('[LOOKUP] Error:', e.message);
            return interaction.editReply(`Failed to lookup user: ${e.message || 'Unknown error'}`);
        }
    } else if (commandName === 'staff-note') {
        const noteBody = interaction.options.getString('note');
        const robloxUserArg = interaction.options.getString('roblox_user');
        let discordUserArg = interaction.options.getUser('discord_user');

        await interaction.deferReply({ ephemeral: true });

        try {
            if (!robloxUserArg && !discordUserArg) {
                discordUserArg = interaction.user;
            }

            let target = { discordId: discordUserArg?.id || '' };
            if (discordUserArg) {
                const discordLookup = await fetchDiscordLookup(discordUserArg, guild, guildId);
                target = {
                    discordId: discordUserArg.id,
                    robloxId: discordLookup.verifiedUser?.roblox_id || '',
                    robloxUsername: discordLookup.verifiedUser?.roblox_username || '',
                };
            }

            if (robloxUserArg) {
                const robloxLookup = await fetchRobloxLookup(robloxUserArg, guildId);
                const { data: verified } = await supabase
                    .from('verified_users')
                    .select('discord_id, roblox_id, roblox_username')
                    .eq('roblox_id', robloxLookup.id)
                    .maybeSingle();

                target = {
                    discordId: verified?.discord_id || target.discordId || '',
                    robloxId: robloxLookup.id,
                    robloxUsername: robloxLookup.username,
                };
            }

            const note = await createStaffNote({
                serverId: guildId,
                target,
                note: noteBody,
                createdByDiscordId: user.id,
                createdByTag: user.tag,
            });

            await supabase.from('logs').insert([{
                server_id: guildId,
                action: 'STAFF_NOTE',
                target: note.target_roblox_username || note.target_roblox_id || note.target_discord_id || 'Unknown User',
                moderator: user.tag,
            }]);

            await interaction.editReply(`Saved staff note for **${getStaffNoteTargetLabel(target)}**.`);
        } catch (e) {
            console.error('[STAFF_NOTE] Error:', e.message);
            return interaction.editReply(`Failed to save staff note: ${e.message || 'Unknown error'}`);
        }
    } else if (commandName === 'servers') {
        const search = String(interaction.options.getString('search') || '').trim().toLowerCase();
        const { data: serverSettings } = await supabase
            .from('servers')
            .select('place_id')
            .eq('id', guildId)
            .maybeSingle();
        const liveServers = await fetchLiveServers(guildId);
        const matches = search
            ? liveServers.filter((liveServer) => {
                const jobId = String(liveServer.id || '').toLowerCase();
                return jobId.includes(search)
                    || normalizeLivePlayerList(liveServer.players).some((player) =>
                        player.username.toLowerCase().includes(search)
                        || player.displayName.toLowerCase().includes(search)
                        || (player.userId ? player.userId.toLowerCase() === search : false)
                    );
            })
            : liveServers;

        if (search && matches.length === 1) {
            const selectedServer = matches[0];
            const player = normalizeLivePlayerList(selectedServer.players).find((candidate) =>
                candidate.username.toLowerCase().includes(search)
                || candidate.displayName.toLowerCase().includes(search)
                || (candidate.userId ? candidate.userId.toLowerCase() === search : false)
            ) || null;
            const joinUrl = buildRobloxJoinUrl(serverSettings?.place_id, selectedServer.id);
            const embed = new EmbedBuilder()
                .setTitle(player ? `Live Player: ${player.username}` : `Live Server: ${formatJobId(selectedServer.id)}`)
                .setColor(player ? '#10b981' : '#0ea5e9')
                .addFields(
                    { name: 'Job ID', value: `\`${selectedServer.id}\``, inline: false },
                    { name: 'Players', value: `${getVisiblePlayerCount(selectedServer)}`, inline: true },
                    { name: 'Updated', value: selectedServer.updated_at ? formatDiscordTimestamp(selectedServer.updated_at, 'R') : 'Unknown', inline: true },
                    { name: player ? 'Matched Player' : 'Player List', value: player ? (player.userId ? `${player.username}\n\`ID: ${player.userId}\`` : player.username) : (normalizeLivePlayerList(selectedServer.players).slice(0, 10).map((livePlayer) => livePlayer.username).join('\n') || 'No resolved players reported.'), inline: false }
                );
            const menu = new StringSelectMenuBuilder()
                .setCustomId(player ? `server_player_action|${encodeURIComponent(selectedServer.id)}|${encodeURIComponent(player.username)}` : `server_action|${encodeURIComponent(selectedServer.id)}`)
                .setPlaceholder(player ? `Manage ${player.username}...` : 'Manage this server...')
                .addOptions(player
                    ? [
                        new StringSelectMenuOptionBuilder().setLabel('Kick Player').setDescription('Kick this Roblox user').setValue('KICK'),
                        new StringSelectMenuOptionBuilder().setLabel('Ban Player').setDescription('Ban this Roblox user').setValue('BAN'),
                        new StringSelectMenuOptionBuilder().setLabel('Kill Player').setDescription('Kill this Roblox user').setValue('KILL'),
                        new StringSelectMenuOptionBuilder().setLabel('Heal Player').setDescription('Heal this Roblox user').setValue('HEAL'),
                    ]
                    : [
                        new StringSelectMenuOptionBuilder().setLabel('Shutdown Server').setDescription('Shut down this live server').setValue('SHUTDOWN'),
                        new StringSelectMenuOptionBuilder().setLabel('Update Server').setDescription('Restart this live server').setValue('UPDATE'),
                    ]);
            const rows = [new ActionRowBuilder().addComponents(menu)];
            if (joinUrl) {
                rows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Join Game').setURL(joinUrl).setStyle(ButtonStyle.Link)
                ));
            }
            return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
        }

        const listedServers = matches.slice(0, 25);
        const embed = new EmbedBuilder()
            .setTitle(search ? 'Live Server Search Results' : 'Live Servers')
            .setDescription(listedServers.length > 0
                ? listedServers.map((liveServer, index) => {
                    const players = normalizeLivePlayerList(liveServer.players);
                    const sample = players.slice(0, 3).map((player) => player.username).join(', ');
                    return `**${index + 1}.** \`${formatJobId(liveServer.id)}\` - ${getVisiblePlayerCount(liveServer)} player(s)${sample ? ` - ${sample}` : ''}`;
                }).join('\n')
                : 'No live servers found.')
            .setColor('#0ea5e9');

        const components = listedServers.length > 0
            ? [new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('servers_select')
                    .setPlaceholder('Choose a live server...')
                    .addOptions(listedServers.map((liveServer) =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`Server ${formatJobId(liveServer.id)}`.slice(0, 100))
                            .setDescription(`${getVisiblePlayerCount(liveServer)} player(s)`.slice(0, 100))
                            .setValue(String(liveServer.id).slice(0, 100))
                    ))
            )]
            : [];

        return interaction.reply({ embeds: [embed], components, ephemeral: true });
    } else if (commandName === 'update-servers') {
        if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ManageGuild')) {
            return interaction.reply({ content: 'You do not have permission to use this command. (Requires Administrator/Manage Server)', ephemeral: true });
        }
        await Promise.all([
            supabase.from('logs').insert([{
                server_id: guildId,
                action: 'UPDATE_SERVERS',
                target: 'ALL',
                moderator: user.tag
            }]),
            supabase.from('command_queue').insert([{
                server_id: guildId,
                command: 'UPDATE',
                args: { moderator: user.tag },
                status: 'PENDING'
            }]),
            interaction.reply(`🚀 **Update Signal Sent**! All game servers will restart shortly.`)
        ]);
    } else if (commandName === 'update') {
        const targetUser = interaction.options.getUser('user') || user;
        const isSelf = targetUser.id === user.id;

        if (!isSelf && !interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ManageRoles')) {
            return interaction.reply({ content: 'You do not have permission to update other users.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // 1. Fetch from DB
        const { data: verifiedUser, error: dbError } = await supabase
            .from('verified_users')
            .select('*')
            .eq('discord_id', targetUser.id)
            .maybeSingle();

        if (dbError || !verifiedUser) {
            return interaction.editReply(`❌ <@${targetUser.id}> is not linked with Ro-Link. Use \`/verify\` to get started.`);
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
                        .eq('discord_id', targetUser.id);
                }

                // 4. Update Roles/Nickname in this server
                const { data: serverSettings } = await supabase
                    .from('servers')
                    .select('verified_role, nick_template')
                    .eq('id', guildId)
                    .single();

                const member = await guild.members.fetch(targetUser.id);

                // Roles
                if (serverSettings?.verified_role) {
                    const role = guild.roles.cache.get(serverSettings.verified_role);
                    if (role && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role).catch(() => { });
                    }
                }

                // Nickname
                if (serverSettings?.nick_template) {
                    const nick = serverSettings.nick_template
                        .replace(/{roblox_username}/g, robloxData.name)
                        .replace(/{roblox_id}/g, verifiedUser.roblox_id)
                        .replace(/{discord_name}/g, targetUser.username.substring(0, 16));

                    if (member.manageable) {
                        await member.setNickname(nick.substring(0, 32)).catch(() => { });
                    }
                }

                return interaction.editReply(`✅ **Profile Updated**!\nLinked Account: \`${robloxData.name}\` (\`${verifiedUser.roblox_id}\`)`);
            } else {
                return interaction.editReply(`❌ Failed to fetch Roblox data. Please try again later.`);
            }
        } catch (e) {
            console.error(`[UPDATE] Error:`, e.message);
            return interaction.editReply(`❌ An error occurred while updating the profile.`);
        }
    } else if (commandName === 'shutdown') {
        const jobId = interaction.options.getString('job_id');

        await Promise.all([
            supabase.from('logs').insert([{
                server_id: guildId,
                action: 'SHUTDOWN',
                target: jobId || 'ALL',
                moderator: user.tag
            }]),
            supabase.from('command_queue').insert([{
                server_id: guildId,
                command: 'SHUTDOWN',
                args: { job_id: jobId, moderator: user.tag },
                status: 'PENDING'
            }]),
            interaction.reply(`🛑 **SHUTDOWN SIGNAL SENT**! Closing \`\${jobId || 'all active game servers'}\`.`)
        ]);
    } else if (commandName === 'moderation') {
        const embed = new EmbedBuilder()
            .setTitle('Moderation Actions')
            .setDescription('Select an action from the menu below.')
            .setColor('#ef4444')
            .addFields(
                { name: 'Player Actions', value: '`BAN` `KICK` `UNBAN` `SOFTBAN`', inline: false },
                { name: 'Server Actions', value: '`UPDATE` `SHUTDOWN`', inline: false }
            )
            .setFooter({ text: 'Ro-Link Moderation System' });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('moderation_menu')
                    .setPlaceholder('Choose a moderation action...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Ban').setDescription('Permanently ban a Roblox user').setValue('BAN'),
                        new StringSelectMenuOptionBuilder().setLabel('Kick').setDescription('Kick a Roblox user from the server').setValue('KICK'),
                        new StringSelectMenuOptionBuilder().setLabel('Unban').setDescription('Lift a Roblox ban').setValue('UNBAN'),
                        new StringSelectMenuOptionBuilder().setLabel('Softban').setDescription('Temporarily ban and remove a Roblox user').setValue('SOFTBAN'),
                        new StringSelectMenuOptionBuilder().setLabel('Update Servers').setDescription('Restart all Roblox servers').setValue('UPDATE'),
                        new StringSelectMenuOptionBuilder().setLabel('Shutdown').setDescription('Shut down Roblox servers').setValue('SHUTDOWN'),
                    ),
            );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } else if (commandName === 'misc') {
        if (miscCommand) {
            let targetUser = interaction.options.getString('username');
            const args = { username: targetUser, moderator: user.tag };
            if (miscCommand === 'SET_CHAR') {
                args.char_user = interaction.options.getString('char_user');
            }
            if (miscCommand === 'TEAM') {
                args.team_name = interaction.options.getString('team_name');
            }
            if (miscCommand === 'VIEW') {
                const linkedRobloxUsername = await getLinkedRobloxUsername(user.id);
                if (!linkedRobloxUsername) {
                    return interaction.reply({ content: 'Link your Discord account to Roblox before using View.', ephemeral: true });
                }
                args.moderator_roblox_username = linkedRobloxUsername;
                if (!targetUser) {
                    targetUser = linkedRobloxUsername;
                    args.username = linkedRobloxUsername;
                }
            }
            if (miscCommand === 'TELEPORT_TO_ME') {
                args.moderator_roblox_username = interaction.options.getString('moderator_username');
            }
            if (VALUE_INPUT_MISC_COMMANDS.has(miscCommand)) {
                args.amount = interaction.options.getNumber('amount');
            }

            await Promise.all([
                supabase.from('logs').insert([{
                    server_id: guildId,
                    action: miscCommand,
                    target: targetUser,
                    moderator: user.tag
                }]),
                supabase.from('command_queue').insert([{
                    server_id: guildId,
                    command: miscCommand,
                    args,
                    status: 'PENDING'
                }]),
                interaction.reply({ content: `Queued **${miscCommand}** for \`${targetUser}\`.`, ephemeral: true })
            ]);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Miscellaneous Player Actions')
            .setDescription('Select an action from the menu below to apply it to a Roblox player.')
            .setColor('#0ea5e9')
            .addFields(
                { name: 'Fly', value: 'Enables hover/flight for the target player.', inline: false },
                { name: 'Noclip', value: 'Allows the player to pass through walls.', inline: false },
                { name: 'Invis', value: 'Makes the player and their accessories fully invisible.', inline: false },
                { name: 'Ghost', value: 'Applies a ForceField material to the player character.', inline: false },
                { name: 'Set Char', value: 'Copies the appearance/bundle of another Roblox user.', inline: false },
                { name: 'Heal', value: 'Restores player health to maximum.', inline: false },
                { name: 'Kill', value: 'Immediately kills the target player.', inline: false },
                { name: 'Ragdoll', value: 'Temporarily forces the target player into a ragdoll state.', inline: false },
                { name: 'Reset', value: 'Resets the player character.', inline: false },
                { name: 'Refresh', value: 'Respawn the player character.', inline: false },
                { name: 'View', value: 'View a player or reset your camera to yourself.', inline: false },
                { name: 'Team', value: 'Move a player to a Roblox team.', inline: false }
            )
            .setFooter({ text: 'Ro-Link Utility System' });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('misc_menu')
                    .setPlaceholder('Choose an action...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Fly')
                            .setDescription('Enable flight for the player')
                            .setValue('FLY'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Noclip')
                            .setDescription('Allow player to walk through walls')
                            .setValue('NOCLIP'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Invis')
                            .setDescription('Make the player invisible')
                            .setValue('INVIS'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Ghost')
                            .setDescription('Apply a ForceField material')
                            .setValue('GHOST'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Set Character')
                            .setDescription('Change appearance')
                            .setValue('SET_CHAR'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Heal')
                            .setDescription('Restore health')
                            .setValue('HEAL'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Damage')
                            .setDescription('Deal damage')
                            .setValue('DAMAGE'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Max Health')
                            .setDescription('Set maximum health')
                            .setValue('MAX_HEALTH'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Walk Speed')
                            .setDescription('Set walk speed')
                            .setValue('WALK_SPEED'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Jump Power')
                            .setDescription('Set jump power')
                            .setValue('JUMP_POWER'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Kill')
                            .setDescription('Instant kill')
                            .setValue('KILL'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Reset')
                            .setDescription('Reset character')
                            .setValue('RESET'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Refresh')
                            .setDescription('Refresh character')
                            .setValue('REFRESH'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('View')
                            .setDescription('View or reset your camera')
                            .setValue('VIEW'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Team')
                            .setDescription('Move to a team')
                            .setValue('TEAM'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Freeze')
                            .setDescription('Anchor in place')
                            .setValue('FREEZE'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Unfreeze')
                            .setDescription('Remove freeze')
                            .setValue('UNFREEZE'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Ragdoll')
                            .setDescription('Temporarily ragdoll')
                            .setValue('RAGDOLL'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Bring To Spawn')
                            .setDescription('Move to spawn')
                            .setValue('BRING_TO_SPAWN'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Teleport To Me')
                            .setDescription('Move to a moderator')
                            .setValue('TELEPORT_TO_ME'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Add ForceField')
                            .setDescription('Add a ForceField')
                            .setValue('FORCEFIELD_ADD'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Remove ForceField')
                            .setDescription('Remove ForceFields')
                            .setValue('FORCEFIELD_REMOVE'),
                    ),
            );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

    } else if (commandName === 'ping') {
        const latency = Math.abs(Date.now() - interaction.createdTimestamp);
        await interaction.reply(`**Pong!** \nLatency: \`${latency}ms\`\nStatus: \`Online (Vercel Integration Active)\``);
    } else if (commandName === 'verify') {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const embed = new EmbedBuilder()
            .setTitle('🔗 Link your Roblox Account')
            .setDescription('To use Ro-Link features, you must link your Roblox account with your Discord account.')
            .setColor('#0ea5e9')
            .addFields(
                { name: 'Step 1', value: `Click [here](\${baseUrl}/verify) to go to the verification portal.` },
                { name: 'Step 2', value: 'Log in with Discord and authorized Roblox via OAuth.' },
                { name: 'Step 3', value: 'Return here and use `/lookup` to see your linked account!' }
            )
            .setFooter({ text: 'Ro-Link Verification System' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Link Account')
                    .setURL(`\${baseUrl}/verify`)
                    .setStyle(ButtonStyle.Link)
            );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    } else if (commandName === 'report') {
        const { data: server, error: serverError } = await supabase
            .from('servers')
            .select('reports_enabled')
            .eq('id', guildId)
            .single();

        if (serverError || !server?.reports_enabled) {
            return interaction.reply({
                content: `❌ The report system is currently **DISABLED** in this server.`,
                ephemeral: true
            });
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const embed = new EmbedBuilder()
            .setTitle('Player Reporting System')
            .setDescription('Submit a report against a player for rule violations. All reports are reviewed by server moderators.')
            .setColor('#ff4444')
            .setThumbnail(`${baseUrl}/Media/Ro-LinkIcon.png`)
            .addFields(
                { name: 'Warning', value: "False reporting or misuse of this system may result in a ban from the bot and server.", inline: false },
                { name: 'Process', value: "1. Click the button below\n2. Enter the Roblox Username\n3. Describe the incident and provide proof if possible", inline: false }
            )
            .setFooter({ text: 'Ro-Link Systems • Reports', iconURL: `${baseUrl}/Media/Ro-LinkIcon.png` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('report_open')
                    .setLabel('Create Report')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🚨')
            );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
});

// Handle Select Menu Interactions
client.on('interactionCreate', async interaction => {
    if (!supabase) return;

    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'servers_select') {
        const jobId = interaction.values[0];
        const [liveServers, serverSettingsRes] = await Promise.all([
            fetchLiveServers(interaction.guildId),
            supabase.from('servers').select('place_id').eq('id', interaction.guildId).maybeSingle(),
        ]);
        const selectedServer = liveServers.find((liveServer) => String(liveServer.id || '') === jobId);
        if (!selectedServer) {
            return interaction.reply({ content: 'That live server is no longer active.', ephemeral: true });
        }

        const joinUrl = buildRobloxJoinUrl(serverSettingsRes.data?.place_id, selectedServer.id);
        const players = normalizeLivePlayerList(selectedServer.players);
        const embed = new EmbedBuilder()
            .setTitle(`Live Server: ${formatJobId(selectedServer.id)}`)
            .setColor('#0ea5e9')
            .addFields(
                { name: 'Job ID', value: `\`${selectedServer.id}\``, inline: false },
                { name: 'Players', value: `${getVisiblePlayerCount(selectedServer)}`, inline: true },
                { name: 'Updated', value: selectedServer.updated_at ? formatDiscordTimestamp(selectedServer.updated_at, 'R') : 'Unknown', inline: true },
                { name: 'Player List', value: players.slice(0, 10).map((player) => player.username).join('\n') || 'No resolved players reported.', inline: false }
            );
        const rows = [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`server_action|${encodeURIComponent(jobId)}`)
                    .setPlaceholder('Manage this server...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Shutdown Server').setDescription('Shut down this live server').setValue('SHUTDOWN'),
                        new StringSelectMenuOptionBuilder().setLabel('Update Server').setDescription('Restart this live server').setValue('UPDATE'),
                    )
            )
        ];
        if (joinUrl) {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Join Game').setURL(joinUrl).setStyle(ButtonStyle.Link)
            ));
        }

        return interaction.update({ embeds: [embed], components: rows });
    }

    if (interaction.customId.startsWith('server_action|') || interaction.customId.startsWith('server_player_action|')) {
        const parts = interaction.customId.split('|');
        const isPlayerAction = parts[0] === 'server_player_action';
        const jobId = decodeURIComponent(parts[1] || '');
        const username = isPlayerAction ? decodeURIComponent(parts[2] || '') : '';
        const command = interaction.values[0];
        const args = {
            job_id: jobId,
            moderator: interaction.user.tag,
            reason: 'Discord live server action',
        };
        if (isPlayerAction) {
            args.username = username;
        }

        await Promise.all([
            supabase.from('command_queue').insert([{
                server_id: interaction.guildId,
                command,
                args,
                status: 'PENDING',
            }]),
            supabase.from('logs').insert([{
                server_id: interaction.guildId,
                action: command === 'UPDATE' ? 'UPDATE_SERVERS' : command,
                target: isPlayerAction ? username : jobId,
                moderator: interaction.user.tag,
            }])
        ]);

        return interaction.reply({
            content: `Queued **${command}** for ${isPlayerAction ? `\`${username}\`` : `server \`${formatJobId(jobId)}\``}.`,
            ephemeral: true,
        });
    }

    if (interaction.customId === 'moderation_menu') {
        const action = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`moderation_modal_${action}`)
            .setTitle(`Moderation: ${action}`);

        const rows = [];

        if (['BAN', 'KICK', 'UNBAN', 'SOFTBAN'].includes(action)) {
            rows.push(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('username')
                    .setLabel('Roblox Username')
                    .setPlaceholder('Enter the Roblox username')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ));
        }

        if (['BAN', 'KICK', 'SOFTBAN', 'UPDATE'].includes(action)) {
            rows.push(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel(action === 'UPDATE' ? 'Update Message' : 'Reason')
                    .setPlaceholder(action === 'UPDATE' ? 'Message shown when players are kicked' : 'Reason for this action')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
            ));
        }

        if (action === 'SOFTBAN') {
            rows.push(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('duration_seconds')
                    .setLabel('Duration Seconds')
                    .setPlaceholder('3600')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            ));
        }

        if (action === 'SHUTDOWN') {
            rows.push(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('job_id')
                    .setLabel('Job ID')
                    .setPlaceholder('Leave blank for all active servers')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            ));
        }

        modal.addComponents(...rows);
        await interaction.showModal(modal);
    }

    if (interaction.customId === 'misc_menu') {
        const action = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`misc_modal_${action}`)
            .setTitle(`Action: ${action}`);

        const targetUserInput = new TextInputBuilder()
            .setCustomId('target_user')
            .setLabel("Target Username")
            .setPlaceholder(action === 'VIEW' ? 'Leave blank to reset your camera' : 'Enter the Roblox username')
            .setStyle(TextInputStyle.Short)
            .setRequired(action !== 'VIEW');

        const rows = [new ActionRowBuilder().addComponents(targetUserInput)];

        if (action === 'SET_CHAR') {
            const charUserInput = new TextInputBuilder()
                .setCustomId('char_user')
                .setLabel("Character Username")
                .setPlaceholder('Username of appearance to copy')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            rows.push(new ActionRowBuilder().addComponents(charUserInput));
        }

        if (VALUE_INPUT_MISC_COMMANDS.has(action)) {
            const amountInput = new TextInputBuilder()
                .setCustomId('amount')
                .setLabel('Amount')
                .setPlaceholder('Enter a number')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            rows.push(new ActionRowBuilder().addComponents(amountInput));
        }

        if (action === 'TEAM') {
            const teamNameInput = new TextInputBuilder()
                .setCustomId('team_name')
                .setLabel('Roblox Team Name')
                .setPlaceholder('Exact team name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            rows.push(new ActionRowBuilder().addComponents(teamNameInput));
        }

        if (action === 'TELEPORT_TO_ME') {
            const moderatorUsernameInput = new TextInputBuilder()
                .setCustomId('moderator_username')
                .setLabel('Your Roblox Username')
                .setPlaceholder('Moderator username in-game')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            rows.push(new ActionRowBuilder().addComponents(moderatorUsernameInput));
        }

        modal.addComponents(...rows);
        await interaction.showModal(modal);
    }
});

// Handle Modal Submissions (Misc)
client.on('interactionCreate', async interaction => {
    if (!supabase) return;

    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('staff_note_modal|')) {
        if (!await isServerStaffInteraction(interaction)) {
            return interaction.reply({ content: 'You do not have permission to add staff notes.', ephemeral: true });
        }

        try {
            const target = decodeStaffNoteModalTarget(interaction.customId.replace('staff_note_modal|', ''));
            const note = await createStaffNote({
                serverId: interaction.guildId,
                target,
                note: interaction.fields.getTextInputValue('staff_note'),
                createdByDiscordId: interaction.user.id,
                createdByTag: interaction.user.tag,
            });

            await supabase.from('logs').insert([{
                server_id: interaction.guildId,
                action: 'STAFF_NOTE',
                target: note.target_roblox_username || note.target_roblox_id || note.target_discord_id || 'Unknown User',
                moderator: interaction.user.tag,
            }]);

            return interaction.reply({
                content: `Saved staff note for **${getStaffNoteTargetLabel(target)}**.`,
                ephemeral: true,
            });
        } catch (e) {
            return interaction.reply({
                content: `Failed to save staff note: ${e.message || 'Unknown error'}`,
                ephemeral: true,
            });
        }
    }

    if (interaction.customId.startsWith('moderation_modal_')) {
        const action = interaction.customId.replace('moderation_modal_', '');
        const getOptionalField = (id) => {
            try {
                return interaction.fields.getTextInputValue(id);
            } catch {
                return '';
            }
        };

        const targetUser = getOptionalField('username');
        const reason = getOptionalField('reason') || 'No reason provided';
        const jobId = getOptionalField('job_id');
        const durationValue = Number(getOptionalField('duration_seconds') || 3600);
        const durationSeconds = Number.isFinite(durationValue) && durationValue > 0 ? Math.floor(durationValue) : 3600;
        const command = action === 'UPDATE' ? 'UPDATE' : action;
        const args = { moderator: interaction.user.tag };
        let target = targetUser || 'ALL';
        let msgContent = `Queued **${command}**.`;

        if (['BAN', 'KICK', 'UNBAN', 'SOFTBAN'].includes(command)) {
            args.username = targetUser;
            args.reason = reason;
            target = targetUser;
            msgContent = `Queued **${command}** for **${targetUser}**.`;
        }

        if (command === 'SOFTBAN') {
            args.duration_seconds = durationSeconds;
            msgContent = `Queued **SOFTBAN** for **${targetUser}** for ${durationSeconds} seconds.`;
        }

        if (command === 'UPDATE') {
            args.reason = reason === 'No reason provided' ? 'Manual Update Triggered' : reason;
            target = 'ALL';
            msgContent = 'Queued **UPDATE** for all game servers.';
        }

        if (command === 'SHUTDOWN') {
            args.job_id = jobId;
            target = jobId || 'ALL';
            msgContent = jobId ? `Queued **SHUTDOWN** for job **${jobId}**.` : 'Queued **SHUTDOWN** for all active game servers.';
        }

        await interaction.reply({ content: msgContent, ephemeral: true });

        await supabase.from('command_queue').insert([{
            server_id: interaction.guildId,
            command,
            args,
            status: 'PENDING'
        }]);

        await supabase.from('logs').insert([{
            server_id: interaction.guildId,
            action: command === 'UPDATE' ? 'UPDATE_SERVERS' : command,
            target,
            moderator: interaction.user.tag
        }]);
    }

    if (interaction.customId.startsWith('misc_modal_')) {
        const action = interaction.customId.replace('misc_modal_', '');
        const getOptionalField = (id) => {
            try {
                return interaction.fields.getTextInputValue(id);
            } catch {
                return '';
            }
        };
        let targetUser = getOptionalField('target_user');

        let args = { username: targetUser, moderator: interaction.user.tag };
        let msgContent = `Queuing **${action}** for **${targetUser}**...`;

        if (action === 'SET_CHAR') {
            const charUser = interaction.fields.getTextInputValue('char_user');
            args.char_user = charUser;
            msgContent = `Queuing **Set Character** (to ${charUser}) for **${targetUser}**...`;
        }

        if (VALUE_INPUT_MISC_COMMANDS.has(action)) {
            const amount = Number(interaction.fields.getTextInputValue('amount'));
            if (!Number.isFinite(amount)) {
                return interaction.reply({ content: 'Please provide a valid amount.', ephemeral: true });
            }
            args.amount = amount;
            msgContent = `Queuing **${action}** (${amount}) for **${targetUser}**...`;
        }

        if (action === 'TEAM') {
            const teamName = getOptionalField('team_name').trim();
            if (!teamName) {
                return interaction.reply({ content: 'Please provide a Roblox team name.', ephemeral: true });
            }
            args.team_name = teamName;
            msgContent = `Queuing **Team** (${teamName}) for **${targetUser}**...`;
        }

        if (action === 'VIEW') {
            const linkedRobloxUsername = await getLinkedRobloxUsername(interaction.user.id);
            if (!linkedRobloxUsername) {
                return interaction.reply({ content: 'Link your Discord account to Roblox before using View.', ephemeral: true });
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
            args.moderator_roblox_username = getOptionalField('moderator_username');
            msgContent = `Queuing **Teleport To Me** for **${targetUser}**...`;
        }

        await interaction.reply({ content: msgContent, ephemeral: true });

        await supabase.from('command_queue').insert([{
            server_id: interaction.guildId,
            command: action,
            args: args,
            status: 'PENDING'
        }]);

        await supabase.from('logs').insert([{
            server_id: interaction.guildId,
            action: action,
            target: targetUser,
            moderator: interaction.user.tag
        }]);
    }
});



// Handle Button Interactions
client.on('interactionCreate', async interaction => {
    if (!supabase) return;

    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (customId === 'lookup_manage') {
        if (!await isServerStaffInteraction(interaction)) {
            return interaction.reply({ content: 'You need moderation permissions to use these actions.', ephemeral: true });
        }

        const moderationPanel = buildModerationPanel();
        const miscPanel = buildMiscPanel();
        return interaction.reply({
            embeds: [moderationPanel.embed, miscPanel.embed],
            components: [moderationPanel.row, miscPanel.row],
            ephemeral: true,
        });
    }

    if (customId.startsWith('staff_note_modal|')) {
        if (!await isServerStaffInteraction(interaction)) {
            return interaction.reply({ content: 'You do not have permission to add staff notes.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle('Add Staff Note');

        const noteInput = new TextInputBuilder()
            .setCustomId('staff_note')
            .setLabel('Staff Note')
            .setPlaceholder('Add context only server staff should see.')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(1)
            .setMaxLength(1500)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
        return interaction.showModal(modal);
    }

    // Handle Report Toggle
    if (customId.startsWith('switch_')) {
        const isRoblox = customId.startsWith('switch_roblox');
        const target = customId.split('_').pop();

        const row = new ActionRowBuilder()
            .addComponents(
                isRoblox ? [
                    new ButtonBuilder().setCustomId(`KICK_0_${target}`).setLabel('Kick (Roblox)').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`BAN_0_${target}`).setLabel('Ban (Roblox)').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`switch_discord_${target}`).setLabel('Discord Actions').setStyle(ButtonStyle.Primary)
                ] : [
                    new ButtonBuilder().setCustomId(`discord_kick_${target}`).setLabel('Kick (Discord)').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`discord_ban_${target}`).setLabel('Ban (Discord)').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`switch_roblox_${target}`).setLabel('Roblox Actions').setStyle(ButtonStyle.Primary)
                ]
            );

        return await interaction.update({ components: [row] });
    }

    // Handle Discord Actions
    if (customId.startsWith('discord_')) {
        const parts = customId.split('_');
        const action = parts[1]; // kick or ban
        const target = parts.slice(2).join('_');

        let targetId = target;
        if (target.includes('<@')) {
            targetId = target.replace(/[<@!>]/g, '');
        }

        // Check permissions
        if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has(action === 'ban' ? 'BanMembers' : 'KickMembers')) {
            return interaction.reply({ content: `You do not have permission to ${action} members.`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // Resolve target to ID if it's a username
        if (isNaN(Number(targetId))) {
            const { data } = await supabase.from('verified_users').select('discord_id').ilike('roblox_username', target).maybeSingle();
            if (data) targetId = data.discord_id;
        }

        if (isNaN(Number(targetId))) {
            return interaction.editReply(`❌ Could not resolve Discord ID for \`${target}\`.`);
        }

        try {
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (!member && action === 'kick') {
                return interaction.editReply(`❌ User <@${targetId}> is not in the server.`);
            }

            if (action === 'ban') {
                await interaction.guild.members.ban(targetId, { reason: `Report Action by ${interaction.user.tag}` });
            } else {
                await member.kick(`Report Action by ${interaction.user.tag}`);
            }

            await interaction.editReply(`✅ Successfully **${action.toUpperCase()}ED** <@${targetId}> from the server.`);
        } catch (e) {
            console.error(`[DISCORD ACTION] Failed to ${action}:`, e.message);
            await interaction.editReply(`❌ Failed to ${action} user: ${e.message}`);
        }
        return;
    }

    const parts = customId.split('_');
    const action = parts[0];
    const userId = parts[1];
    const username = parts.slice(2).join('_');
    const guildId = interaction.guildId;

    // Check permissions (Admin only)
    if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('BanMembers') && !interaction.member.permissions.has('KickMembers')) {
        return interaction.reply({ content: 'You need moderation permissions to use these actions.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // Queue command for Roblox
    const { error } = await supabase.from('command_queue').insert([{
        server_id: guildId,
        command: action.toUpperCase(),
        args: { username: username, reason: 'Discord Button Action', moderator: interaction.user.tag },
        status: 'PENDING'
    }]);

    if (error) {
        return interaction.editReply(`Failed to queue ${action}.`);
    }

    // Log the action
    await supabase.from('logs').insert([{
        server_id: guildId,
        action: action.toUpperCase(),
        target: username,
        moderator: interaction.user.tag
    }]);

    await interaction.editReply(`**${action.toUpperCase()}** command queued for \`${username}\`.`);
});

// Handle Modal Submissions
client.on('interactionCreate', async interaction => {
    if (!supabase) return;

    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'setup_modal') {
        const placeId = interaction.fields.getTextInputValue('place_id');
        const universeId = interaction.fields.getTextInputValue('universe_id');
        const openCloudKey = interaction.fields.getTextInputValue('api_key');

        await interaction.deferReply({ ephemeral: true });

        let blockedServer = null;
        try {
            blockedServer = await findBlockedServerForGuild(interaction.guildId);
        } catch (error) {
            console.error(`[SETUP] Failed to check blocked status for ${interaction.guildId}:`, error.message);
            return interaction.editReply('Unable to verify whether this server is allowed to use Ro-Link. Try again later.');
        }

        if (blockedServer) {
            return interaction.editReply(getBlockedServerMessage(blockedServer));
        }

        const { data: existingServer } = await supabase
            .from('servers')
            .select('api_key')
            .eq('id', interaction.guildId)
            .maybeSingle();

        const generatedKey = existingServer?.api_key?.trim()
            || ('rl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

        const { error: dbError } = await supabase
            .from('servers')
            .upsert({
                id: interaction.guildId,
                place_id: placeId,
                universe_id: universeId,
                open_cloud_key: openCloudKey,
                api_key: generatedKey
            });

        if (dbError) {
            return interaction.editReply(`Setup failed: \${dbError.message}`);
        }

        const embeds = getSetupEmbeds(interaction.guildId, generatedKey);
        await interaction.editReply({
            content: '**Setup Successful!** Please follow the instructions below to complete the integration:',
            embeds: embeds
        });
    }
});

// Helper for Setup Instructions
function getSetupEmbeds(guildId, apiKey) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const installerPluginUrl = 'https://create.roblox.com/store/asset/87859041511603/RoLink-installer';

    const embed1 = new EmbedBuilder()
        .setTitle('Studio Setup Instructions')
        .setColor('#0ea5e9')
        .setURL(`${baseUrl}/dashboard/${guildId}`)
        .setImage(`${baseUrl}/Media/Ro-LinkIcon.png`)
        .addFields(
            { name: '1. Installer Plugin', value: `[Install the RoLink installer plugin](${installerPluginUrl}) from the Roblox Creator Store.` },
            { name: '2. Open in Studio', value: "Open your experience in Roblox Studio, then launch **RoLink installer** from the **Plugins** tab." },
            { name: '3. Security Key', value: "Copy the Security Key from the next embed and paste it into the installer when prompted." },
            { name: '4. Publish', value: "Let the plugin place the Ro-Link bridge, then enable **HTTP Requests** and **API Services** if your experience requires them before publishing." },
            { name: 'Dashboard', value: `${baseUrl}/dashboard/${guildId}` }
        );

    const embed2 = new EmbedBuilder()
        .setTitle('Ro-Link Security Key')
        .setColor('#10b981')
        .setDescription(`Paste this key into the RoLink installer plugin in Roblox Studio.\n\n\`\`\`\n${apiKey}\n\`\`\``)
        .setFooter({ text: 'Keep your Security Key private!' });

    return [embed1, embed2];
}

// Handle Report Button
client.on('interactionCreate', async interaction => {
    if (!supabase) return;

    if (!interaction.isButton()) return;
    if (interaction.customId !== 'report_open') return;

    const modal = new ModalBuilder()
        .setCustomId('report_submit')
        .setTitle('Submit Player Report');

    const usernameInput = new TextInputBuilder()
        .setCustomId('target_input')
        .setLabel("Roblox User or Discord ID")
        .setPlaceholder('Username or User ID')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(32)
        .setRequired(true);

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel("Reason & Evidence")
        .setPlaceholder('Describe what happened...')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(10)
        .setMaxLength(1000)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(usernameInput),
        new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
});

// Handle Report Submission
client.on('interactionCreate', async interaction => {
    if (!supabase) return;

    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'report_submit') return;

    const targetInput = interaction.fields.getTextInputValue('target_input');
    const reason = interaction.fields.getTextInputValue('reason');
    const guildId = interaction.guildId;

    await interaction.deferReply({ ephemeral: true });

    // 1. Save to Database
    const { error: dbError } = await supabase.from('reports').insert([{
        server_id: guildId,
        reporter_discord_id: interaction.user.id,
        reporter_roblox_username: null,
        reported_roblox_username: targetInput,
        reason: reason,
        status: 'PENDING'
    }]);

    if (dbError) {
        console.error('Report DB Error:', dbError);
        return interaction.editReply(`❌ Failed to submit report. Please try again later.`);
    }

    // 2. Send Notification to Channel (if configured)
    const { data: server } = await supabase
        .from('servers')
        .select('reports_channel_id, moderator_role_id')
        .eq('id', guildId)
        .single();

    if (server?.reports_channel_id) {
        console.log(`[REPORTS] Forwarding report to channel: ${server.reports_channel_id}`);
        const channel = await client.channels.fetch(server.reports_channel_id).catch(err => {
            console.error(`[REPORTS] Error fetching channel ${server.reports_channel_id}: ${err.message}`);
            return null;
        });

        if (channel && channel.isTextBased()) {
            const roleMention = server.moderator_role_id ? `<@&${server.moderator_role_id}>` : '';

            const embed = new EmbedBuilder()
                .setTitle('🚨 New User Report')
                .setColor('#ff4444')
                .addFields(
                    { name: 'Reported User', value: `\`${targetInput}\``, inline: true },
                    { name: 'Reporter', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setFooter({ text: `Ro-Link Systems • ID: ${guildId}` })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`discord_kick_${targetInput}`)
                        .setLabel('Kick (Discord)')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`discord_ban_${targetInput}`)
                        .setLabel('Ban (Discord)')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`switch_roblox_${targetInput}`)
                        .setLabel('Roblox Actions')
                        .setStyle(ButtonStyle.Primary)
                );

            await channel.send({ content: roleMention, embeds: [embed], components: [row] }).catch(err => {
                console.error(`[REPORTS] Error sending message to channel: ${err.message}`);
            });
        } else {
            console.error(`[REPORTS] Channel ${server.reports_channel_id} not found or not text-based.`);
        }
    } else {
        console.log(`[REPORTS] No reports channel configured for guild ${guildId}`);
    }

    await interaction.editReply(`✅ **Report Submitted!** The moderation team has been notified.`);
});

console.log('Attempting to log in to Discord...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('FAILED TO LOGIN:', err);
    if (err.rawError) {
        const decoder = new TextDecoder();
        const body = decoder.decode(err.rawError);
        console.error('--- ERROR BODY START ---');
        console.error(body);
        console.error('--- ERROR BODY END ---');
    }
});
