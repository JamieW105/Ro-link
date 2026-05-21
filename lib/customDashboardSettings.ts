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
    pageBg: string;
    pageBgSoft: string;
    surfaceBg: string;
    surfaceBgSoft: string;
    surfaceBgStrong: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textFaint: string;
    neutralBorder: string;
    neutralBorderStrong: string;
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
        pageBg: '#020617',
        pageBgSoft: '#07111f',
        surfaceBg: '#0f172a',
        surfaceBgSoft: '#111c31',
        surfaceBgStrong: '#020617',
        textPrimary: '#f8fafc',
        textSecondary: '#cbd5e1',
        textMuted: '#94a3b8',
        textFaint: '#64748b',
        neutralBorder: 'rgba(51, 65, 85, 0.72)',
        neutralBorderStrong: 'rgba(71, 85, 105, 0.9)',
    },
    {
        id: 'emerald',
        name: 'Emerald',
        accent: '#34d399',
        accentText: '#a7f3d0',
        softBg: 'rgba(16, 185, 129, 0.14)',
        border: 'rgba(52, 211, 153, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.2), transparent 34%), #03130f',
        pageBg: '#03130f',
        pageBgSoft: '#062018',
        surfaceBg: '#0b211a',
        surfaceBgSoft: '#0e2b22',
        surfaceBgStrong: '#04100d',
        textPrimary: '#ecfdf5',
        textSecondary: '#bbf7d0',
        textMuted: '#86b9a4',
        textFaint: '#4d806e',
        neutralBorder: 'rgba(52, 211, 153, 0.16)',
        neutralBorderStrong: 'rgba(110, 231, 183, 0.28)',
    },
    {
        id: 'violet',
        name: 'Violet',
        accent: '#a78bfa',
        accentText: '#ddd6fe',
        softBg: 'rgba(139, 92, 246, 0.14)',
        border: 'rgba(167, 139, 250, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(139, 92, 246, 0.2), transparent 34%), #0e0920',
        pageBg: '#0e0920',
        pageBgSoft: '#17102d',
        surfaceBg: '#1b1533',
        surfaceBgSoft: '#241b42',
        surfaceBgStrong: '#090616',
        textPrimary: '#faf5ff',
        textSecondary: '#ddd6fe',
        textMuted: '#b8a8d8',
        textFaint: '#7d6b9a',
        neutralBorder: 'rgba(167, 139, 250, 0.16)',
        neutralBorderStrong: 'rgba(196, 181, 253, 0.28)',
    },
    {
        id: 'rose',
        name: 'Rose',
        accent: '#fb7185',
        accentText: '#fecdd3',
        softBg: 'rgba(244, 63, 94, 0.14)',
        border: 'rgba(251, 113, 133, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(244, 63, 94, 0.2), transparent 34%), #1b0810',
        pageBg: '#1b0810',
        pageBgSoft: '#2a0e17',
        surfaceBg: '#32131c',
        surfaceBgSoft: '#401924',
        surfaceBgStrong: '#12050a',
        textPrimary: '#fff1f2',
        textSecondary: '#fecdd3',
        textMuted: '#d99aa6',
        textFaint: '#925763',
        neutralBorder: 'rgba(251, 113, 133, 0.16)',
        neutralBorderStrong: 'rgba(253, 164, 175, 0.28)',
    },
    {
        id: 'amber',
        name: 'Amber',
        accent: '#fbbf24',
        accentText: '#fde68a',
        softBg: 'rgba(245, 158, 11, 0.14)',
        border: 'rgba(251, 191, 36, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 34%), #1a1004',
        pageBg: '#1a1004',
        pageBgSoft: '#261807',
        surfaceBg: '#30200b',
        surfaceBgSoft: '#3c280e',
        surfaceBgStrong: '#120a02',
        textPrimary: '#fffbeb',
        textSecondary: '#fde68a',
        textMuted: '#d6b66e',
        textFaint: '#8b7341',
        neutralBorder: 'rgba(251, 191, 36, 0.16)',
        neutralBorderStrong: 'rgba(252, 211, 77, 0.3)',
    },
    {
        id: 'cyan',
        name: 'Cyan',
        accent: '#22d3ee',
        accentText: '#a5f3fc',
        softBg: 'rgba(6, 182, 212, 0.14)',
        border: 'rgba(34, 211, 238, 0.28)',
        gradient: 'radial-gradient(circle at top left, rgba(6, 182, 212, 0.2), transparent 34%), #041318',
        pageBg: '#041318',
        pageBgSoft: '#071f27',
        surfaceBg: '#0b2831',
        surfaceBgSoft: '#0e3440',
        surfaceBgStrong: '#031014',
        textPrimary: '#ecfeff',
        textSecondary: '#a5f3fc',
        textMuted: '#86c9d3',
        textFaint: '#4d818a',
        neutralBorder: 'rgba(34, 211, 238, 0.16)',
        neutralBorderStrong: 'rgba(103, 232, 249, 0.28)',
    },
    {
        id: 'slate',
        name: 'Slate',
        accent: '#cbd5e1',
        accentText: '#f8fafc',
        softBg: 'rgba(148, 163, 184, 0.14)',
        border: 'rgba(203, 213, 225, 0.24)',
        gradient: 'radial-gradient(circle at top left, rgba(148, 163, 184, 0.16), transparent 34%), #080c14',
        pageBg: '#080c14',
        pageBgSoft: '#101621',
        surfaceBg: '#161d2a',
        surfaceBgSoft: '#1d2634',
        surfaceBgStrong: '#05080d',
        textPrimary: '#f8fafc',
        textSecondary: '#dbe4ef',
        textMuted: '#a5b4c5',
        textFaint: '#718196',
        neutralBorder: 'rgba(148, 163, 184, 0.18)',
        neutralBorderStrong: 'rgba(203, 213, 225, 0.28)',
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
