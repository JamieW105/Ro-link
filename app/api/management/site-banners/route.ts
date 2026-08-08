import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { normalizeSiteBanner, sanitizeSiteBannerInput } from '@/lib/siteBanners';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function authorize() {
    const session = await getServerSession(authOptions);
    const userId = String((session?.user as { id?: unknown } | undefined)?.id ?? '');
    return userId && await hasPermission(userId, 'MANAGE_RO_LINK') ? userId : null;
}

export async function GET() {
    if (!await authorize()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await getSupabaseAdmin()
        .from('site_banners')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data || []).map((row: Record<string, unknown>) => normalizeSiteBanner(row)).filter(Boolean));
}

export async function POST(request: Request) {
    const userId = await authorize();
    if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sanitized = sanitizeSiteBannerInput(await request.json().catch(() => ({})));
    if ('error' in sanitized) return NextResponse.json({ error: sanitized.error }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
        .from('site_banners')
        .insert({ ...sanitized, created_by: userId })
        .select('*')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(normalizeSiteBanner(data as Record<string, unknown>), { status: 201 });
}
