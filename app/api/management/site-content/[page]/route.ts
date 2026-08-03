import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { getSiteContent, sanitizeSiteContent, type SiteContentPage } from '@/lib/siteContent';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function validPage(value: string): value is SiteContentPage {
    return value === 'pricing' || value === 'features';
}

async function authorize() {
    const session = await getServerSession(authOptions);
    const userId = String((session?.user as { id?: unknown } | undefined)?.id ?? '');
    return userId && await hasPermission(userId, 'MANAGE_RO_LINK') ? userId : null;
}

export async function GET(_request: Request, context: { params: Promise<{ page: string }> }) {
    if (!await authorize()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { page } = await context.params;
    if (!validPage(page)) return NextResponse.json({ error: 'Unknown content page.' }, { status: 404 });
    return NextResponse.json(await getSiteContent(page));
}

export async function PUT(request: Request, context: { params: Promise<{ page: string }> }) {
    const userId = await authorize();
    if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { page } = await context.params;
    if (!validPage(page)) return NextResponse.json({ error: 'Unknown content page.' }, { status: 404 });

    const content = sanitizeSiteContent(page, await request.json().catch(() => ({})));
    if ('error' in content) return NextResponse.json({ error: content.error }, { status: 400 });

    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin().from('public_page_content').upsert({
        page,
        content,
        updated_by: userId,
        updated_at: now,
    }, { onConflict: 'page' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(content);
}
