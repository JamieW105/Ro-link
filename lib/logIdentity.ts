import type { SupabaseClient } from '@supabase/supabase-js';

type VerifiedUserRecord = {
    discord_id?: string | null;
    roblox_id?: string | null;
    roblox_username?: string | null;
};

type DiscordUserRecord = {
    id?: string;
    username?: string;
    global_name?: string | null;
};

type LogRecord = Record<string, unknown> & {
    target?: unknown;
    moderator?: unknown;
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function unique(values: string[]) {
    return Array.from(new Set(values.map(trimString).filter(Boolean)));
}

async function fetchVerifiedUsersByValues(client: SupabaseClient, values: string[]) {
    const identities = unique(values);
    if (identities.length === 0) {
        return [] as VerifiedUserRecord[];
    }

    const select = 'discord_id, roblox_id, roblox_username';
    const queries = await Promise.all([
        client.from('verified_users').select(select).in('discord_id', identities),
        client.from('verified_users').select(select).in('roblox_id', identities),
        client.from('verified_users').select(select).in('roblox_username', identities),
    ]);

    const rows = new Map<string, VerifiedUserRecord>();
    for (const result of queries) {
        if (result.error) {
            console.error('[Log Identity] Failed to resolve linked users:', result.error);
            continue;
        }

        for (const row of result.data || []) {
            const verified = row as VerifiedUserRecord;
            const key = trimString(verified.discord_id)
                || trimString(verified.roblox_id)
                || trimString(verified.roblox_username);
            if (key) {
                rows.set(key, verified);
            }
        }
    }

    return Array.from(rows.values());
}

function buildVerifiedUserLookup(rows: VerifiedUserRecord[]) {
    const lookup = new Map<string, VerifiedUserRecord>();

    for (const row of rows) {
        for (const value of [row.discord_id, row.roblox_id, row.roblox_username]) {
            const identity = trimString(value);
            if (identity) {
                lookup.set(identity.toLowerCase(), row);
            }
        }
    }

    return lookup;
}

async function fetchDiscordUsers(discordIds: string[]) {
    const ids = unique(discordIds);
    const users = new Map<string, DiscordUserRecord>();
    const botToken = process.env.DISCORD_TOKEN;

    if (!botToken || ids.length === 0) {
        return users;
    }

    await Promise.all(ids.map(async (id) => {
        try {
            const response = await fetch(`https://discord.com/api/v10/users/${encodeURIComponent(id)}`, {
                headers: { Authorization: `Bot ${botToken}` },
            });

            if (!response.ok) {
                return;
            }

            const user = await response.json() as DiscordUserRecord;
            if (user?.id) {
                users.set(user.id, user);
            }
        } catch (error) {
            console.error('[Log Identity] Failed to fetch Discord user:', error);
        }
    }));

    return users;
}

function formatDiscordUser(discordId: string, users: Map<string, DiscordUserRecord>) {
    const user = users.get(discordId);
    const username = trimString(user?.username);
    const displayName = trimString(user?.global_name);

    if (displayName && username && displayName.toLowerCase() !== username.toLowerCase()) {
        return `${displayName} (@${username})`;
    }

    return displayName || username || `Discord ${discordId}`;
}

function getLinkedIdentities(row: VerifiedUserRecord) {
    return unique([row.discord_id || '', row.roblox_id || '', row.roblox_username || '']);
}

export async function expandLinkedLogTargets(client: SupabaseClient, targets: string[]) {
    const verifiedUsers = await fetchVerifiedUsersByValues(client, targets);
    const expanded = new Set(unique(targets));

    for (const user of verifiedUsers) {
        for (const identity of getLinkedIdentities(user)) {
            expanded.add(identity);
        }
    }

    return Array.from(expanded);
}

export async function enrichLogRecordsWithLinkedUsers(client: SupabaseClient, logs: LogRecord[]) {
    if (logs.length === 0) {
        return logs;
    }

    const values = logs.flatMap((log) => [trimString(log.target), trimString(log.moderator)]);
    const verifiedUsers = await fetchVerifiedUsersByValues(client, values);
    const verifiedLookup = buildVerifiedUserLookup(verifiedUsers);
    const discordIds = verifiedUsers.map((row) => trimString(row.discord_id)).filter(Boolean);
    const discordUsers = await fetchDiscordUsers(discordIds);

    return logs.map((log) => {
        const targetValue = trimString(log.target);
        const moderatorValue = trimString(log.moderator);
        const targetUser = verifiedLookup.get(targetValue.toLowerCase());
        const moderatorUser = verifiedLookup.get(moderatorValue.toLowerCase());
        const targetDiscordId = trimString(targetUser?.discord_id);
        const moderatorDiscordId = trimString(moderatorUser?.discord_id);

        return {
            ...log,
            target_display: targetDiscordId ? formatDiscordUser(targetDiscordId, discordUsers) : undefined,
            target_identities: targetUser ? getLinkedIdentities(targetUser) : undefined,
            moderator_display: moderatorDiscordId ? formatDiscordUser(moderatorDiscordId, discordUsers) : undefined,
            moderator_identities: moderatorUser ? getLinkedIdentities(moderatorUser) : undefined,
        };
    });
}
