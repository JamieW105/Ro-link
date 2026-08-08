import { NextResponse } from 'next/server';

import { bumpModuleProjectRevision, ensureOwnedModuleProject, isModuleFileKind, MAX_MODULE_FILE_BYTES, MAX_MODULE_FILES, normalizeModuleProjectPath } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ moduleId: string }> };

function fileName(path: string) {
    return path.split('/').at(-1) || path;
}

function parentPath(path: string) {
    return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function hasParentFolder(files: Array<{ path: string; kind: string }>, path: string) {
    const parent = parentPath(path);
    return !parent || files.some((file) => file.path === parent && file.kind === 'folder');
}

export async function POST(req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const { moduleId } = await context.params;
    try {
        const project = await ensureOwnedModuleProject(moduleId, auth.discordUserId);
        if (!project) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        const action = String(body?.action || '');
        const client = getSupabaseAdmin();

        if (action === 'create') {
            const path = normalizeModuleProjectPath(body?.path);
            const kind = body?.kind;
            if (!path || !isModuleFileKind(kind)) return NextResponse.json({ error: 'A valid path and file kind are required.' }, { status: 400 });
            if (project.files.length >= MAX_MODULE_FILES) return NextResponse.json({ error: `Projects are limited to ${MAX_MODULE_FILES} files and folders.` }, { status: 400 });
            if (kind === 'manifest' || path === 'module.json') return NextResponse.json({ error: 'The project manifest already exists and must be edited through module.json.' }, { status: 400 });
            if (!hasParentFolder(project.files, path)) return NextResponse.json({ error: 'Create the destination folder before adding this file.' }, { status: 400 });
            if (kind === 'ui' && !path.startsWith('UI/')) return NextResponse.json({ error: 'Imported UI must be stored under UI/.' }, { status: 400 });
            const sourceCode = typeof body?.sourceCode === 'string' ? body.sourceCode : null;
            if (sourceCode && Buffer.byteLength(sourceCode, 'utf8') > MAX_MODULE_FILE_BYTES) return NextResponse.json({ error: 'Files are limited to 1 MB.' }, { status: 413 });
            const { data, error } = await client.from('addon_module_files').insert({
                module_id: moduleId,
                path,
                name: fileName(path),
                kind,
                source_code: kind === 'folder' || kind === 'ui' ? null : sourceCode || '',
                ui_tree: kind === 'ui' ? body?.uiTree || {} : null,
            }).select('*').single();
            if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 400 });
            const revision = await bumpModuleProjectRevision(moduleId);
            return noStoreJson({ file: data, projectRevision: revision }, { status: 201 });
        }

        if (action === 'update') {
            const id = String(body?.id || '');
            const expectedRevision = Number(body?.expectedRevision || 0);
            if (!id || !Number.isFinite(expectedRevision) || expectedRevision < 1) return NextResponse.json({ error: 'File id and expected revision are required.' }, { status: 400 });
            const { data: current, error: currentError } = await client.from('addon_module_files').select('*').eq('id', id).eq('module_id', moduleId).maybeSingle();
            if (currentError) throw new Error(currentError.message);
            if (!current) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
            if (current.kind === 'folder' || current.kind === 'ui' || current.kind === 'manifest') return NextResponse.json({ error: 'That file type cannot be updated through the source endpoint.' }, { status: 400 });
            if (Number(current.revision) !== expectedRevision) return noStoreJson({ error: 'File changed after it was opened.', conflict: current }, { status: 409 });
            const sourceCode = typeof body?.sourceCode === 'string' ? body.sourceCode : current.source_code;
            if (typeof sourceCode === 'string' && Buffer.byteLength(sourceCode, 'utf8') > MAX_MODULE_FILE_BYTES) return NextResponse.json({ error: 'Files are limited to 1 MB.' }, { status: 413 });
            const nextRevision = expectedRevision + 1;
            const { data, error } = await client.from('addon_module_files').update({
                source_code: sourceCode,
                ui_tree: body?.uiTree ?? current.ui_tree,
                revision: nextRevision,
                updated_at: new Date().toISOString(),
            }).eq('id', id).eq('module_id', moduleId).eq('revision', expectedRevision).select('*').maybeSingle();
            if (error) throw new Error(error.message);
            if (!data) return NextResponse.json({ error: 'File changed while it was being saved.' }, { status: 409 });
            const projectRevision = await bumpModuleProjectRevision(moduleId);
            return noStoreJson({ file: data, projectRevision });
        }

        if (action === 'delete') {
            const path = normalizeModuleProjectPath(body?.path);
            if (!path || ['Server', 'Client', 'Shared', 'UI', 'module.json'].includes(path)) return NextResponse.json({ error: 'That project root cannot be deleted.' }, { status: 400 });
            const ids = project.files.filter((file) => file.path === path || file.path.startsWith(`${path}/`)).map((file) => file.id);
            if (!ids.length) return NextResponse.json({ error: 'File or folder not found.' }, { status: 404 });
            const { error } = await client.from('addon_module_files').delete().eq('module_id', moduleId).in('id', ids);
            if (error) throw new Error(error.message);
            const revision = await bumpModuleProjectRevision(moduleId);
            return noStoreJson({ success: true, projectRevision: revision });
        }

        if (action === 'move' || action === 'rename') {
            const id = String(body?.id || '');
            const targetPath = normalizeModuleProjectPath(body?.path);
            if (!id || !targetPath) return NextResponse.json({ error: 'File id and destination path are required.' }, { status: 400 });
            const { data: current, error: currentError } = await client.from('addon_module_files').select('*').eq('id', id).eq('module_id', moduleId).maybeSingle();
            if (currentError) throw new Error(currentError.message);
            if (!current) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
            const currentPath = String(current.path || '');
            if (['Server', 'Client', 'Shared', 'UI', 'module.json'].includes(currentPath)) return NextResponse.json({ error: 'Project roots cannot be moved or renamed.' }, { status: 400 });
            if (targetPath === currentPath || targetPath.startsWith(`${currentPath}/`)) return NextResponse.json({ error: 'A folder cannot be moved inside itself.' }, { status: 400 });
            const subtreeIds = new Set(project.files.filter((file) => file.path === currentPath || file.path.startsWith(`${currentPath}/`)).map((file) => file.id));
            if (!hasParentFolder(project.files.filter((file) => !subtreeIds.has(file.id)), targetPath)) return NextResponse.json({ error: 'The destination parent folder does not exist.' }, { status: 400 });
            const { data: collision, error: collisionError } = await client.from('addon_module_files').select('id').eq('module_id', moduleId).eq('path', targetPath).maybeSingle();
            if (collisionError) throw new Error(collisionError.message);
            if (collision) return NextResponse.json({ error: 'A file or folder already exists at that path.' }, { status: 409 });

            const descendants = project.files.filter((file) => file.path.startsWith(`${currentPath}/`));
            const changes = [{ id, path: targetPath }, ...descendants.map((row) => ({
                id: row.id,
                path: `${targetPath}${row.path.slice(currentPath.length)}`,
            }))];
            const occupiedPaths = new Set(project.files.filter((file) => !subtreeIds.has(file.id)).map((file) => file.path));
            if (changes.some((change) => occupiedPaths.has(change.path))) return NextResponse.json({ error: 'The move would overwrite an existing project path.' }, { status: 409 });
            for (const change of changes.sort((left, right) => right.path.length - left.path.length)) {
                const { error } = await client.from('addon_module_files').update({
                    path: change.path,
                    name: fileName(change.path),
                    updated_at: new Date().toISOString(),
                }).eq('id', change.id).eq('module_id', moduleId);
                if (error) throw new Error(error.message);
            }
            const revision = await bumpModuleProjectRevision(moduleId);
            return noStoreJson({ success: true, path: targetPath, projectRevision: revision });
        }

        if (action === 'duplicate') {
            const id = String(body?.id || '');
            const targetPath = normalizeModuleProjectPath(body?.path);
            if (!id || !targetPath) return NextResponse.json({ error: 'File id and destination path are required.' }, { status: 400 });
            const { data: current, error: currentError } = await client.from('addon_module_files').select('*').eq('id', id).eq('module_id', moduleId).maybeSingle();
            if (currentError) throw new Error(currentError.message);
            if (!current) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
            const currentPath = String(current.path || '');
            if (!hasParentFolder(project.files, targetPath)) return NextResponse.json({ error: 'The destination parent folder does not exist.' }, { status: 400 });
            const descendants = project.files.filter((file) => file.path.startsWith(`${currentPath}/`));
            const originals = [current as Record<string, unknown>, ...descendants.map((file) => ({
                path: file.path,
                kind: file.kind,
                source_code: file.sourceCode,
                ui_tree: file.uiTree,
            }))];
            const rows = originals.map((row) => {
                const originalPath = String(row.path || '');
                const path = `${targetPath}${originalPath.slice(currentPath.length)}`;
                return {
                    module_id: moduleId,
                    path,
                    name: fileName(path),
                    kind: row.kind,
                    source_code: row.source_code,
                    ui_tree: row.ui_tree,
                };
            });
            const { error } = await client.from('addon_module_files').insert(rows);
            if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 400 });
            const revision = await bumpModuleProjectRevision(moduleId);
            return noStoreJson({ success: true, path: targetPath, projectRevision: revision }, { status: 201 });
        }

        return NextResponse.json({ error: 'Unsupported file action.' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Module file operation failed.' }, { status: 500 });
    }
}
