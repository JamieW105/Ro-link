export type ModuleScriptKind = 'server_script' | 'client_script' | 'shared_module';

export function normalizeModuleScriptPath(path: string, kind: string) {
    if (!['server_script', 'client_script', 'shared_module'].includes(kind)) return path;
    const slash = path.lastIndexOf('/');
    const parent = slash >= 0 ? path.slice(0, slash + 1) : '';
    let name = slash >= 0 ? path.slice(slash + 1) : path;
    name = name.replace(/\.(?:server|client|module)(?:\.luau)?$/i, '').replace(/\.luau$/i, '');
    const suffix = kind === 'server_script' ? '.server' : kind === 'client_script' ? '.client' : '.module';
    return `${parent}${name}${suffix}`;
}

export function getNewModuleScriptSource(kind: ModuleScriptKind) {
    return kind === 'shared_module' ? 'local module = {}\n\nreturn module\n' : '';
}

export function isModuleIdeVisibleFile(file: { kind: string; path: string }) {
    return file.kind !== 'manifest' && !file.path.toLowerCase().endsWith('.json');
}
