import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type PricingPlan = {
    id: string;
    name: string;
    price: string;
    cadence: string;
    description: string;
    features: string[];
    ctaLabel: string;
    ctaUrl: string;
    featured: boolean;
    available: boolean;
    comingSoon: boolean;
    enabled: boolean;
};

export type PricingPageContent = {
    eyebrow: string;
    title: string;
    highlightedTitle: string;
    intro: string;
    plans: PricingPlan[];
};

export type FeatureSection = {
    id: string;
    title: string;
    description: string;
    items: string[];
    comingSoon: boolean;
    enabled: boolean;
};

export type FeaturesPageContent = {
    eyebrow: string;
    title: string;
    highlightedTitle: string;
    intro: string;
    sections: FeatureSection[];
};

export type SiteContentPage = 'pricing' | 'features';

export const defaultPricingContent: PricingPageContent = {
    eyebrow: 'Simple pricing',
    title: 'Choose the plan that fits',
    highlightedTitle: 'your community.',
    intro: 'Start with the tools your team needs today and choose the plan that matches the way you manage your Roblox community.',
    plans: [
        {
            id: 'starter',
            name: 'Starter',
            price: 'Free',
            cadence: '',
            description: 'The essentials for getting a community connected with Ro-Link.',
            features: ['Discord and Roblox account linking', 'Guided Roblox setup', 'Core community management tools'],
            ctaLabel: 'Install Ro-Link',
            ctaUrl: '/auth/signin?callbackUrl=/dashboard',
            featured: false,
            available: true,
            comingSoon: false,
            enabled: true,
        },
        {
            id: 'community',
            name: 'Community',
            price: 'Coming soon',
            cadence: '',
            description: 'More control and visibility for active moderation teams.',
            features: ['Everything in Starter', 'Expanded staff workflows', 'Priority feature access'],
            ctaLabel: 'View features',
            ctaUrl: '/features',
            featured: true,
            available: true,
            comingSoon: true,
            enabled: true,
        },
    ],
};

export const defaultFeaturesContent: FeaturesPageContent = {
    eyebrow: 'Ro-Link features',
    title: 'The tools behind',
    highlightedTitle: 'live game management.',
    intro: 'Ro-Link connects Discord staff workflows to Roblox operations. See what each part does and where it fits into day-to-day community management.',
    sections: [
        { id: 'servers', title: 'Live server visibility', description: 'Give staff a shared view of active Roblox servers without asking players for server details or switching between separate admin tools.', items: ['View active server sessions', 'Check player presence and counts', 'Review live server information from the dashboard'], comingSoon: false, enabled: true },
        { id: 'moderation', title: 'Discord moderation controls', description: 'Keep supported game-management actions close to the conversation where staff receive reports and coordinate responses.', items: ['Run supported moderation actions from Discord', 'Use slash commands with clear staff permissions', 'Act without sharing Roblox owner credentials'], comingSoon: false, enabled: true },
        { id: 'identity', title: 'Linked player identity', description: 'Connect Discord members with their Roblox accounts so staff know which player they are helping, reviewing, or moderating.', items: ['Link Discord and Roblox accounts', 'Verify a member before protected submissions', 'Use linked identity during staff review'], comingSoon: false, enabled: true },
        { id: 'permissions', title: 'Role-based staff access', description: 'Assign access according to staff responsibilities instead of giving every moderator the same level of control.', items: ['Map dashboard roles to Discord staff', 'Control access to logs and staff notes', 'Restrict management tools to trusted roles'], comingSoon: false, enabled: true },
        { id: 'reports', title: 'Reports and staff context', description: 'Keep community reports, linked player details, and internal staff context together so reviews are easier to follow.', items: ['Accept reports through the public report flow', 'Review submissions with linked account context', 'Keep staff-only notes behind permissions'], comingSoon: false, enabled: true },
        { id: 'setup-tools', title: 'Guided Roblox setup', description: 'Connect the Discord bot, web dashboard, and Roblox experience through a guided setup rather than wiring each part together manually.', items: ['Connect through the Roblox Studio plugin', 'Register the experience with Ro-Link', 'Use the documentation for setup and troubleshooting'], comingSoon: false, enabled: true },
    ],
};

function text(value: unknown, maxLength: number) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function list(value: unknown, maxItems = 20) {
    return (Array.isArray(value) ? value : [])
        .map((item) => text(item, 160))
        .filter(Boolean)
        .slice(0, maxItems);
}

function id(value: unknown, fallback: string) {
    return text(value, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || fallback;
}

function safeUrl(value: unknown) {
    const url = text(value, 500);
    if (!url) return '';
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
    } catch {
        return '';
    }
}

export function sanitizePricingContent(value: unknown): PricingPageContent | { error: string } {
    const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const plans = (Array.isArray(body.plans) ? body.plans : []).slice(0, 30).map((raw, index) => {
        const plan = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        return {
            id: id(plan.id, `plan-${index + 1}`),
            name: text(plan.name, 80),
            price: text(plan.price, 80),
            cadence: text(plan.cadence, 60),
            description: text(plan.description, 300),
            features: list(plan.features),
            ctaLabel: text(plan.ctaLabel, 60),
            ctaUrl: safeUrl(plan.ctaUrl),
            featured: plan.featured === true,
            available: plan.available !== false,
            comingSoon: plan.comingSoon === true,
            enabled: plan.enabled !== false,
        };
    });
    if (plans.some((plan) => !plan.name || !plan.price || !plan.description || !plan.ctaLabel || !plan.ctaUrl)) {
        return { error: 'Every pricing plan needs a name, price, description, button label, and valid button URL.' };
    }
    const result = {
        eyebrow: text(body.eyebrow, 80),
        title: text(body.title, 120),
        highlightedTitle: text(body.highlightedTitle, 120),
        intro: text(body.intro, 500),
        plans,
    };
    if (!result.eyebrow || !result.title || !result.highlightedTitle || !result.intro) return { error: 'Complete all pricing page introduction fields.' };
    return result;
}

export function sanitizeFeaturesContent(value: unknown): FeaturesPageContent | { error: string } {
    const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const sections = (Array.isArray(body.sections) ? body.sections : []).slice(0, 30).map((raw, index) => {
        const section = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        return {
            id: id(section.id, `feature-${index + 1}`),
            title: text(section.title, 100),
            description: text(section.description, 500),
            items: list(section.items),
            comingSoon: section.comingSoon === true,
            enabled: section.enabled !== false,
        };
    });
    if (sections.some((section) => !section.title || !section.description || section.items.length === 0)) {
        return { error: 'Every feature needs a title, description, and at least one bullet point.' };
    }
    const result = {
        eyebrow: text(body.eyebrow, 80),
        title: text(body.title, 120),
        highlightedTitle: text(body.highlightedTitle, 120),
        intro: text(body.intro, 500),
        sections,
    };
    if (!result.eyebrow || !result.title || !result.highlightedTitle || !result.intro) return { error: 'Complete all features page introduction fields.' };
    return result;
}

export function sanitizeSiteContent(page: SiteContentPage, value: unknown) {
    return page === 'pricing' ? sanitizePricingContent(value) : sanitizeFeaturesContent(value);
}

export async function getSiteContent(page: 'pricing'): Promise<PricingPageContent>;
export async function getSiteContent(page: 'features'): Promise<FeaturesPageContent>;
export async function getSiteContent(page: SiteContentPage): Promise<PricingPageContent | FeaturesPageContent>;
export async function getSiteContent(page: SiteContentPage): Promise<PricingPageContent | FeaturesPageContent> {
    const fallback = page === 'pricing' ? defaultPricingContent : defaultFeaturesContent;
    try {
        const { data, error } = await getSupabaseAdmin().from('public_page_content').select('content').eq('page', page).maybeSingle();
        if (error || !data?.content) return fallback;
        const sanitized = sanitizeSiteContent(page, data.content);
        return 'error' in sanitized ? fallback : sanitized;
    } catch {
        return fallback;
    }
}
