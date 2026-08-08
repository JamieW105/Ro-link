import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { normalizeSiteBanner, sanitizeSiteBannerInput } from '@/lib/siteBanners';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function authorized() {
    const session = await getServerSession(authOptions);
    const userId = String((session?.user as { id?: unknown } | undefined)?.id ?? '');
    return Boolean(userId && await hasPermission(userId, 'MANAGE_RO_LINK'));
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    if (!await authorized()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sanitized = sanitizeSiteBannerInput(await request.json().catch(() => ({})));
    if ('error' in sanitized) return NextResponse.json({ error: sanitized.error }, { status: 400 });

    const { id } = await context.params;
    const { data, error } = await getSupabaseAdmin()
        .from('site_banners')
        .update({ ...sanitized, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(normalizeSiteBanner(data as Record<string, unknown>));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
    if (!await authorized()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await context.params;
    const { error } = await getSupabaseAdmin().from('site_banners').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
