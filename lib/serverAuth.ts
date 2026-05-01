import { supabase } from './supabase';

export async function findServerByKey<T>(selectClause: string, rawKey: string) {
    const apiKey = String(rawKey ?? '').trim();
    if (!apiKey) {
        return null;
    }

    const primaryLookup = await supabase
        .from('servers')
        .select(selectClause)
        .eq('api_key', apiKey)
        .maybeSingle<T>();

    if (primaryLookup.data) {
        return primaryLookup.data;
    }

    const fallbackLookup = await supabase
        .from('servers')
        .select(selectClause)
        .eq('open_cloud_key', apiKey)
        .maybeSingle<T>();

    return fallbackLookup.data ?? null;
}
