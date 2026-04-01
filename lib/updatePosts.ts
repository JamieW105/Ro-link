export interface UpdatePostMajorFeature {
    title: string;
    description: string;
    subFeatures: string[];
}

export interface UpdatePostRecord {
    id: string;
    slug: string;
    title: string;
    description: string;
    major_features: UpdatePostMajorFeature[];
    minor_updates: string[];
    qol_updates: string[];
    bug_fixes: string[];
    author_discord_id: string | null;
    published_at: string;
    created_at: string;
    updated_at: string;
}

export interface UpdatePostInput {
    title: string;
    description: string;
    major_features: UpdatePostMajorFeature[];
    minor_updates: string[];
    qol_updates: string[];
    bug_fixes: string[];
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

export function sanitizeUpdatePostInput(rawBody: unknown) {
    const body = rawBody && typeof rawBody === 'object'
        ? rawBody as Record<string, unknown>
        : {};

    const title = trimString(body.title);
    const description = trimString(body.description);
    const major_features = normalizeMajorFeatures(body.major_features);
    const minor_updates = normalizeUpdateStringList(body.minor_updates);
    const qol_updates = normalizeUpdateStringList(body.qol_updates);
    const bug_fixes = normalizeUpdateStringList(body.bug_fixes);

    if (!title) {
        return { error: 'Title is required.' } as const;
    }

    if (!description) {
        return { error: 'Description is required.' } as const;
    }

    if (
        major_features.length === 0
        && minor_updates.length === 0
        && qol_updates.length === 0
        && bug_fixes.length === 0
    ) {
        return { error: 'Add at least one update section before publishing.' } as const;
    }

    return {
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
    const title = trimString(post.title);
    const description = trimString(post.description);
    const published_at = trimString(post.published_at);
    const created_at = trimString(post.created_at);
    const updated_at = trimString(post.updated_at);

    if (!id || !slug || !title || !description || !published_at) {
        return null;
    }

    return {
        id,
        slug,
        title,
        description,
        major_features: normalizeMajorFeatures(post.major_features),
        minor_updates: normalizeUpdateStringList(post.minor_updates),
        qol_updates: normalizeUpdateStringList(post.qol_updates),
        bug_fixes: normalizeUpdateStringList(post.bug_fixes),
        author_discord_id: trimString(post.author_discord_id) || null,
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
