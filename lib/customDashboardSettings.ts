export type CustomDashboardLayout =
    | 'standard'
    | 'compact'
    | 'spacious'
    | 'floating_dock'
    | 'split_sidebar'
    | 'minimalist_drawer';

export type CustomDashboardTheme =
    | 'sky'
    | 'emerald'
    | 'violet'
    | 'rose'
    | 'amber'
    | 'cyan'
    | 'slate';

export type CustomDashboardMetadata = {
    title: string;
    description: string;
    logoUrl: string;
    supportUrl: string;
};

export type CustomDashboardThemeOption = {
    id: CustomDashboardTheme;
    name: string;
    accent: string;
    accentText: string;
    softBg: string;
    border: string;
    gradient: string;
};

export const DEFAULT_CUSTOM_DASHBOARD_LAYOUT: CustomDashboardLayout = 'standard';
export const DEFAULT_CUSTOM_DASHBOARD_THEME: CustomDashboardTheme = 'sky';

export const CUSTOM_DASHBOARD_LAYOUTS: Array<{ id: CustomDashboardLayout; name: string; description: string }> = [
    { id: 'standard', name: 'Classic Left Sidebar', description: 'Traditional persistent left sidebar layout.' },
    { id: 'compact', name: 'Slim Left Dock', description: 'Floating vertical glassmorphic dock with expanding hover interactions.' },
    { id: 'spacious', name: 'Horizontal Top Navigation', description: 'Sticky top bar menu with zero sidebar, maximizing viewport width.' },
    { id: 'floating_dock', name: 'Floating Bottom Dock', description: 'A gorgeous, macOS-style bottom-floating glassmorphic navigation deck.' },
    { id: 'split_sidebar', name: 'Split Double Sidebar', description: 'Split columns: category vertical icon column + nested items sidebar.' },
    { id: 'minimalist_drawer', name: 'Minimalist Menu Overlay', description: 'Zero persistent navigation. Sleek floating hamburger reveals full-screen blur overlay.' },
];

export const CUSTOM_DASHBOARD_THEMES: CustomDashboardThemeOption[] = [
    {
        id: 'sky',
        name: 'Sky',
        accent: '#38bdf8',
        accentText: '#bae6fd',
        softBg: 'rgba(14, 165, 233, 0.14)',
        border: 'rgba(56, 189, 248, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(14, 165, 233, 0.2), transparent 34%), #020617',
    },
    {
        id: 'emerald',
        name: 'Emerald',
        accent: '#34d399',
        accentText: '#a7f3d0',
        softBg: 'rgba(16, 185, 129, 0.14)',
        border: 'rgba(52, 211, 153, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.2), transparent 34%), #020617',
    },
    {
        id: 'violet',
        name: 'Violet',
        accent: '#a78bfa',
        accentText: '#ddd6fe',
        softBg: 'rgba(139, 92, 246, 0.14)',
        border: 'rgba(167, 139, 250, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(139, 92, 246, 0.2), transparent 34%), #020617',
    },
    {
        id: 'rose',
        name: 'Rose',
        accent: '#fb7185',
        accentText: '#fecdd3',
        softBg: 'rgba(244, 63, 94, 0.14)',
        border: 'rgba(251, 113, 133, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(244, 63, 94, 0.2), transparent 34%), #020617',
    },
    {
        id: 'amber',
        name: 'Amber',
        accent: '#fbbf24',
        accentText: '#fde68a',
        softBg: 'rgba(245, 158, 11, 0.14)',
        border: 'rgba(251, 191, 36, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 34%), #020617',
    },
    {
        id: 'cyan',
        name: 'Cyan',
        accent: '#22d3ee',
        accentText: '#a5f3fc',
        softBg: 'rgba(6, 182, 212, 0.14)',
        border: 'rgba(34, 211, 238, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(6, 182, 212, 0.2), transparent 34%), #020617',
    },
    {
        id: 'slate',
        name: 'Slate',
        accent: '#cbd5e1',
        accentText: '#f8fafc',
        softBg: 'rgba(148, 163, 184, 0.14)',
        border: 'rgba(203, 213, 225, 0.24)',
        gradient: 'radial-gradient(circle at top left, rgba(148, 163, 184, 0.16), transparent 34%), #020617',
    },
];

const CUSTOM_DASHBOARD_LAYOUT_IDS = new Set(CUSTOM_DASHBOARD_LAYOUTS.map((layout) => layout.id));
const CUSTOM_DASHBOARD_THEME_IDS = new Set(CUSTOM_DASHBOARD_THEMES.map((theme) => theme.id));

function limitString(value: unknown, maxLength: number) {
    return String(value ?? '').trim().slice(0, maxLength);
}

export function normalizeCustomDashboardLayout(value: unknown): CustomDashboardLayout {
    const layout = String(value || '').trim().toLowerCase();
    return CUSTOM_DASHBOARD_LAYOUT_IDS.has(layout as CustomDashboardLayout)
        ? layout as CustomDashboardLayout
        : DEFAULT_CUSTOM_DASHBOARD_LAYOUT;
}

export function normalizeCustomDashboardTheme(value: unknown): CustomDashboardTheme {
    const theme = String(value || '').trim().toLowerCase();
    return CUSTOM_DASHBOARD_THEME_IDS.has(theme as CustomDashboardTheme)
        ? theme as CustomDashboardTheme
        : DEFAULT_CUSTOM_DASHBOARD_THEME;
}

export function getCustomDashboardTheme(value: unknown) {
    const theme = normalizeCustomDashboardTheme(value);
    return CUSTOM_DASHBOARD_THEMES.find((option) => option.id === theme) || CUSTOM_DASHBOARD_THEMES[0];
}

export function normalizeCustomDashboardMetadata(value: unknown): CustomDashboardMetadata {
    const metadata = (value && typeof value === 'object') ? value as Record<string, unknown> : {};

    return {
        title: limitString(metadata.title, 80),
        description: limitString(metadata.description, 180),
        logoUrl: limitString(metadata.logoUrl, 500),
        supportUrl: limitString(metadata.supportUrl, 500),
    };
}
