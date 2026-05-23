import { supabase } from './supabase';
import { findBlockedServer } from './blockedServers';

export type ServerKeyLookupResult<T> = {
    server: T | null;
    matchedBy: 'api_key' | 'open_cloud_key' | null;
    error: string | null;
};

export async function findServerByKeyWithDiagnostics<T>(
    selectClause: string,
    rawKey: string,
): Promise<ServerKeyLookupResult<T>> {
    const apiKey = String(rawKey ?? '').trim();
    const selectWithId = selectClause
        .split(',')
        .some((column) => column.trim() === 'id')
        ? selectClause
        : `id, ${selectClause}`;

    if (!apiKey) {
        return {
            server: null,
            matchedBy: null,
            error: 'empty_key',
        };
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
