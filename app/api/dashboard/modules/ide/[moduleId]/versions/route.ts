import { NextResponse } from 'next/server';

import { getOwnedModule } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ moduleId: string }> };

export async function GET(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const { moduleId } = await context.params;
    if (!await getOwnedModule(moduleId, auth.discordUserId)) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
    const { data, error } = await getSupabaseAdmin().from('addon_module_versions').select('id, version, project_revision, format_version, package_hash, created_at').eq('module_id', moduleId).order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return noStoreJson({ versions: data || [] });
}
