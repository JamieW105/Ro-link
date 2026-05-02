import { createHash } from 'crypto';

export type AddonModuleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface SanitizedAddonModuleInput {
    name?: string;
    slug?: string;
    description?: string;
    version?: string;
    category?: string;
    status?: AddonModuleStatus;
    sourceCode?: string;
}

export type SanitizedAddonModuleResult =
    | { input: SanitizedAddonModuleInput }
    | { errors: string[] };

const VALID_MODULE_STATUSES = new Set<AddonModuleStatus>(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export function trimModuleString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

export function slugifyModuleName(value: string) {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    return slug || 'module';
}

export function checksumModuleSource(sourceCode: string) {
    return createHash('sha256').update(sourceCode, 'utf8').digest('hex');
}

export function sanitizeAddonModuleInput(body: Record<string, unknown>, partial = false): SanitizedAddonModuleResult {
    const input: SanitizedAddonModuleInput = {};
    const errors: string[] = [];

    if (!partial || 'name' in body) {
        const name = trimModuleString(body.name, 120);
        if (!name) {
            errors.push('Module name is required.');
        } else {
            input.name = name;
        }
    }

    if ('slug' in body) {
        const slug = slugifyModuleName(trimModuleString(body.slug, 80));
        if (slug) {
            input.slug = slug;
        }
    }

    if (!partial || 'description' in body) {
        input.description = trimModuleString(body.description, 2000);
    }

    if (!partial || 'version' in body) {
        input.version = trimModuleString(body.version, 40) || '1.0.0';
    }

    if (!partial || 'category' in body) {
        input.category = trimModuleString(body.category, 80) || 'General';
    }

    if (!partial || 'status' in body) {
        const status = trimModuleString(body.status, 20).toUpperCase() as AddonModuleStatus;
        input.status = VALID_MODULE_STATUSES.has(status) ? status : 'DRAFT';
    }

    if (!partial || 'sourceCode' in body || 'source_code' in body) {
        const sourceCode = trimModuleString(body.sourceCode ?? body.source_code, 250_000);
        if (!sourceCode) {
            errors.push('Module source code is required.');
        } else {
            input.sourceCode = sourceCode;
        }
    }

    if (errors.length > 0) {
        return { errors } as const;
    }

    return { input } as const;
}

export function normalizeAddonModule(row: Record<string, unknown> | null | undefined, includeSource = false) {
    if (!row) {
        return null;
    }

    return {
        id: String(row.id || ''),
        slug: String(row.slug || ''),
        name: String(row.name || 'Untitled Module'),
        description: String(row.description || ''),
        version: String(row.version || '1.0.0'),
        category: String(row.category || 'General'),
        status: String(row.status || 'DRAFT') as AddonModuleStatus,
        sourceChecksum: String(row.source_checksum || ''),
        authorDiscordId: row.author_discord_id ? String(row.author_discord_id) : null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        publishedAt: row.published_at || null,
        ...(includeSource ? { sourceCode: String(row.source_code || '') } : {}),
    };
}

export function parseModuleSettings(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}
