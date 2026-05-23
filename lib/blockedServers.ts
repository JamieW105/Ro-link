import type { PostgrestError } from '@supabase/supabase-js';

export type BlockedServerRecord = {
    guild_id: string;
    reason: string | null;
};

type MaybeSingleResult<T> = {
    data: T | null;
    error: PostgrestError | null;
};

type SupabaseClientLike = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                maybeSingle: <T>() => Promise<MaybeSingleResult<T>>;
            };
        };
    };
};

export async function findBlockedServer(client: unknown, guildId: unknown) {
    const normalizedGuildId = String(guildId ?? '').trim();
    if (!normalizedGuildId) {
        return null;
    }

    const { data, error } = await (client as SupabaseClientLike)
        .from('blocked_servers')
        .select('guild_id, reason')
        .eq('guild_id', normalizedGuildId)
        .maybeSingle<BlockedServerRecord>();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

export function getBlockedServerMessage(blocked: BlockedServerRecord | null) {
    const reason = String(blocked?.reason ?? '').trim();
    return reason
        ? `This server is blocked from using Ro-Link. Reason: ${reason}`
        : 'This server is blocked from using Ro-Link.';
}
