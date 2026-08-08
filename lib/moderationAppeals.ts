import { listOwnedDiscordGuildIds, type DgsuBanTargetType } from './dgsuBans';
import { getSupabaseAdmin } from './supabaseAdmin';

export type ModerationAppealSource = 'DGSU_BAN' | 'STAFF_ACTION';

export type AppealModerationOption = {
    key: string;
    source: ModerationAppealSource;
    moderationId: string;
    targetType: DgsuBanTargetType;
    targetId: string;
    targetLabel: string;
    reason: string;
    moderatedAt: string | null;
    originalForumUrl: string | null;
};

export type AppealIdentity = {
    discordId: string;
    discordName: string | null;
    robloxId: string;
    robloxUsername: string | null;
};

type VerifiedUserRow = {
    discord_id: string;
    roblox_id: string | number;
    roblox_username: string | null;
};

type ServerRow = {
    id: string;
    place_id?: string | number | null;
    universe_id?: string | number | null;
};

type PublicReportRow = {
    id: string;
    discord_thread_id?: string | null;
    discord_thread_url?: string | null;
};

type DgsuAppealRow = {
    id: string;
    target_type: DgsuBanTargetType;
    target_id: string;
    reason?: string | null;
    source_public_report_id?: string | null;
    created_at?: string | null;
};

function trimString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
}

function targetTypeLabel(targetType: DgsuBanTargetType) {
    if (targetType === 'ROBLOX_USER') return 'Roblox user';
    if (targetType === 'DISCORD_USER') return 'Discord user';
    if (targetType === 'DISCORD_SERVER') return 'Discord server';
    return 'Roblox game';
}

function buildDiscordThreadUrl(threadId: unknown) {
    const normalizedThreadId = trimString(threadId, 80);
    if (!normalizedThreadId) return null;

    const guildId = trimString(
        process.env.DISCORD_GUILD_ID
        || process.env.DISCORD_SERVER_ID
        || process.env.SUPPORT_DISCORD_GUILD_ID,
        80,
    );
    return guildId
        ? `https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(normalizedThreadId)}`
        : `https://discord.com/channels/@me/${encodeURIComponent(normalizedThreadId)}`;
}

export async function collectAppealableModeration(input: {
    discordId: string;
    discordName?: string | null;
    discordAccessToken?: string | null;
}) {
    const client = getSupabaseAdmin();
    const discordId = trimString(input.discordId, 80);
    if (!discordId) {
        throw new Error('Unable to identify the signed-in Discord user.');
    }

    const { data: linkedAccount, error: linkedError } = await client
        .from('verified_users')
        .select('discord_id, roblox_id, roblox_username')
        .eq('discord_id', discordId)
        .maybeSingle();

    if (linkedError) {
        throw new Error(linkedError.message);
    }

    const verified = linkedAccount as VerifiedUserRow | null;
    const robloxId = trimString(verified?.roblox_id, 80);
    const identity: AppealIdentity = {
        discordId,
        discordName: trimString(input.discordName, 120) || null,
        robloxId,
        robloxUsername: trimString(verified?.roblox_username, 120) || null,
    };

    if (!robloxId) {
        return { identity, linked: false, options: [] as AppealModerationOption[] };
    }

    let ownedGuildIds: string[] = [];
    const accessToken = trimString(input.discordAccessToken, 4000);
    if (accessToken) {
        try {
            ownedGuildIds = await listOwnedDiscordGuildIds(accessToken);
        } catch (error) {
            console.warn('[Appeals] Failed to load Discord server ownership.', {
                discordId,
                error: error instanceof Error ? error.message : error,
            });
        }
    }

    let serverRows: ServerRow[] = [];
    if (ownedGuildIds.length > 0) {
        const { data, error } = await client
            .from('servers')
            .select('id, place_id, universe_id')
            .in('id', ownedGuildIds);
        if (error) throw new Error(error.message);
        serverRows = (data || []) as ServerRow[];
    }

    const targets = [
        { type: 'DISCORD_USER' as const, id: discordId },
        { type: 'ROBLOX_USER' as const, id: robloxId },
        ...ownedGuildIds.map((id) => ({ type: 'DISCORD_SERVER' as const, id })),
        ...serverRows.flatMap((server) => [
            { type: 'ROBLOX_GAME' as const, id: trimString(server.place_id, 80) },
            { type: 'ROBLOX_GAME' as const, id: trimString(server.universe_id, 80) },
        ]),
    ].filter((target) => target.id);

    const targetKeys = new Set(targets.map((target) => `${target.type}:${target.id}`));
    const targetTypes = uniqueStrings(targets.map((target) => target.type));
    const targetIds = uniqueStrings(targets.map((target) => target.id));

    const { data: dgsuData, error: dgsuError } = await client
        .from('dgsu_bans')
        .select('id, target_type, target_id, reason, source_public_report_id, created_at')
        .in('target_type', targetTypes)
        .in('target_id', targetIds)
        .order('created_at', { ascending: false });
    if (dgsuError) throw new Error(dgsuError.message);

    const dgsuRows = ((dgsuData || []) as DgsuAppealRow[]).filter((row) => (
        targetKeys.has(`${row.target_type}:${row.target_id}`)
    ));
    const reportIds = uniqueStrings(dgsuRows.map((row) => trimString(row.source_public_report_id, 80)));
    let reportRows: PublicReportRow[] = [];
    if (reportIds.length > 0) {
        const { data, error } = await client
            .from('public_reports')
            .select('id, discord_thread_id, discord_thread_url')
            .in('id', reportIds);
        if (error) throw new Error(error.message);
        reportRows = (data || []) as PublicReportRow[];
    }
    const reportById = new Map(reportRows.map((report) => [report.id, report]));

    const staffQueries = [
        client
            .from('staff_moderation_actions')
            .select('id, action_type, guild_id, guild_name, owner_id, reason, created_at, forum_thread_id')
            .eq('status', 'ACTIVE')
            .eq('owner_id', discordId),
    ];
    if (ownedGuildIds.length > 0) {
        staffQueries.push(
            client
                .from('staff_moderation_actions')
                .select('id, action_type, guild_id, guild_name, owner_id, reason, created_at, forum_thread_id')
                .eq('status', 'ACTIVE')
                .in('guild_id', ownedGuildIds),
        );
    }
    const staffResults = await Promise.all(staffQueries);
    const staffRows = new Map<string, Record<string, unknown>>();
    for (const result of staffResults) {
        if (result.error) throw new Error(result.error.message);
        for (const row of result.data || []) {
            staffRows.set(String(row.id), row);
        }
    }

    const options: AppealModerationOption[] = dgsuRows.map((row) => {
        const targetType = row.target_type as DgsuBanTargetType;
        const report = reportById.get(trimString(row.source_public_report_id, 80));
        return {
            key: `DGSU_BAN:${row.id}`,
            source: 'DGSU_BAN',
            moderationId: String(row.id),
            targetType,
            targetId: String(row.target_id),
            targetLabel: `${targetTypeLabel(targetType)} · ${row.target_id}`,
            reason: trimString(row.reason, 2000) || 'No moderation reason was recorded.',
            moderatedAt: trimString(row.created_at, 80) || null,
            originalForumUrl: trimString(report?.discord_thread_url, 500)
                || buildDiscordThreadUrl(report?.discord_thread_id),
        };
    });

    for (const row of staffRows.values()) {
        const guildId = trimString(row.guild_id, 80);
        const guildName = trimString(row.guild_name, 120);
        options.push({
            key: `STAFF_ACTION:${trimString(row.id, 80)}`,
            source: 'STAFF_ACTION',
            moderationId: trimString(row.id, 80),
            targetType: 'DISCORD_SERVER',
            targetId: guildId,
            targetLabel: `Discord server · ${guildName || guildId}`,
            reason: trimString(row.reason, 2000) || 'No moderation reason was recorded.',
            moderatedAt: trimString(row.created_at, 80) || null,
            originalForumUrl: buildDiscordThreadUrl(row.forum_thread_id),
        });
    }

    options.sort((a, b) => String(b.moderatedAt || '').localeCompare(String(a.moderatedAt || '')));
    return { identity, linked: true, options };
}
