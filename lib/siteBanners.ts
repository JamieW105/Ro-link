export const SITE_BANNER_PLACEMENTS = ['PUBLIC', 'DASHBOARD', 'ALL'] as const;
export const SITE_BANNER_TONES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;

export type SiteBannerPlacement = typeof SITE_BANNER_PLACEMENTS[number];
export type SiteBannerTone = typeof SITE_BANNER_TONES[number];

export type SiteBanner = {
    id: string;
    title: string;
    message: string;
    placement: SiteBannerPlacement;
    tone: SiteBannerTone;
    linkLabel: string | null;
    linkUrl: string | null;
    enabled: boolean;
    startsAt: string | null;
    endsAt: string | null;
    createdAt: string;
    updatedAt: string;
};

function text(value: unknown, maxLength: number) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function nullableText(value: unknown, maxLength: number) {
    return text(value, maxLength) || null;
}

function nullableDate(value: unknown) {
    const raw = text(value, 100);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function normalizeSiteBanner(row: Record<string, unknown>): SiteBanner | null {
    const id = text(row.id, 100);
    const title = text(row.title, 120);
    const message = text(row.message, 500);
    if (!id || !title || !message) return null;

    const placement = SITE_BANNER_PLACEMENTS.includes(row.placement as SiteBannerPlacement)
        ? row.placement as SiteBannerPlacement
        : 'ALL';
    const tone = SITE_BANNER_TONES.includes(row.tone as SiteBannerTone)
        ? row.tone as SiteBannerTone
        : 'INFO';

    return {
        id,
        title,
        message,
        placement,
        tone,
        linkLabel: nullableText(row.link_label, 40),
        linkUrl: nullableText(row.link_url, 500),
        enabled: row.enabled !== false,
        startsAt: nullableText(row.starts_at, 100),
        endsAt: nullableText(row.ends_at, 100),
        createdAt: text(row.created_at, 100),
        updatedAt: text(row.updated_at, 100),
    };
}

export function sanitizeSiteBannerInput(value: unknown) {
    const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const title = text(body.title, 120);
    const message = text(body.message, 500);
    const placement = text(body.placement, 30).toUpperCase() as SiteBannerPlacement;
    const tone = text(body.tone, 30).toUpperCase() as SiteBannerTone;
    const linkLabel = nullableText(body.linkLabel, 40);
    const linkUrl = nullableText(body.linkUrl, 500);
    const startsAt = nullableDate(body.startsAt);
    const endsAt = nullableDate(body.endsAt);

    if (!title) return { error: 'Enter a banner title.' } as const;
    if (!message) return { error: 'Enter a banner message.' } as const;
    if (!SITE_BANNER_PLACEMENTS.includes(placement)) return { error: 'Choose a valid page restriction.' } as const;
    if (!SITE_BANNER_TONES.includes(tone)) return { error: 'Choose a valid banner style.' } as const;
    if ((linkLabel && !linkUrl) || (!linkLabel && linkUrl)) {
        return { error: 'Add both a link label and URL, or leave both blank.' } as const;
    }
    if (linkUrl) {
        try {
            const parsed = new URL(linkUrl, 'https://rolink.cloud');
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
            return { error: 'Enter a valid HTTP or HTTPS link.' } as const;
        }
    }
    if (startsAt === undefined || endsAt === undefined) return { error: 'Enter valid schedule dates.' } as const;
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
        return { error: 'The end date must be after the start date.' } as const;
    }

    return {
        title,
        message,
        placement,
        tone,
        link_label: linkLabel,
        link_url: linkUrl,
        enabled: body.enabled !== false,
        starts_at: startsAt,
        ends_at: endsAt,
    };
}
