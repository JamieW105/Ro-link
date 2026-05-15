import type { Metadata } from 'next';

import { trimModuleString } from '@/lib/modules';
import { supabase } from '@/lib/supabase';

import ModuleMarketplaceRedirect from './ModuleMarketplaceRedirect';

type RouteContext = {
    params: Promise<{
        moduleSlug: string;
    }>;
};

type ModulePreviewRow = {
    slug?: string | null;
    name?: string | null;
    description?: string | null;
    category?: string | null;
};

function getBaseUrl() {
    return (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function buildModuleUrl(moduleSlug: string) {
    return `${getBaseUrl()}/dashboard/marketplace/${encodeURIComponent(moduleSlug)}`;
}

async function getPublishedModuleBySlug(moduleSlug: string) {
    const slug = trimModuleString(moduleSlug, 80);
    if (!slug) return null;

    const { data, error } = await supabase
        .from('addon_modules')
        .select('slug, name, description, category')
        .eq('slug', slug)
        .eq('status', 'PUBLISHED')
        .maybeSingle<ModulePreviewRow>();

    if (error) {
        console.error('[Marketplace] Failed to load module metadata', {
            moduleSlug: slug,
            error: error.message,
        });
        return null;
    }

    return data;
}

export async function generateMetadata(context: RouteContext): Promise<Metadata> {
    const { moduleSlug } = await context.params;
    const addonModule = await getPublishedModuleBySlug(moduleSlug);
    const moduleName = trimModuleString(addonModule?.name, 120) || 'Marketplace Module';
    const moduleTag = trimModuleString(addonModule?.category, 120) || 'General';
    const moduleDescription = trimModuleString(addonModule?.description, 300) || 'View this module on the Ro-Link marketplace.';
    const title = `${moduleName} | Ro-Link Dashboard Modules`;
    const description = `${moduleTag}\n${moduleDescription}`;
    const url = buildModuleUrl(addonModule?.slug || moduleSlug);

    return {
        title,
        description,
        alternates: {
            canonical: url,
        },
        openGraph: {
            title,
            description,
            url,
            siteName: 'Ro-Link',
            type: 'website',
            images: [
                {
                    url: `${getBaseUrl()}/Media/Ro-LinkIcon.png`,
                    width: 512,
                    height: 512,
                    alt: 'Ro-Link',
                },
            ],
        },
        twitter: {
            card: 'summary',
            title,
            description,
            images: [`${getBaseUrl()}/Media/Ro-LinkIcon.png`],
        },
    };
}

export default async function MarketplaceModulePage(context: RouteContext) {
    const { moduleSlug } = await context.params;

    return <ModuleMarketplaceRedirect moduleSlug={moduleSlug} />;
}
