import { NextResponse } from 'next/server';

import { bumpModuleProjectRevision, ensureOwnedModuleProject, MODULE_PROJECT_FORMAT_VERSION, normalizeModuleProjectPath } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { trimModuleString } from '@/lib/modules';
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
        const expectedRevision = Number(body?.expectedRevision || 0);
        if (expectedRevision !== project.project.revision) return noStoreJson({ error: 'Project manifest changed after it was opened.', project }, { status: 409 });
        const rawManifest = body?.manifest && typeof body.manifest === 'object' ? body.manifest as Record<string, unknown> : {};
        const rawEntrypoints = rawManifest.entrypoints && typeof rawManifest.entrypoints === 'object' ? rawManifest.entrypoints as Record<string, unknown> : {};
        const manifest = {
            formatVersion: MODULE_PROJECT_FORMAT_VERSION,
            name: trimModuleString(rawManifest.name || project.module.name, 120),
            version: trimModuleString(rawManifest.version || project.module.version, 32),
            description: trimModuleString(rawManifest.description ?? project.module.description, 2000),
            requiredRuntimeVersion: trimModuleString(rawManifest.requiredRuntimeVersion || project.project.requiredRuntimeVersion, 32),
            entrypoints: {
                server: normalizeModuleProjectPath(rawEntrypoints.server) || undefined,
                client: normalizeModuleProjectPath(rawEntrypoints.client) || undefined,
            },
            capabilities: Array.isArray(rawManifest.capabilities) ? rawManifest.capabilities.map((value) => trimModuleString(value, 64)).filter(Boolean).slice(0, 64) : [],
            dependencies: rawManifest.dependencies && typeof rawManifest.dependencies === 'object' && !Array.isArray(rawManifest.dependencies) ? rawManifest.dependencies : {},
        };
        if (!manifest.name || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) return NextResponse.json({ error: 'Manifest requires a name and semantic version such as 1.0.0.' }, { status: 400 });
        const client = getSupabaseAdmin();
        const now = new Date().toISOString();
        const nextRevision = await bumpModuleProjectRevision(moduleId, expectedRevision);
        if (!nextRevision) return NextResponse.json({ error: 'Project changed while the manifest was being saved.' }, { status: 409 });
        const projectUpdate = await client.from('addon_module_projects').update({ manifest, required_runtime_version: manifest.requiredRuntimeVersion, updated_at: now }).eq('module_id', moduleId);
        if (projectUpdate.error) throw new Error(projectUpdate.error.message);
        const moduleUpdate = await client.from('addon_modules').update({ name: manifest.name, description: manifest.description, version: manifest.version, updated_at: now }).eq('id', moduleId).eq('author_discord_id', auth.discordUserId);
        if (moduleUpdate.error) throw new Error(moduleUpdate.error.message);
        const source = JSON.stringify(manifest, null, 2) + '\n';
        const manifestFile = project.files.find((file) => file.kind === 'manifest');
        if (manifestFile) {
            const fileUpdate = await client.from('addon_module_files').update({ source_code: source, revision: manifestFile.revision + 1, updated_at: now }).eq('id', manifestFile.id).eq('revision', manifestFile.revision);
            if (fileUpdate.error) throw new Error(fileUpdate.error.message);
        }
        return noStoreJson({ manifest, projectRevision: nextRevision });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save manifest.' }, { status: 500 });
    }
}
