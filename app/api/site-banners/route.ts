import { NextResponse } from 'next/server';

import { normalizeSiteBanner } from '@/lib/siteBanners';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin()
        .from('site_banners')
        .select('*')
        .eq('enabled', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Site Banners] Failed to load active banners:', error.message);
        return NextResponse.json([]);
    }

    return NextResponse.json(
        (data || [])
            .map((row: Record<string, unknown>) => normalizeSiteBanner(row))
            .filter(Boolean),
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
