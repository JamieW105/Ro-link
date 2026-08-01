import type { Metadata } from 'next';

export const SITE_NAME = 'Ro-Link';
export const SITE_DESCRIPTION = 'Connect Discord and Roblox with live server visibility, linked player identities, role-based access, reporting, and moderation tools.';

export function getSiteUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
    try {
        return new URL(configuredUrl || 'https://rolink.cloud');
    } catch {
        return new URL('https://rolink.cloud');
    }
}

type SeoMetadataOptions = {
    title: string;
    description: string;
    path?: string;
    index?: boolean;
};

export function createSeoMetadata({ title, description, path, index = true }: SeoMetadataOptions): Metadata {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonical = path ? new URL(path, getSiteUrl()).toString() : undefined;

    return {
        title: fullTitle,
        description,
        alternates: canonical ? { canonical } : undefined,
        robots: { index, follow: index },
        openGraph: {
            title: fullTitle,
            description,
            url: canonical,
            siteName: SITE_NAME,
            type: 'website',
            images: [{
                url: '/Media/Ro-LinkIcon.png',
                width: 512,
                height: 512,
                alt: 'Ro-Link logo',
            }],
        },
        twitter: {
            card: 'summary',
            title: fullTitle,
            description,
            images: ['/Media/Ro-LinkIcon.png'],
        },
    };
}
