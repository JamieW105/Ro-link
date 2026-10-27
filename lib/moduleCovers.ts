export const MAX_MODULE_COVERS = 4;
export const MAX_COVER_SOURCE_BYTES = 9 * 1024 * 1024;
export const MAX_COVER_STORED_BYTES = 2 * 1024 * 1024;
export const MODULE_COVER_BUCKET = 'module-covers';
export const COVER_ACCEPT = 'image/jpeg,image/png,image/webp';
const coverPathPattern = /^[a-zA-Z0-9_-]{1,64}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
export function isModuleCoverPath(value: unknown): value is string {
    return typeof value === 'string' && coverPathPattern.test(value);
}
export function parseModuleCoverPaths(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length > MAX_MODULE_COVERS || !value.every(isModuleCoverPath) || new Set(value).size !== value.length) return null;
    return value;
}
export function moduleCoverUrl(path: string) {
    return isModuleCoverPath(path) ? `/api/module-covers/${path}` : '';
}
