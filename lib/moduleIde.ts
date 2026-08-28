import { createHash } from 'crypto';

import { checksumModuleSource, parseModuleConfigSchema, trimModuleString } from '@/lib/modules';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateModuleUiTree } from '@/lib/moduleUiSchema';

export const MODULE_PROJECT_FORMAT_VERSION = 2;
export const MODULE_PROJECT_RUNTIME_VERSION = '2.2.0';
export const MAX_MODULE_FILE_BYTES = 1024 * 1024;
export const MAX_MODULE_FILES = 500;
export const MAX_MODULE_PROJECT_BYTES = 10 * 1024 * 1024;

export type ModuleFileKind = 'folder' | 'server_script' | 'client_script' | 'shared_module' | 'ui' | 'manifest';

export interface ModuleProjectManifest {
    formatVersion: number;
    name: string;
    version: string;
    description: string;
    requiredRuntimeVersion: string;
    entrypoints: {
        server?: string;
        client?: string;
    };
    capabilities: string[];
    dependencies: Record<string, string>;
}

export interface ModuleProjectFile {
    id: string;
    path: string;
    name: string;
    kind: ModuleFileKind;
    sourceCode: string | null;
    uiTree: unknown;
    revision: number;
    createdAt: string;
    updatedAt: string;
}

export interface ModuleProjectProblem {
    severity: 'error' | 'warning';
    file?: string;
    line?: number;
    column?: number;
    code: string;
    message: string;
}

interface AddonModuleOwnerRow {
    id: string;
    slug: string;
    name: string;
    description: string;
    thumbnail_url: string;
    version: string;
    status: string;
    source_code: string;
    author_discord_id: string;
    created_at: string;
    updated_at: string;
    published_at?: string | null;
}

interface ProjectRow {
    module_id: string;
    format_version: number;
    revision: number;
    manifest: unknown;
    required_runtime_version: string;
    published_revision?: number | null;
    created_at: string;
    updated_at: string;
}

function normalizePathPart(value: unknown, maxLength = 128) {
    return trimModuleString(value, maxLength)
        .replace(/[\\/]+/g, '-')
        .replace(/[\u0000-\u001f<>:"|?*]/g, '-')
        .replace(/^\.+|\.+$/g, '')
        .trim();
}

export function normalizeModuleProjectPath(value: unknown) {
    const raw = String(value ?? '').replace(/\\/g, '/').trim();
    if (!raw || raw.startsWith('/') || raw.endsWith('/') || raw.includes('//')) {
        return null;
    }

    const parts = raw.split('/');
    if (parts.length > 32 || parts.some((part) => !part || part === '.' || part === '..')) {
        return null;
    }

    const normalized = parts.map((part) => normalizePathPart(part));
    if (normalized.some((part) => !part) || normalized.join('/') !== raw || raw.length > 512) {
        return null;
    }

    return raw;
}

export function isModuleFileKind(value: unknown): value is ModuleFileKind {
    return ['folder', 'server_script', 'client_script', 'shared_module', 'ui', 'manifest'].includes(String(value));
}

export function defaultModuleManifest(module: Pick<AddonModuleOwnerRow, 'name' | 'description' | 'version'>): ModuleProjectManifest {
    return {
        formatVersion: MODULE_PROJECT_FORMAT_VERSION,
        name: module.name,
        version: module.version || '1.0.0',
        description: module.description || '',
        requiredRuntimeVersion: MODULE_PROJECT_RUNTIME_VERSION,
        entrypoints: {
            server: 'Server/Main.server.luau',
            client: 'Client/Main.client.luau',
        },
        capabilities: [],
        dependencies: {},
    };
}

function normalizeManifest(value: unknown, module: AddonModuleOwnerRow): ModuleProjectManifest {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const rawEntrypoints = raw.entrypoints && typeof raw.entrypoints === 'object'
        ? raw.entrypoints as Record<string, unknown>
        : {};

    return {
        formatVersion: MODULE_PROJECT_FORMAT_VERSION,
        name: trimModuleString(raw.name || module.name, 120) || module.name,
        version: trimModuleString(raw.version || module.version, 32) || '1.0.0',
        description: trimModuleString(raw.description || module.description, 2000),
        requiredRuntimeVersion: trimModuleString(raw.requiredRuntimeVersion || MODULE_PROJECT_RUNTIME_VERSION, 32),
        entrypoints: {
            server: normalizeModuleProjectPath(rawEntrypoints.server) || undefined,
            client: normalizeModuleProjectPath(rawEntrypoints.client) || undefined,
        },
        capabilities: Array.isArray(raw.capabilities)
            ? raw.capabilities.map((item) => trimModuleString(item, 64)).filter(Boolean).slice(0, 64)
            : [],
        dependencies: raw.dependencies && typeof raw.dependencies === 'object' && !Array.isArray(raw.dependencies)
            ? Object.fromEntries(Object.entries(raw.dependencies as Record<string, unknown>)
                .map(([key, dependencyVersion]) => [trimModuleString(key, 80), trimModuleString(dependencyVersion, 32)])
                .filter(([key, dependencyVersion]) => key && dependencyVersion))
            : {},
    };
}

function normalizeFile(row: Record<string, unknown>): ModuleProjectFile {
    return {
        id: String(row.id || ''),
        path: String(row.path || ''),
        name: String(row.name || ''),
        kind: String(row.kind || 'folder') as ModuleFileKind,
        sourceCode: typeof row.source_code === 'string' ? row.source_code : null,
        uiTree: row.ui_tree ?? null,
        revision: Number(row.revision || 1),
        createdAt: String(row.created_at || ''),
        updatedAt: String(row.updated_at || ''),
    };
}

export async function getOwnedModule(moduleId: string, discordUserId: string): Promise<AddonModuleOwnerRow | null> {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('addon_modules')
        .select('id, slug, name, description, thumbnail_url, version, status, source_code, author_discord_id, created_at, updated_at, published_at')
        .eq('id', moduleId)
        .eq('author_discord_id', discordUserId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as AddonModuleOwnerRow | null) || null;
}

async function insertDefaultProjectFiles(module: AddonModuleOwnerRow, manifest: ModuleProjectManifest) {
    const client = getSupabaseAdmin();
    const legacySource = module.source_code || `return {\n    Init = function(context, settings)\n        context.Log("${module.name} loaded")\n    end,\n}\n`;
    const rows = [
        { path: 'Server', name: 'Server', kind: 'folder', source_code: null },
        { path: 'Server/Main.server.luau', name: 'Main.server.luau', kind: 'server_script', source_code: legacySource },
        { path: 'Client', name: 'Client', kind: 'folder', source_code: null },
        { path: 'Client/Main.client.luau', name: 'Main.client.luau', kind: 'client_script', source_code: '-- Client entrypoint\nreturn {}\n' },
        { path: 'Shared', name: 'Shared', kind: 'folder', source_code: null },
        { path: 'Shared/Types.luau', name: 'Types.luau', kind: 'shared_module', source_code: 'export type ModuleContext = { [string]: any }\nreturn {}\n' },
        { path: 'UI', name: 'UI', kind: 'folder', source_code: null },
        { path: 'module.json', name: 'module.json', kind: 'manifest', source_code: JSON.stringify(manifest, null, 2) + '\n' },
    ].map((row) => ({ ...row, module_id: module.id, revision: 1 }));

    const { error } = await client.from('addon_module_files').upsert(rows, { onConflict: 'module_id,path', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
}

export async function ensureOwnedModuleProject(moduleId: string, discordUserId: string) {
    const client = getSupabaseAdmin();
    const ownedModule = await getOwnedModule(moduleId, discordUserId);
    if (!ownedModule) return null;

    const projectResult = await client
        .from('addon_module_projects')
        .select('*')
        .eq('module_id', ownedModule.id)
        .maybeSingle();
    let project = projectResult.data as ProjectRow | null;
    const { error } = projectResult;
    if (error) throw new Error(error.message);

    if (!project) {
        const manifest = defaultModuleManifest(ownedModule);
        const inserted = await client
            .from('addon_module_projects')
            .insert({
                module_id: ownedModule.id,
                format_version: MODULE_PROJECT_FORMAT_VERSION,
                revision: 1,
                manifest,
                required_runtime_version: MODULE_PROJECT_RUNTIME_VERSION,
            })
            .select('*')
            .single();
        if (inserted.error) throw new Error(inserted.error.message);
        project = inserted.data as ProjectRow;
        await insertDefaultProjectFiles(ownedModule, manifest);
    }

    const { data: files, error: filesError } = await client
        .from('addon_module_files')
        .select('*')
        .eq('module_id', ownedModule.id)
        .order('path');
    if (filesError) throw new Error(filesError.message);

    const normalizedFiles = ((files || []) as Record<string, unknown>[]).map((row) => normalizeFile(row));

    return {
        module: {
            id: ownedModule.id,
            slug: ownedModule.slug,
            name: ownedModule.name,
            description: ownedModule.description,
            thumbnailUrl: ownedModule.thumbnail_url || '',
            version: ownedModule.version,
            status: ownedModule.status,
            createdAt: ownedModule.created_at,
            updatedAt: ownedModule.updated_at,
            publishedAt: ownedModule.published_at || null,
        },
        project: {
            formatVersion: Number(project.format_version),
            revision: Number(project.revision),
            publishedRevision: project.published_revision == null ? null : Number(project.published_revision),
            requiredRuntimeVersion: project.required_runtime_version,
            manifest: normalizeManifest(project.manifest, ownedModule),
            createdAt: project.created_at,
            updatedAt: project.updated_at,
        },
        files: normalizedFiles,
    };
}

export async function bumpModuleProjectRevision(moduleId: string, expectedRevision?: number) {
    const client = getSupabaseAdmin();
    const result = await client.rpc('bump_module_project_revision', {
        project_module_id: moduleId,
        expected_revision: expectedRevision ?? null,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data == null ? null : Number(result.data);
}

function findLine(source: string, pattern: RegExp) {
    const match = pattern.exec(source);
    if (!match || match.index === undefined) return undefined;
    return source.slice(0, match.index).split('\n').length;
}

export function validateModuleProject(input: {
    manifest: ModuleProjectManifest;
    files: ModuleProjectFile[];
}) {
    const problems: ModuleProjectProblem[] = [];
    const paths = new Set(input.files.map((file) => file.path));
    const scriptFiles = input.files.filter((file) => file.kind.endsWith('script') || file.kind === 'shared_module');

    for (const [context, entrypoint] of Object.entries(input.manifest.entrypoints)) {
        if (entrypoint && !paths.has(entrypoint)) {
            problems.push({ severity: 'error', file: 'module.json', code: 'missing_entrypoint', message: `${context} entrypoint ${entrypoint} does not exist.` });
        }
    }

    if (!input.manifest.entrypoints.server) {
        problems.push({ severity: 'error', file: 'module.json', code: 'missing_server_entrypoint', message: 'A server entrypoint is required for legacy runtime compatibility.' });
    }

    for (const file of scriptFiles) {
        const source = file.sourceCode || '';
        const nullByteLine = findLine(source, /\u0000/);
        if (nullByteLine) problems.push({ severity: 'error', file: file.path, line: nullByteLine, column: 1, code: 'invalid_character', message: 'Script contains a null byte.' });

        const loadstringLine = findLine(source, /\bloadstring\s*\(/);
        if (loadstringLine) problems.push({ severity: 'warning', file: file.path, line: loadstringLine, column: 1, code: 'loadstring', message: 'Avoid loadstring in distributable modules.' });

        const sourceWriteLine = findLine(source, /\.Source\s*=/);
        if (sourceWriteLine) problems.push({ severity: 'warning', file: file.path, line: sourceWriteLine, column: 1, code: 'source_write', message: 'Runtime scripts should not mutate script Source.' });
    }

    for (const file of input.files.filter((item) => item.kind === 'ui')) {
        problems.push(...validateModuleUiTree(file.uiTree, file.path));
    }

    if (input.files.length > MAX_MODULE_FILES) {
        problems.push({ severity: 'error', code: 'too_many_files', message: `Projects are limited to ${MAX_MODULE_FILES} files and folders.` });
    }
    const totalBytes = input.files.reduce((sum, file) => sum
        + Buffer.byteLength(file.sourceCode || '', 'utf8')
        + Buffer.byteLength(file.uiTree == null ? '' : JSON.stringify(file.uiTree), 'utf8'), 0);
    if (totalBytes > MAX_MODULE_PROJECT_BYTES) {
        problems.push({ severity: 'error', code: 'project_too_large', message: 'Module Project v2 packages are limited to 10 MB.' });
    }

    return problems;
}

function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
            .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

export function buildModuleProjectPackage(input: Awaited<ReturnType<typeof ensureOwnedModuleProject>>) {
    if (!input) throw new Error('Module project not found.');
    const files = input.files
        .filter((file) => file.kind !== 'folder' && file.kind !== 'manifest')
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((file) => ({
            path: file.path,
            kind: file.kind,
            sourceCode: file.sourceCode,
            uiTree: file.uiTree,
            revision: file.revision,
        }));
    const packagePayload = {
        formatVersion: MODULE_PROJECT_FORMAT_VERSION,
        moduleId: input.module.id,
        slug: input.module.slug,
        name: input.module.name,
        version: input.project.manifest.version,
        requiredRuntimeVersion: input.project.requiredRuntimeVersion,
        projectRevision: input.project.revision,
        entrypoints: input.project.manifest.entrypoints,
        capabilities: input.project.manifest.capabilities,
        dependencies: input.project.manifest.dependencies,
        files,
    };
    const serialized = stableJson(packagePayload);
    return {
        packagePayload,
        packageHash: createHash('sha256').update(serialized, 'utf8').digest('hex'),
        legacySource: files.find((file) => file.path === input.project.manifest.entrypoints.server)?.sourceCode || '',
    };
}

export async function publishModuleProject(moduleId: string, discordUserId: string) {
    const client = getSupabaseAdmin();
    const input = await ensureOwnedModuleProject(moduleId, discordUserId);
    if (!input) return null;
    const problems = validateModuleProject({ manifest: input.project.manifest, files: input.files });
    if (problems.some((problem) => problem.severity === 'error')) {
        return { ok: false as const, problems };
    }

    const { packagePayload, packageHash, legacySource } = buildModuleProjectPackage(input);
    const now = new Date().toISOString();
    const configSchema = parseModuleConfigSchema(legacySource);
    const version = input.project.manifest.version;
    const existingVersion = await client.from('addon_module_versions').select('id, project_revision, package_hash').eq('module_id', moduleId).eq('version', version).maybeSingle();
    if (existingVersion.error) throw new Error(existingVersion.error.message);
    if (existingVersion.data) {
        return {
            ok: false as const,
            problems: [...problems, {
                severity: 'error' as const,
                file: 'module.json',
                code: 'version_already_published',
                message: `Version ${version} is immutable and already exists. Increase the version in module.json before publishing again.`,
            }],
        };
    }
    const versionInsert = await client.from('addon_module_versions').insert({
        module_id: moduleId,
        version,
        project_revision: input.project.revision,
        format_version: MODULE_PROJECT_FORMAT_VERSION,
        package: packagePayload,
        package_hash: packageHash,
        published_by_discord_id: discordUserId,
    });
    if (versionInsert.error) throw new Error(versionInsert.error.message);

    const moduleUpdate = await client.from('addon_modules').update({
        version,
        source_code: legacySource,
        source_checksum: checksumModuleSource(legacySource),
        config_schema: configSchema,
        status: 'PENDING_REVIEW',
        submitted_at: now,
        updated_at: now,
    }).eq('id', moduleId).eq('author_discord_id', discordUserId);
    if (moduleUpdate.error) throw new Error(moduleUpdate.error.message);

    const projectUpdate = await client.from('addon_module_projects').update({
        published_revision: input.project.revision,
        manifest: input.project.manifest,
        updated_at: now,
    }).eq('module_id', moduleId);
    if (projectUpdate.error) throw new Error(projectUpdate.error.message);

    return { ok: true as const, problems, packageHash, version, projectRevision: input.project.revision };
}
