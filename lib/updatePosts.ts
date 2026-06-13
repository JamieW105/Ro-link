export interface UpdatePostMajorFeature {
    title: string;
    description: string;
    subFeatures: string[];
}

export const DEFAULT_ROLINK_VERSION = 'V2.01.0';
export type UpdatePostStatus = 'DRAFT' | 'PUBLISHED';

export interface UpdatePostRecord {
    id: string;
    slug: string;
    version: string | null;
    rolink_version: string | null;
    plugin_version: string | null;
    title: string;
    description: string;
    major_features: UpdatePostMajorFeature[];
    minor_updates: string[];
    qol_updates: string[];
    bug_fixes: string[];
    author_discord_id: string | null;
    status: UpdatePostStatus;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface UpdatePostInput {
    version: string;
    rolink_version: string;
    plugin_version: string | null;
    title: string;
    description: string;
    major_features: UpdatePostMajorFeature[];
    minor_updates: string[];
    qol_updates: string[];
    bug_fixes: string[];
}

export function normalizeUpdatePostStatus(value: unknown, publishedAt?: unknown): UpdatePostStatus {
    const status = trimString(value).toUpperCase();

    if (status === 'PUBLISHED') {
        return 'PUBLISHED';
    }

    if (!status && trimString(publishedAt)) {
        return 'PUBLISHED';
    }

    return 'DRAFT';
}

export function hasUpdatePostSections(post: Pick<UpdatePostInput, 'major_features' | 'minor_updates' | 'qol_updates' | 'bug_fixes'>) {
    return (
        post.major_features.length > 0
        || post.minor_updates.length > 0
        || post.qol_updates.length > 0
        || post.bug_fixes.length > 0
    );
}

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

export function normalizeUpdateStringList(rawValues: unknown) {
    if (!Array.isArray(rawValues)) {
        return [];
    }

    return rawValues
        .map((value) => trimString(value))
        .filter(Boolean);
}

export function normalizeMajorFeatures(rawFeatures: unknown): UpdatePostMajorFeature[] {
    if (!Array.isArray(rawFeatures)) {
        return [];
    }

    return rawFeatures
        .map((rawFeature) => {
            if (!rawFeature || typeof rawFeature !== 'object') {
                return null;
            }

            const feature = rawFeature as Record<string, unknown>;
            const title = trimString(feature.title);
            const description = trimString(feature.description);
            const subFeatures = normalizeUpdateStringList(feature.subFeatures);

            if (!title || subFeatures.length === 0) {
                return null;
            }

            return {
                title,
                description,
                subFeatures,
            } satisfies UpdatePostMajorFeature;
        })
        .filter((feature): feature is UpdatePostMajorFeature => Boolean(feature));
}

export function sanitizeUpdatePostInput(rawBody: unknown, options: { requireUpdateSection?: boolean } = {}) {
    const body = rawBody && typeof rawBody === 'object'
        ? rawBody as Record<string, unknown>
        : {};

    const rolink_version = trimString(body.rolink_version || body.version);
    const plugin_version = trimString(body.plugin_version);
    const title = trimString(body.title);
    const description = trimString(body.description);
    const major_features = normalizeMajorFeatures(body.major_features);
    const minor_updates = normalizeUpdateStringList(body.minor_updates);
    const qol_updates = normalizeUpdateStringList(body.qol_updates);
    const bug_fixes = normalizeUpdateStringList(body.bug_fixes);

    if (!rolink_version) {
        return { error: 'Ro-Link version is required.' } as const;
    }

    if (!title) {
        return { error: 'Title is required.' } as const;
    }

    if (!description) {
        return { error: 'Description is required.' } as const;
    }

    if (options.requireUpdateSection && !hasUpdatePostSections({ major_features, minor_updates, qol_updates, bug_fixes })) {
        return { error: 'Add at least one update section before publishing.' } as const;
    }

    return {
        version: rolink_version,
        rolink_version,
        plugin_version: plugin_version || null,
        title,
        description,
        major_features,
        minor_updates,
        qol_updates,
        bug_fixes,
    } satisfies UpdatePostInput;
}

export function normalizeUpdatePost(rawPost: unknown): UpdatePostRecord | null {
    if (!rawPost || typeof rawPost !== 'object') {
        return null;
    }

    const post = rawPost as Record<string, unknown>;
    const id = trimString(post.id);
    const slug = trimString(post.slug);
    const rolink_version = trimString(post.rolink_version || post.version) || null;
    const plugin_version = trimString(post.plugin_version) || null;
    const title = trimString(post.title);
    const description = trimString(post.description);
    const published_at = trimString(post.published_at) || null;
    const status = normalizeUpdatePostStatus(post.status, published_at);
    const created_at = trimString(post.created_at);
    const updated_at = trimString(post.updated_at);

    if (!id || !slug || !title || !description) {
        return null;
    }

    return {
        id,
        slug,
        version: rolink_version,
        rolink_version,
        plugin_version,
        title,
        description,
        major_features: normalizeMajorFeatures(post.major_features),
        minor_updates: normalizeUpdateStringList(post.minor_updates),
        qol_updates: normalizeUpdateStringList(post.qol_updates),
        bug_fixes: normalizeUpdateStringList(post.bug_fixes),
        author_discord_id: trimString(post.author_discord_id) || null,
        status,
        published_at,
        created_at,
        updated_at,
    };
}

export function slugifyUpdatePostTitle(title: string) {
    const slug = trimString(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72);

    return slug || 'update';
}
