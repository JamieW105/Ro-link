import { NextResponse } from 'next/server';

import { coalesceRead } from '@/lib/coalesceRead';
import { normalizeSiteBanner } from '@/lib/siteBanners';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const loadActiveBanners = coalesceRead(async () => {
    if (!isSupabaseConfigured()) return [];

    try {
        const now = new Date().toISOString();
        const { data, error } = await getSupabaseAdmin()
            .from('site_banners')
            .select('*')
            .eq('enabled', true)
            .or(`starts_at.is.null,starts_at.lte.${now}`)
            .or(`ends_at.is.null,ends_at.gt.${now}`)
            .order('created_at', { ascending: false })
            .abortSignal(AbortSignal.timeout(5_000));

        if (error) {
            console.warn('[Site Banners] Banners unavailable. Check Supabase configuration and connectivity.');
            return [];
        }
        return (data || [])
            .map((row: Record<string, unknown>) => normalizeSiteBanner(row))
            .filter(Boolean);
    } catch {
        console.warn('[Site Banners] Banners unavailable. Check Supabase configuration and connectivity.');
        return [];
    }
});

export async function GET() {
    return NextResponse.json(await loadActiveBanners(), {
        headers: { 'Cache-Control': 'no-store' },
    });
}
