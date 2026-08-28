import { NextResponse } from 'next/server';

import { canRestoreApprovedModuleVersion, getModulePackageServerSource } from '@/lib/moduleApprovedVersion';
import { ensureOwnedModuleProject } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { checksumModuleSource, parseModuleConfigSchema } from '@/lib/modules';
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
            .select('status, published_at, reviewed_at')
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId)
            .maybeSingle();

        if (moduleResult.error) throw new Error(moduleResult.error.message);
        if (!moduleResult.data) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

        const currentModule = moduleResult.data as { status?: string | null; published_at?: string | null; reviewed_at?: string | null };
        if (!['DRAFT', 'PUBLISHED'].includes(String(currentModule.status || ''))) {
            return NextResponse.json({ error: 'Finish the current Publish/Update review before changing marketplace visibility.' }, { status: 409 });
        }

        const publishedAt = currentModule.published_at || (currentModule.status === 'PUBLISHED' ? new Date().toISOString() : null);
        const reviewedAt = currentModule.reviewed_at || null;
        let approvedVersion: { version: string; package: unknown } | null = null;

        if (visibility === 'PUBLISHED') {
            if (!canRestoreApprovedModuleVersion({ status: currentModule.status, publishedAt, reviewedAt })) {
                return NextResponse.json({ error: 'Publish this module from the Module IDE and wait for approval before making it public.' }, { status: 409 });
            }

            const approvedVersionResult = await client
                .from('addon_module_versions')
                .select('version, package')
                .eq('module_id', moduleId)
                .lte('created_at', reviewedAt)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (approvedVersionResult.error) throw new Error(approvedVersionResult.error.message);
            if (!approvedVersionResult.data) {
                return NextResponse.json({ error: 'No approved module version is available. Use Publish/Update to submit the current version.' }, { status: 409 });
            }
            approvedVersion = approvedVersionResult.data as { version: string; package: unknown };
        }

        const status = visibility === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
        const approvedServerSource = approvedVersion ? getModulePackageServerSource(approvedVersion.package) : '';
        const updates: Record<string, unknown> = { status, published_at: publishedAt, updated_at: new Date().toISOString() };
        if (approvedVersion) {
            updates.version = approvedVersion.version;
            updates.source_code = approvedServerSource;
            updates.source_checksum = checksumModuleSource(approvedServerSource);
            updates.config_schema = parseModuleConfigSchema(approvedServerSource);
        }
        const updateResult = await client
            .from('addon_modules')
            .update(updates)
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId);

        if (updateResult.error) throw new Error(updateResult.error.message);

        if (visibility === 'PRIVATE') {
            const cleanupResult = await client.from('server_addon_modules').delete().eq('module_id', moduleId);
            if (cleanupResult.error) throw new Error(cleanupResult.error.message);
        }

        return noStoreJson({ status, visibility, publishedAt, approvedVersion: approvedVersion?.version || null });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update marketplace visibility.' }, { status: 500 });
    }
}
