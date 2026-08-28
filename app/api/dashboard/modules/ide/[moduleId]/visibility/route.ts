import { NextResponse } from 'next/server';

import { ensureOwnedModuleProject } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ moduleId: string }> };

export async function PATCH(req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;

    const { moduleId } = await context.params;
    try {
        const project = await ensureOwnedModuleProject(moduleId, auth.discordUserId);
        if (!project) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        const visibility = String(body?.visibility || '').trim().toUpperCase();
        if (visibility !== 'PRIVATE' && visibility !== 'PUBLISHED') {
            return NextResponse.json({ error: 'Visibility must be Private or Published.' }, { status: 400 });
        }

        const client = getSupabaseAdmin();
        const moduleResult = await client
            .from('addon_modules')
            .select('status, published_at')
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId)
            .maybeSingle();

        if (moduleResult.error) throw new Error(moduleResult.error.message);
        if (!moduleResult.data) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

        const currentModule = moduleResult.data as { status?: string | null; published_at?: string | null };
        const wasPublished = currentModule.status === 'PUBLISHED' || Boolean(currentModule.published_at);
        if (visibility === 'PUBLISHED' && !wasPublished) {
            return NextResponse.json({ error: 'Publish this module from the Module IDE before making it public.' }, { status: 409 });
        }

        const status = visibility === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
        const publishedAt = currentModule.published_at || (currentModule.status === 'PUBLISHED' ? new Date().toISOString() : null);
        const updateResult = await client
            .from('addon_modules')
            .update({ status, published_at: publishedAt, updated_at: new Date().toISOString() })
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId);

        if (updateResult.error) throw new Error(updateResult.error.message);

        if (visibility === 'PRIVATE') {
            const cleanupResult = await client.from('server_addon_modules').delete().eq('module_id', moduleId);
            if (cleanupResult.error) throw new Error(cleanupResult.error.message);
        }

        return noStoreJson({ status, visibility, publishedAt });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update marketplace visibility.' }, { status: 500 });
    }
}
