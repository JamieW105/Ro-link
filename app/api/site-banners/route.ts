import { NextResponse } from 'next/server';

import { normalizeSiteBanner } from '@/lib/siteBanners';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const headers = { 'Cache-Control': 'no-store' };
    if (!isSupabaseConfigured()) return NextResponse.json([], { headers });

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
            return NextResponse.json([], { headers });
        }
        return NextResponse.json(
            (data || [])
                .map((row: Record<string, unknown>) => normalizeSiteBanner(row))
                .filter(Boolean),
            { headers },
        );
    } catch {
        console.warn('[Site Banners] Banners unavailable. Check Supabase configuration and connectivity.');
        return NextResponse.json([], { headers });
    }
}
