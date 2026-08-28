import { NextResponse } from 'next/server';

import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { checksumModuleSource, slugifyModuleName, trimModuleString } from '@/lib/modules';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function uniqueSlug(seed: string) {
    const client = getSupabaseAdmin();
    const base = slugifyModuleName(seed);
    let slug = base;
    let suffix = 2;
    while (true) {
        const { data, error } = await client.from('addon_modules').select('id').eq('slug', slug).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return slug;
        slug = `${base}-${suffix}`;
        suffix += 1;
    }
}
export async function GET() {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('addon_modules')
        .select('id, slug, name, description, thumbnail_url, thumbnail_urls, version, status, created_at, updated_at, published_at')
        .eq('author_discord_id', auth.discordUserId)
        .neq('status', 'ARCHIVED')
        .order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return noStoreJson({ modules: data || [] });
}

export async function POST(req: Request) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const body = await req.json().catch(() => null) as { name?: string; description?: string } | null;
    const name = trimModuleString(body?.name, 120);
    if (!name) return NextResponse.json({ error: 'Module name is required.' }, { status: 400 });
    const description = trimModuleString(body?.description, 2000);
    const source = `return {\n    Init = function(context, settings)\n        context.Log("${name.replace(/["\\]/g, '')} loaded")\n    end,\n}\n`;
    const client = getSupabaseAdmin();
    const slug = await uniqueSlug(name);
    const { data, error } = await client.from('addon_modules').insert({
        slug,
        name,
        description,
        version: '1.0.0',
        category: 'General',
        status: 'DRAFT',
        source_code: source,
        source_checksum: checksumModuleSource(source),
        config_schema: {},
        author_discord_id: auth.discordUserId,
    }).select('id, slug, name, description, thumbnail_url, thumbnail_urls, version, status, created_at, updated_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return noStoreJson({ module: data }, { status: 201 });
}
