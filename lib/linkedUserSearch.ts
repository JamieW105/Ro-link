import type { SupabaseClient } from '@supabase/supabase-js';

export async function searchLinkedUsers(client: SupabaseClient, rawQuery: string) {
    const query = rawQuery.trim().replace(/^@/, '').slice(0, 80);
    if (query.length < 2 || !/^[a-zA-Z0-9_]+$/.test(query)) return [];
    const nameFilter = `roblox_username.ilike.%${query.replace(/_/g, '\\_')}%`;
    const filter = /^\d+$/.test(query)
        ? `${nameFilter},roblox_id.eq.${query},discord_id.eq.${query}` : nameFilter;
    const { data, error } = await client.from('verified_users')
        .select('discord_id, roblox_id, roblox_username')
        .or(filter)
        .order('roblox_username')
        .limit(20);
    if (error) throw new Error('Failed to search connected accounts.');
    return (data || []).flatMap((row) => row.discord_id && row.roblox_id && row.roblox_username ? [{
        username: String(row.roblox_username),
        displayName: String(row.roblox_username),
        userId: String(row.roblox_id),
        connectedDiscordId: String(row.discord_id),
        avatarUrl: null,
    }] : []);
}
