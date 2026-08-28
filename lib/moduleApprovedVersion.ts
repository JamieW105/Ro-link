export type StoredModulePackage = {
    entrypoints?: { server?: unknown };
    files?: Array<{ path?: unknown; sourceCode?: unknown }>;
};

export function getModuleVersionKey(moduleId: unknown, version: unknown) {
    return `${String(moduleId || '')}:${String(version || '')}`;
}

export function getModulePackageServerSource(value: unknown) {
    if (!value || typeof value !== 'object') return '';
    const packageValue = value as StoredModulePackage;
    const serverPath = String(packageValue.entrypoints?.server || '');
    if (!serverPath || !Array.isArray(packageValue.files)) return '';
    const serverFile = packageValue.files.find((file) => String(file.path || '') === serverPath);
    return typeof serverFile?.sourceCode === 'string' ? serverFile.sourceCode : '';
}

export function canRestoreApprovedModuleVersion(input: {
    status: unknown;
    publishedAt: unknown;
    reviewedAt: unknown;
}) {
    return ['DRAFT', 'PUBLISHED'].includes(String(input.status || ''))
        && Boolean(input.publishedAt)
        && Boolean(input.reviewedAt);
}
