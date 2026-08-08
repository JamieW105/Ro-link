import { supabase } from './supabase';
import { findBlockedServer } from './blockedServers';
import { findDgsuBanForTargets } from './dgsuBans';
import { consumeRateLimit, getRateLimitBlock } from './rateLimit';

export type ServerKeyLookupResult<T> = {
    server: T | null;
    matchedBy: 'api_key' | 'open_cloud_key' | null;
    error: string | null;
};

const FAILED_KEY_RULE = {
    limit: 5,
    windowMs: 10 * 60_000,
    blockMs: 30 * 60_000,
};

function fingerprintKey(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function ensureSelectColumns(selectClause: string, requiredColumns: string[]) {
    const trimmedSelect = selectClause.trim();
    if (trimmedSelect === '*') {
        return selectClause;
    }

    const existingColumns = new Set(
        selectClause
            .split(',')
            .map((column) => column.trim())
            .filter(Boolean),
    );
    const missingColumns = requiredColumns.filter((column) => !existingColumns.has(column));
    return missingColumns.length > 0
        ? `${missingColumns.join(', ')}, ${selectClause}`
        : selectClause;
}

async function findDgsuBanForServerRecord(serverRecord: { id?: unknown; place_id?: unknown; universe_id?: unknown }) {
    const serverId = String(serverRecord.id ?? '').trim();
    const placeId = String(serverRecord.place_id ?? '').trim();
    const universeId = String(serverRecord.universe_id ?? '').trim();

    return findDgsuBanForTargets(supabase, [
        { type: 'DISCORD_SERVER', targetId: serverId },
        { type: 'ROBLOX_GAME', targetId: placeId },
        { type: 'ROBLOX_GAME', targetId: universeId },
    ]);
}

export async function findServerByKeyWithDiagnostics<T>(
    selectClause: string,
    rawKey: string,
): Promise<ServerKeyLookupResult<T>> {
    const apiKey = String(rawKey ?? '').trim();
    const failedKeyRateLimitKey = apiKey ? `server-auth:failed-key:${fingerprintKey(apiKey)}` : null;
    const selectWithId = ensureSelectColumns(selectClause, ['id', 'place_id', 'universe_id']);

    if (!apiKey) {
        return {
            server: null,
            matchedBy: null,
            error: 'empty_key',
        };
    }

    if (failedKeyRateLimitKey) {
        const blocked = getRateLimitBlock(failedKeyRateLimitKey);
        if (blocked) {
            return {
                server: null,
                matchedBy: null,
                error: 'server_key_rate_limited',
            };
        }
    }

    const primaryLookup = await supabase
        .from('servers')
        .select(selectWithId)
        .eq('api_key', apiKey)
        .maybeSingle<T & { id?: string }>();

    if (primaryLookup.data) {
        const serverId = (primaryLookup.data as { id?: unknown }).id;
        if (serverId && await findBlockedServer(supabase, serverId)) {
            return {
                server: null,
                matchedBy: 'api_key',
                error: 'server_blocked',
            };
        }

        if (await findDgsuBanForServerRecord(primaryLookup.data)) {
            return {
                server: null,
                matchedBy: 'api_key',
                error: 'dgsu_ban',
            };
        }

        return {
            server: primaryLookup.data,
            matchedBy: 'api_key',
            error: null,
        };
    }

    if (primaryLookup.error) {
        console.warn('[RoLinkAPI][Auth] api_key lookup failed', {
            code: primaryLookup.error.code,
            message: primaryLookup.error.message,
        });
    }

    const fallbackLookup = await supabase
        .from('servers')
        .select(selectWithId)
        .eq('open_cloud_key', apiKey)
        .maybeSingle<T & { id?: string }>();

    if (fallbackLookup.data) {
        const serverId = (fallbackLookup.data as { id?: unknown }).id;
        if (serverId && await findBlockedServer(supabase, serverId)) {
            return {
                server: null,
                matchedBy: 'open_cloud_key',
                error: 'server_blocked',
            };
        }

        if (await findDgsuBanForServerRecord(fallbackLookup.data)) {
            return {
                server: null,
                matchedBy: 'open_cloud_key',
                error: 'dgsu_ban',
            };
        }

        return {
            server: fallbackLookup.data,
            matchedBy: 'open_cloud_key',
            error: null,
        };
    }

    if (fallbackLookup.error) {
        console.warn('[RoLinkAPI][Auth] open_cloud_key lookup failed', {
            code: fallbackLookup.error.code,
            message: fallbackLookup.error.message,
        });
    }

    if (!primaryLookup.error && !fallbackLookup.error && failedKeyRateLimitKey) {
        const failedKeyRateLimit = consumeRateLimit(failedKeyRateLimitKey, FAILED_KEY_RULE);
        if (!failedKeyRateLimit.allowed) {
            return {
                server: null,
                matchedBy: null,
                error: 'server_key_rate_limited',
            };
        }
    }

    return {
        server: null,
        matchedBy: null,
        error: primaryLookup.error?.message || fallbackLookup.error?.message || 'no_matching_server_key',
    };
}

export async function findServerByKey<T>(selectClause: string, rawKey: string) {
    const lookup = await findServerByKeyWithDiagnostics<T>(selectClause, rawKey);
    return lookup.server;
}
