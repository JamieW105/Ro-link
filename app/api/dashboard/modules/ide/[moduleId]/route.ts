import { NextResponse } from 'next/server';

import { ensureOwnedModuleProject, getOwnedModule } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { isModuleIdeVisibleFile } from '@/lib/moduleFileRules';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ moduleId: string }> };

const THUMBNAIL_BUCKET = 'module-thumbnails';

function getStoredThumbnailPath(thumbnailUrl: string) {
    const marker = `/storage/v1/object/public/${THUMBNAIL_BUCKET}/`;
    const markerIndex = thumbnailUrl.indexOf(marker);
    if (markerIndex === -1) return '';
    try {
        return decodeURIComponent(thumbnailUrl.slice(markerIndex + marker.length).split('?')[0]);
    } catch {
        return '';
    }
}

export async function GET(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    try {
        const { moduleId } = await context.params;
        const project = await ensureOwnedModuleProject(moduleId, auth.discordUserId);
        if (!project) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        return noStoreJson({ ...project, files: project.files.filter(isModuleIdeVisibleFile) });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load module project.' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;

    try {
        const { moduleId } = await context.params;
        const ownedModule = await getOwnedModule(moduleId, auth.discordUserId);
        if (!ownedModule) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

        const client = getSupabaseAdmin();
        const { error } = await client
            .from('addon_modules')
            .delete()
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId);
        if (error) throw new Error(error.message);

        const thumbnailUrls = Array.isArray(ownedModule.thumbnail_urls)
            ? ownedModule.thumbnail_urls.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        if (thumbnailUrls.length === 0 && ownedModule.thumbnail_url) thumbnailUrls.push(ownedModule.thumbnail_url);
        const thumbnailPaths = [...new Set(thumbnailUrls.map(getStoredThumbnailPath).filter(Boolean))];
        if (thumbnailPaths.length) {
            // The database deletion is authoritative. Storage cleanup is best-effort
            // so a transient object-store failure cannot make a deleted module appear to fail.
            await client.storage.from(THUMBNAIL_BUCKET).remove(thumbnailPaths);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete module.' }, { status: 500 });
    }
}
