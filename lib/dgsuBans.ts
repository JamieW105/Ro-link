import { DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from './dgsuBanConstants';

export { DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS };

export type DgsuBanTargetType = 'DISCORD_USER' | 'ROBLOX_USER' | 'DISCORD_SERVER' | 'ROBLOX_GAME';

export type DgsuBanTarget = {
    type: DgsuBanTargetType;
    targetId: unknown;
};

export type DgsuBanRecord = {
    id: string;
    target_type: DgsuBanTargetType;
    target_id: string;
    reason?: string | null;
    source_public_report_id?: string | null;
    banned_by?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type DgsuGameBanCheckResult = {
    ban: DgsuBanRecord | null;
    placeId: string;
    universeId: string;
};

type VerifiedUserRecord = {
    discord_id?: string | null;
    roblox_id?: string | number | null;
    roblox_username?: string | null;
};

type DgsuPostgrestError = {
    code?: string;
    message: string;
};

type DgsuQueryResult<T = unknown> = {
    data: T | null;
    error: DgsuPostgrestError | null;
};

type DgsuQueryBuilder = PromiseLike<DgsuQueryResult> & {
    eq: (column: string, value: unknown) => DgsuQueryBuilder;
    in: (column: string, values: unknown[]) => DgsuQueryBuilder;
    order: (column: string, options?: { ascending?: boolean }) => DgsuQueryBuilder;
    maybeSingle: <T = unknown>() => Promise<DgsuQueryResult<T>>;
};

type DgsuFromBuilder = {
    select: (columns: string) => DgsuQueryBuilder;
    upsert: (rows: unknown, options?: { onConflict?: string }) => Promise<DgsuQueryResult>;
};

type SupabaseClientLike = {
    from: (table: string) => DgsuFromBuilder;
};

const DGSU_BAN_SELECT = 'id, target_type, target_id, reason, source_public_report_id, banned_by, metadata, created_at, updated_at';
const DGSU_GAME_ATTEMPT_REASON = 'Automatically banned after attempting to connect a Roblox game with an existing DGSU ban.';

let warnedMissingDgsuBansTable = false;

function trimString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTarget(target: DgsuBanTarget) {
    const targetId = trimString(target.targetId, 120);
    if (!target.type || !targetId) {
        return null;
    }

    return {
        type: target.type,
        targetId,
        key: `${target.type}:${targetId}`,
    };
}

function asDgsuClient(client: unknown) {
    return client as SupabaseClientLike;
}

function isMissingDgsuBansTable(error: { code?: string; message?: string } | null | undefined) {
    return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST204';
}

function handleDgsuBanLookupError(error: { code?: string; message?: string } | null, context: string) {
    if (!error) {
        return false;
    }

    if (isMissingDgsuBansTable(error)) {
        if (!warnedMissingDgsuBansTable) {
            warnedMissingDgsuBansTable = true;
            console.warn('[DGSU] dgsu_bans table is missing; DGSU ban enforcement is inactive until the schema is migrated.', {
                code: error.code,
                message: error.message,
            });
        }
        return true;
    }

    console.warn(`[DGSU] ${context} failed.`, {
        code: error.code,
        message: error.message,
    });
    return false;
}

async function findLinkedRobloxUser(client: unknown, discordUserId: string) {
    const normalizedDiscordUserId = trimString(discordUserId, 80);
    if (!normalizedDiscordUserId) {
        return null;
    }

    const db = asDgsuClient(client);
    const { data, error } = await db
        .from('verified_users')
        .select('discord_id, roblox_id, roblox_username')
        .eq('discord_id', normalizedDiscordUserId)
        .maybeSingle<VerifiedUserRecord>();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

export async function findDgsuBanForTargets(client: unknown, rawTargets: DgsuBanTarget[]) {
    const targets = rawTargets
        .map(normalizeTarget)
        .filter((target): target is NonNullable<ReturnType<typeof normalizeTarget>> => Boolean(target));

    if (targets.length === 0) {
        return null;
    }

    const targetKeys = new Set(targets.map((target) => target.key));
    const targetTypes = uniqueStrings(targets.map((target) => target.type));
    const targetIds = uniqueStrings(targets.map((target) => target.targetId));

    const db = asDgsuClient(client);
    const { data, error } = await db
        .from('dgsu_bans')
        .select(DGSU_BAN_SELECT)
        .in('target_type', targetTypes)
        .in('target_id', targetIds)
        .order('created_at', { ascending: false });

    if (error) {
        if (handleDgsuBanLookupError(error, 'DGSU ban lookup')) {
            return null;
        }
        throw new Error(error.message);
    }

    const rows = (data || []) as DgsuBanRecord[];
    return rows.find((row) => targetKeys.has(`${row.target_type}:${row.target_id}`)) || null;
}

export async function findDgsuBanForUser(client: unknown, input: {
    discordUserId?: unknown;
    robloxUserId?: unknown;
    ownedDiscordServerIds?: unknown[];
}) {
    const discordUserId = trimString(input.discordUserId, 80);
    let robloxUserId = trimString(input.robloxUserId, 80);
    const targets: DgsuBanTarget[] = [];

    if (discordUserId) {
        targets.push({ type: 'DISCORD_USER', targetId: discordUserId });
    }

    if (!robloxUserId && discordUserId) {
        const verifiedUser = await findLinkedRobloxUser(client, discordUserId);
        robloxUserId = trimString(verifiedUser?.roblox_id, 80);
    }

    if (robloxUserId) {
        targets.push({ type: 'ROBLOX_USER', targetId: robloxUserId });
    }

    for (const serverId of input.ownedDiscordServerIds || []) {
        const normalizedServerId = trimString(serverId, 80);
        if (normalizedServerId) {
            targets.push({ type: 'DISCORD_SERVER', targetId: normalizedServerId });
        }
    }

    return findDgsuBanForTargets(client, targets);
}

export async function listOwnedDiscordGuildIds(accessToken: string) {
    const token = trimString(accessToken, 4000);
    if (!token) {
        return [];
    }

    const guildIds: string[] = [];
    let after = '0';

    while (true) {
        const response = await fetch(`https://discord.com/api/users/@me/guilds?after=${encodeURIComponent(after)}&limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch owned Discord guilds (${response.status}).`);
        }

        const payload = await response.json().catch(() => null) as Array<{ id?: string; owner?: boolean }> | null;
        if (!Array.isArray(payload) || payload.length === 0) {
            break;
        }

        for (const guild of payload) {
            if (guild?.owner && guild.id) {
                guildIds.push(guild.id);
            }
        }

        const lastGuildId = payload[payload.length - 1]?.id;
        if (!lastGuildId || payload.length < 100) {
            break;
        }
        after = lastGuildId;
    }

    return uniqueStrings(guildIds);
}

export async function findDgsuBanForDiscordLogin(client: unknown, input: {
    discordUserId: unknown;
    discordAccessToken?: unknown;
}) {
    const discordUserId = trimString(input.discordUserId, 80);
    if (!discordUserId) {
        return null;
    }

    let ownedDiscordServerIds: string[] = [];
    const accessToken = trimString(input.discordAccessToken, 4000);
    if (accessToken) {
        try {
            ownedDiscordServerIds = await listOwnedDiscordGuildIds(accessToken);
        } catch (error) {
            console.warn('[DGSU] Failed to load owned Discord guilds during login DGSU check.', {
                discordUserId,
                error: error instanceof Error ? error.message : error,
            });
        }
    }

    return findDgsuBanForUser(client, {
        discordUserId,
        ownedDiscordServerIds,
    });
}

async function resolveUniverseIdForPlace(placeId: string) {
    const normalizedPlaceId = trimString(placeId, 80);
    if (!normalizedPlaceId) {
        return '';
    }

    try {
        const response = await fetch(
            `https://apis.roblox.com/universes/v1/places/${encodeURIComponent(normalizedPlaceId)}/universe`,
            { cache: 'no-store' },
        );
        if (!response.ok) {
            return '';
        }

        const payload = await response.json().catch(() => null) as { universeId?: string | number } | null;
        return trimString(payload?.universeId, 80);
    } catch (error) {
        console.warn('[DGSU] Failed to resolve Roblox universe for place.', {
            placeId: normalizedPlaceId,
            error: error instanceof Error ? error.message : error,
        });
        return '';
    }
}

export async function findDgsuBanForRobloxGame(client: unknown, input: {
    placeId?: unknown;
    universeId?: unknown;
}): Promise<DgsuGameBanCheckResult> {
    const placeId = trimString(input.placeId, 80);
    let universeId = trimString(input.universeId, 80);
    const initialTargets: DgsuBanTarget[] = [];

    if (placeId) {
        initialTargets.push({ type: 'ROBLOX_GAME', targetId: placeId });
    }
    if (universeId) {
        initialTargets.push({ type: 'ROBLOX_GAME', targetId: universeId });
    }

    let ban = await findDgsuBanForTargets(client, initialTargets);
    if (!ban && placeId) {
        const resolvedUniverseId = await resolveUniverseIdForPlace(placeId);
        if (resolvedUniverseId) {
            universeId = resolvedUniverseId;
            ban = await findDgsuBanForTargets(client, [
                { type: 'ROBLOX_GAME', targetId: resolvedUniverseId },
            ]);
        }
    }

    return { ban, placeId, universeId };
}

export async function banUserForDgsuAssociation(client: unknown, input: {
    discordUserId?: unknown;
    robloxUserId?: unknown;
    reason: string;
    sourceBan?: DgsuBanRecord | null;
    metadata?: Record<string, unknown>;
}) {
    const discordUserId = trimString(input.discordUserId, 80);
    let robloxUserId = trimString(input.robloxUserId, 80);

    if (!robloxUserId && discordUserId) {
        const linkedUser = await findLinkedRobloxUser(client, discordUserId);
        robloxUserId = trimString(linkedUser?.roblox_id, 80);
    }

    const now = new Date().toISOString();
    const sourcePublicReportId = trimString(input.sourceBan?.source_public_report_id, 80) || null;
    const rows: Array<Record<string, unknown>> = [];
    const metadata = {
        ...(input.metadata || {}),
        sourceDgsuBanId: input.sourceBan?.id || null,
        sourceTargetType: input.sourceBan?.target_type || null,
        sourceTargetId: input.sourceBan?.target_id || null,
    };

    if (discordUserId) {
        rows.push({
            target_type: 'DISCORD_USER',
            target_id: discordUserId,
            reason: input.reason,
            source_public_report_id: sourcePublicReportId,
            banned_by: 'system:dgsu-association',
            metadata,
            updated_at: now,
        });
    }

    if (robloxUserId) {
        rows.push({
            target_type: 'ROBLOX_USER',
            target_id: robloxUserId,
            reason: input.reason,
            source_public_report_id: sourcePublicReportId,
            banned_by: 'system:dgsu-association',
            metadata,
            updated_at: now,
        });
    }

    if (rows.length === 0) {
        return;
    }

    const db = asDgsuClient(client);
    const { error } = await db
        .from('dgsu_bans')
        .upsert(rows, { onConflict: 'target_type,target_id' });

    if (error) {
        if (handleDgsuBanLookupError(error, 'DGSU user ban upsert')) {
            throw new Error('DGSU ban enforcement schema is missing.');
        }
        throw new Error(error.message);
    }
}

export async function banUserForDgsuGameAttempt(client: unknown, input: {
    discordUserId?: unknown;
    robloxUserId?: unknown;
    serverId?: unknown;
    placeId?: unknown;
    universeId?: unknown;
    sourceBan: DgsuBanRecord;
}) {
    const placeId = trimString(input.placeId, 80);
    const universeId = trimString(input.universeId, 80);

    await banUserForDgsuAssociation(client, {
        discordUserId: input.discordUserId,
        robloxUserId: input.robloxUserId,
        sourceBan: input.sourceBan,
        reason: DGSU_GAME_ATTEMPT_REASON,
        metadata: {
            trigger: 'banned_game_connection_attempt',
            serverId: trimString(input.serverId, 80) || null,
            placeId: placeId || null,
            universeId: universeId || null,
        },
    });
}
