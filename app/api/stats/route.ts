import { NextResponse } from 'next/server';
import { coalesceRead } from '@/lib/coalesceRead';
import { excludeManagementLogs } from '@/lib/serverLogs';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabaseAdmin';

const STATS_TTL_MS = 15_000;

type SiteStats = {
    guild_count: number | null;
    command_count: number | null;
};

let cachedStats: { data: SiteStats; expiresAt: number } | undefined;

async function getGuildCount(): Promise<number | null> {
    const token = process.env.DISCORD_TOKEN?.trim();
    if (!token) return null;

    try {
        const response = await fetch('https://discord.com/api/v10/applications/@me', {
            headers: { Authorization: `Bot ${token}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) {
            console.warn(`[STATS] Discord guild count unavailable (HTTP ${response.status}). Check DISCORD_TOKEN.`);
            return null;
        }
        const app = await response.json();
        return typeof app.approximate_guild_count === 'number' ? app.approximate_guild_count : null;
    } catch {
        console.warn('[STATS] Discord guild count unavailable. Check Discord connectivity.');
        return null;
    }
}

async function getCommandCount(): Promise<number | null> {
    if (!isSupabaseConfigured()) return null;

    try {
        const { count, error } = await excludeManagementLogs(getSupabaseAdmin()
            .from('logs')
            .select('*', { count: 'exact', head: true }))
            .abortSignal(AbortSignal.timeout(5_000));
        if (error) {
            console.warn('[STATS] Command count unavailable. Check Supabase configuration and connectivity.');
            return null;
        }
        return count ?? null;
    } catch {
        console.warn('[STATS] Command count unavailable. Check Supabase configuration and connectivity.');
        return null;
    }
}

const loadStats = coalesceRead(async () => {
    const [guildCount, commandCount] = await Promise.all([getGuildCount(), getCommandCount()]);
    const data = { guild_count: guildCount, command_count: commandCount };

    if (guildCount !== null && commandCount !== null) {
        cachedStats = { data, expiresAt: Date.now() + STATS_TTL_MS };
    }

    return data;
});

export async function GET() {
    const current = cachedStats;
    const data = current && current.expiresAt > Date.now() ? current.data : await loadStats();
    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store' },
    });
}
