'use client';

import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, type CSSProperties } from "react";
import { hasAnyAdminPanelCommand, MISC_ACTION_COMMAND_IDS } from "@/lib/adminPanelCommands";
import {
    DEFAULT_CUSTOM_DASHBOARD_LAYOUT,
    DEFAULT_CUSTOM_DASHBOARD_THEME,
    getCustomDashboardTheme,
    type CustomDashboardLayout,
    type CustomDashboardMetadata,
    type CustomDashboardTheme,
} from "@/lib/customDashboardSettings";
import { useSession } from "next-auth/react";
import { PermissionsProvider } from "@/context/PermissionsContext";

interface VisibleGuild {
    id: string;
    hasBot?: boolean;
}

interface DashboardPermissions {
    can_access_dashboard: boolean;
    can_kick: boolean;
    can_ban: boolean;
    can_timeout: boolean;
    can_mute: boolean;
    can_lookup: boolean;
    can_manage_reports: boolean;
    can_manage_settings: boolean;
    allowed_misc_cmds: string[];
    is_admin: boolean;
}

interface CustomDashboardInfo {
    id?: string;
    name: string;
    icon?: string | null;
    subdomain?: string;
    hostname?: string;
    layout?: CustomDashboardLayout;
    theme?: CustomDashboardTheme;
    metadata?: CustomDashboardMetadata;
}

type CustomDashboardPreview = {
    layout?: CustomDashboardLayout;
    theme?: CustomDashboardTheme;
    metadata?: CustomDashboardMetadata;
};

// --- PREMIUM SVG ICONS ---

const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const ServersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
);

const MagicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
    </svg>
);

const BackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
);

const HamburgerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
);

const LookupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
);

const VerificationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const ModulesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
    </svg>
);

const ReportsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const ScrollIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
        <path d="M12 11V7" />
        <path d="M12 17v-2" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h8" />
    </svg>
);

const OverviewIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
    </svg>
);

const RolesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" />
    </svg>
);

const CommandsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
    </svg>
);

const SettingsReportsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
);

const DashboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="14" x="3" y="5" rx="2" /><path d="M7 9h10" /><path d="M7 13h4" />
    </svg>
);

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export default function ServerLayout({ children }: { children: React.ReactNode }) {
    const { id } = useParams();
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userPermissions, setUserPermissions] = useState<DashboardPermissions | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [isCustomDashboardHost, setIsCustomDashboardHost] = useState(false);
    const [customDashboardInfo, setCustomDashboardInfo] = useState<CustomDashboardInfo | null>(null);
    const [customDashboardPreview, setCustomDashboardPreview] = useState<CustomDashboardPreview | null>(null);
    const [hasCustomDashboardSetup, setHasCustomDashboardSetup] = useState(false);
    const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
    const [apiLatencyState, setApiLatencyState] = useState<'measuring' | 'ready' | 'error'>('measuring');
    const [activeCategory, setActiveCategory] = useState<'utility' | 'moderation' | 'settings'>('utility');
    const [isDrawerMenuOpen, setIsDrawerMenuOpen] = useState(false);

    function signInFromCustomDashboard() {
        window.location.href = `/api/auth/custom-dashboard?callbackUrl=${encodeURIComponent(window.location.href)}`;
    }
    useEffect(() => {
        if (!session || !id) return;

        async function checkAccess() {
            setLoading(true);
            setAccessDenied(false);
            try {
                // 1. Fetch User Guilds to ensure they are even in the server
                const guildsRes = await fetch('/api/guilds');
                const guilds = await guildsRes.json() as VisibleGuild[];
                const g = guilds.find((guild) => guild.id === id);

                if (!g || !g.hasBot) {
                    console.log("[Guard] Access denied or bot not present.");
                    setAccessDenied(true);
                    return;
                }

                // 2. Fetch Detailed Permissions for this specific server
                const permsRes = await fetch(`/api/user/permissions?serverId=${id}`);
                const perms = await permsRes.json() as DashboardPermissions | null;

                if (!perms || !perms.can_access_dashboard) {
                    console.log("[Guard] No dashboard access for this server.");
                    setAccessDenied(true);
                    return;
                }

                setUserPermissions(perms);
            } catch (err) {
                console.error("[Guard] Error checking access:", err);
                setAccessDenied(true);
            } finally {
                setLoading(false);
            }
        }

        checkAccess();
    }, [session, id, router]);

    useEffect(() => {
        if (!id) return;

        let cancelled = false;

        async function loadCustomDashboardContext() {
            try {
                const response = await fetch(`/api/custom-dashboard/resolve?hostname=${encodeURIComponent(window.location.hostname)}`, {
                    cache: 'no-store',
                });

                if (response.ok && !cancelled) {
                    const data = await response.json() as { found?: boolean; serverId?: string };
                    setIsCustomDashboardHost(Boolean(data.found && data.serverId === String(id)));
                }
            } catch {
                if (!cancelled) {
                    setIsCustomDashboardHost(false);
                }
            }

            try {
                const infoResponse = await fetch(`/api/custom-dashboard/${encodeURIComponent(String(id))}`, {
                    cache: 'no-store',
                });

                if (!infoResponse.ok || cancelled) return;

                const info = await infoResponse.json() as CustomDashboardInfo;
                if (info.subdomain || info.hostname) {
                    setCustomDashboardInfo(info);
                    setHasCustomDashboardSetup(true);
                } else {
                    setCustomDashboardInfo(null);
                }
            } catch {
                if (!cancelled) {
                    setCustomDashboardInfo(null);
                }
            }
        }

        loadCustomDashboardContext();

        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        if (!id || !(userPermissions?.is_admin || userPermissions?.can_manage_settings)) {
            setHasCustomDashboardSetup(false);
            return;
        }

        let cancelled = false;

        async function loadCustomDashboardAvailability() {
            try {
                const response = await fetch(`/api/dashboard/custom-dashboard?serverId=${encodeURIComponent(String(id))}`, {
                    cache: 'no-store',
                });

                if (!cancelled) {
                    setHasCustomDashboardSetup(response.ok);
                }
            } catch {
                if (!cancelled) {
                    setHasCustomDashboardSetup(false);
                }
            }
        }

        loadCustomDashboardAvailability();

        return () => {
            cancelled = true;
        };
    }, [id, userPermissions?.is_admin, userPermissions?.can_manage_settings]);

    useEffect(() => {
        function handleCustomDashboardPreview(event: Event) {
            const customEvent = event as CustomEvent<CustomDashboardPreview | null>;
            setCustomDashboardPreview(customEvent.detail || null);
        }

        function handleCustomDashboardSaved(event: Event) {
            const customEvent = event as CustomEvent<CustomDashboardInfo | null>;
            const dashboard = customEvent.detail;
            if (!dashboard || (!dashboard.subdomain && !dashboard.hostname)) return;

            setCustomDashboardInfo((current) => ({
                ...current,
                ...dashboard,
                name: dashboard.metadata?.title || dashboard.name || current?.name || 'Ro-Link',
                icon: dashboard.icon ?? current?.icon ?? null,
            }));
            setHasCustomDashboardSetup(true);
        }

        window.addEventListener('rolink:custom-dashboard-preview', handleCustomDashboardPreview);
        window.addEventListener('rolink:custom-dashboard-saved', handleCustomDashboardSaved);

        return () => {
            window.removeEventListener('rolink:custom-dashboard-preview', handleCustomDashboardPreview);
            window.removeEventListener('rolink:custom-dashboard-saved', handleCustomDashboardSaved);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        let inFlight = false;

        async function measureApiLatency() {
            if (cancelled || inFlight) return;

            inFlight = true;
            setApiLatencyState((current) => current === 'ready' ? current : 'measuring');

            const startedAt = performance.now();

            try {
                const response = await fetch(`/api/ping?ts=${Date.now()}`, {
                    cache: 'no-store',
                });

                if (!response.ok) {
                    throw new Error(`Ping failed with ${response.status}`);
                }

                const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
                if (!cancelled) {
                    setApiLatencyMs(durationMs);
                    setApiLatencyState('ready');
                }
            } catch (error) {
                console.error('[Dashboard] Failed to measure API latency:', error);
                if (!cancelled) {
                    setApiLatencyState('error');
                }
            } finally {
                inFlight = false;
            }
        }

        const intervalId = window.setInterval(measureApiLatency, 30000);
        measureApiLatency();

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, []);

    // Close sidebar and full-screen menu overlay on pathname change
    useEffect(() => {
        setIsSidebarOpen(false);
        setIsDrawerMenuOpen(false);
    }, [pathname]);

    // Sync active category with pathname for split double sidebar
    useEffect(() => {
        if (!pathname) return;
        if (pathname.includes('/settings')) {
            setActiveCategory('settings');
        } else if (pathname.includes('/lookup') || pathname.includes('/reports') || pathname.includes('/misc')) {
            setActiveCategory('moderation');
        } else {
            setActiveCategory('utility');
        }
    }, [pathname]);

    if (status === 'loading') return null;

    if (status === 'unauthenticated') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-white">
                <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-2xl shadow-black/30">
                    <img src="/Media/Ro-LinkIcon.png" alt="" className="mx-auto mb-5 h-12 w-12 rounded-xl" />
                    <h1 className="text-2xl font-bold tracking-tight">Sign in required</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        Sign in with Discord before accessing this Ro-Link dashboard.
                    </p>
                    <button
                        onClick={signInFromCustomDashboard}
                        className="mt-6 w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-sky-500"
                    >
                        Sign in with Discord
                    </button>
                </div>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-white">
                <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-2xl shadow-black/30">
                    <img src="/Media/Ro-LinkIcon.png" alt="" className="mx-auto mb-5 h-12 w-12 rounded-xl" />
                    <h1 className="text-2xl font-bold tracking-tight">Sorry, you do not have access to this dashboard.</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        If this is a mistake, please contact the server owner.
                    </p>
                </div>
            </div>
        );
    }

    if (loading || !userPermissions) return null;

    const networkState = apiLatencyState === 'error'
        ? { label: 'Unavailable', className: 'text-red-400' }
        : apiLatencyMs !== null && apiLatencyMs > 600
            ? { label: 'Degraded', className: 'text-red-400' }
            : apiLatencyMs !== null && apiLatencyMs > 250
                ? { label: 'Elevated', className: 'text-amber-400' }
                : apiLatencyState === 'measuring'
                    ? { label: 'Measuring', className: 'text-slate-400' }
                    : { label: 'Nominal', className: 'text-emerald-500' };

    const apiLatencyLabel = apiLatencyState === 'error'
        ? 'Unavailable'
        : apiLatencyMs !== null
            ? `${apiLatencyMs}ms`
            : '...';
    const canManageDashboardSettings = userPermissions.is_admin || userPermissions.can_manage_settings;
    const dashboardHomeHref = isCustomDashboardHost ? `/custom-dashboard/${id}` : '/dashboard';
    const hasConfiguredCustomDashboard = Boolean(customDashboardInfo?.subdomain || customDashboardInfo?.hostname);
    const isCustomDashboardStyled = Boolean(customDashboardPreview || hasConfiguredCustomDashboard || isCustomDashboardHost);
    const customDashboardMetadata = customDashboardPreview?.metadata || customDashboardInfo?.metadata;
    const customDashboardTheme = getCustomDashboardTheme(
        customDashboardPreview?.theme
        || customDashboardInfo?.theme
        || DEFAULT_CUSTOM_DASHBOARD_THEME,
    );
    const customDashboardLayout = customDashboardPreview?.layout
        || customDashboardInfo?.layout
        || DEFAULT_CUSTOM_DASHBOARD_LAYOUT;
    const customDashboardLogo = isCustomDashboardStyled
        ? customDashboardMetadata?.logoUrl || (customDashboardInfo?.icon ? `https://cdn.discordapp.com/icons/${id}/${customDashboardInfo.icon}.png` : '/Media/Ro-LinkIcon.png')
        : '/Media/Ro-LinkIcon.png';
    const customDashboardBrand = isCustomDashboardStyled
        ? customDashboardMetadata?.title || customDashboardInfo?.name || 'Ro-Link'
        : 'Ro-Link';
    const customDashboardStyle: CSSProperties | undefined = isCustomDashboardStyled ? {
        '--custom-dashboard-accent': customDashboardTheme.accent,
        '--custom-dashboard-accent-text': customDashboardTheme.accentText,
        '--custom-dashboard-accent-soft': customDashboardTheme.softBg,
        '--custom-dashboard-accent-border': customDashboardTheme.border,
        '--custom-dashboard-gradient': customDashboardTheme.gradient,
        '--custom-dashboard-page': customDashboardTheme.pageBg,
        '--custom-dashboard-page-soft': customDashboardTheme.pageBgSoft,
        '--custom-dashboard-surface': customDashboardTheme.surfaceBg,
        '--custom-dashboard-surface-soft': customDashboardTheme.surfaceBgSoft,
        '--custom-dashboard-surface-strong': customDashboardTheme.surfaceBgStrong,
        '--custom-dashboard-text': customDashboardTheme.textPrimary,
        '--custom-dashboard-text-secondary': customDashboardTheme.textSecondary,
        '--custom-dashboard-text-muted': customDashboardTheme.textMuted,
        '--custom-dashboard-text-faint': customDashboardTheme.textFaint,
        '--custom-dashboard-neutral-border': customDashboardTheme.neutralBorder,
        '--custom-dashboard-neutral-border-strong': customDashboardTheme.neutralBorderStrong,
        background: customDashboardTheme.gradient,
    } as CSSProperties : undefined;

    function getNavLinkStyle(isActive: boolean) {
        if (!isCustomDashboardStyled || !isActive) {
            return undefined;
        }

        return {
            backgroundColor: customDashboardTheme.softBg,
            color: customDashboardTheme.accentText,
            borderColor: customDashboardTheme.border,
        };
    }

    function getNavIconStyle(isActive: boolean) {
        if (!isCustomDashboardStyled || !isActive) {
            return undefined;
        }

        return { color: customDashboardTheme.accent };
    }

    const utilityItems = [
        { label: "Home", icon: <HomeIcon />, href: `/dashboard/${id}` },
        { label: "Live Servers", icon: <ServersIcon />, href: `/dashboard/${id}/servers` },
        {
            label: "Verification",
            icon: <VerificationIcon />,
            href: `/dashboard/${id}/verification`
        },
        {
            label: "Modules",
            icon: <ModulesIcon />,
            href: `/dashboard/${id}/modules`,
            hide: !canManageDashboardSettings
        },
    ].filter(item => !item.hide);

    const moderationItems = [
        {
            label: "Player Lookup",
            icon: <LookupIcon />,
            href: `/dashboard/${id}/lookup`,
            hide: !userPermissions.can_lookup
        },
        {
            label: "Reports",
            icon: <ReportsIcon />,
            href: `/dashboard/${id}/reports`,
            hide: !userPermissions.can_manage_reports
        },
        {
            label: "Misc Actions",
            icon: <MagicIcon />,
            href: `/dashboard/${id}/misc`,
            hide: !userPermissions.is_admin && !hasAnyAdminPanelCommand(userPermissions.allowed_misc_cmds, MISC_ACTION_COMMAND_IDS)
        },
    ].filter(i => !i.hide);

    const settingItems = [
        {
            label: "Overview",
            icon: <OverviewIcon />,
            href: `/dashboard/${id}/settings`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Roles",
            icon: <RolesIcon />,
            href: `/dashboard/${id}/settings/roles`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Commands",
            icon: <CommandsIcon />,
            href: `/dashboard/${id}/settings/commands`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Reports",
            icon: <SettingsReportsIcon />,
            href: `/dashboard/${id}/settings/reports`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Dashboard",
            icon: <DashboardIcon />,
            href: `/dashboard/${id}/settings/dashboard`,
            hide: !canManageDashboardSettings || !hasCustomDashboardSetup
        },
        {
            label: "Logs",
            icon: <ScrollIcon />,
            href: `/dashboard/${id}/settings/logs`,
            hide: !canManageDashboardSettings
        },
    ].filter(item => !item.hide);

    // Compute dynamic Tailwind classes for responsive grid layouts
    const flexDirClass = ['spacious', 'floating_dock', 'minimalist_drawer'].includes(customDashboardLayout)
        ? 'md:flex-col'
        : 'md:flex-row';

    const mainMarginClass =
        customDashboardLayout === 'standard' ? 'md:ml-72' :
        customDashboardLayout === 'compact' ? 'md:ml-20' :
        customDashboardLayout === 'split_sidebar' ? 'md:ml-[296px]' :
        'md:ml-0';

    const mainPaddingClass =
        customDashboardLayout === 'floating_dock' ? 'pb-28 md:pb-28' : '';

    return (
        <div
            className={`custom-dashboard-shell min-h-screen bg-[#020617] text-slate-200 flex min-w-0 flex-col ${flexDirClass} font-sans`}
            data-custom-dashboard-themed={isCustomDashboardStyled ? 'true' : undefined}
            data-dashboard-layout={customDashboardLayout}
            style={customDashboardStyle}
        >
            {/* Sidebar Overlay (Mobile Drawer trigger) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300 animate-in fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* --- MOBILE DRAWER ASIDE (Always unified under classic standard style on mobile) --- */}
            <aside className={`
                fixed inset-y-0 left-0 w-[85vw] max-w-72 bg-[#020617] border-r border-slate-800 z-[70] 
                transform transition-transform duration-300 ease-in-out flex flex-col md:hidden
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                        <Link href={dashboardHomeHref} className="flex min-w-0 items-center gap-3 pl-2 hover:opacity-80 transition-opacity cursor-pointer">
                            <img src={customDashboardLogo} alt="" className="w-8 h-8 rounded object-cover shadow-lg shadow-sky-500/10" />
                            <span className="truncate text-xl font-black tracking-tighter text-white uppercase italic">{customDashboardBrand}</span>
                        </Link>
                        <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-white">
                            <CloseIcon />
                        </button>
                    </div>

                    <nav className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                        <div>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 ml-2">Utility</p>
                            <div className="space-y-1">
                                {utilityItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            style={getNavLinkStyle(isActive)}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                }`}
                                        >
                                            <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                {item.icon}
                                            </span>
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {moderationItems.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 ml-2">Moderation</p>
                                <div className="space-y-1">
                                    {moderationItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                style={getNavLinkStyle(isActive)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                    ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                            >
                                                <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {settingItems.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2">Settings</p>
                                <div className="space-y-1">
                                    {settingItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                style={getNavLinkStyle(isActive)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                    ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                            >
                                                <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </nav>

                    {!isCustomDashboardHost && (
                        <div className="mt-auto pt-6 border-t border-slate-800">
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all font-semibold text-sm group"
                            >
                                <BackIcon />
                                Back to Servers
                            </Link>
                        </div>
                    )}
                </div>
            </aside>

            {/* --- DESKTOP NAVIGATION LAYOUTS (Only rendered on desktop) --- */}

            {/* 1. Classic Left Sidebar Layout */}
            {customDashboardLayout === 'standard' && (
                <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-72 border-r border-slate-800 bg-[#020617]/50 backdrop-blur-md z-[40]">
                    <div className="p-6 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8">
                            <Link href={dashboardHomeHref} className="flex min-w-0 items-center gap-3 pl-2 hover:opacity-80 transition-opacity cursor-pointer">
                                <img src={customDashboardLogo} alt="" className="w-8 h-8 rounded object-cover shadow-lg shadow-sky-500/10" />
                                <span className="truncate text-xl font-black tracking-tighter text-white uppercase italic">{customDashboardBrand}</span>
                            </Link>
                        </div>

                        <nav className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                            <div>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 ml-2">Utility</p>
                                <div className="space-y-1">
                                    {utilityItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                style={getNavLinkStyle(isActive)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                    ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                            >
                                                <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {moderationItems.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 ml-2">Moderation</p>
                                    <div className="space-y-1">
                                        {moderationItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    style={getNavLinkStyle(isActive)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                        ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                        }`}
                                            >
                                                <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                    </div>
                                </div>
                            )}

                            {settingItems.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2">Settings</p>
                                    <div className="space-y-1">
                                        {settingItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    style={getNavLinkStyle(isActive)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                        ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                        }`}
                                                >
                                                    <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                        {item.icon}
                                                    </span>
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </nav>

                        {!isCustomDashboardHost && (
                            <div className="mt-auto pt-6 border-t border-slate-800">
                                <Link
                                    href="/dashboard"
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all font-semibold text-sm group"
                                >
                                    <BackIcon />
                                    Back to Servers
                                </Link>
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* 2. Slim Left Dock Layout */}
            {customDashboardLayout === 'compact' && (
                <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-20 border-r border-slate-800 bg-[#020617]/50 backdrop-blur-md items-center py-6 z-[40]">
                    <Link href={dashboardHomeHref} className="mb-8 hover:opacity-80 transition-opacity">
                        <img src={customDashboardLogo} alt="" className="w-9 h-9 rounded object-cover shadow-lg shadow-sky-500/10" />
                    </Link>

                    <nav className="flex-1 w-full px-2 flex flex-col items-center gap-4 overflow-y-auto custom-scrollbar">
                        {[...utilityItems, ...moderationItems, ...settingItems].map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <div key={item.href} className="relative group">
                                    <Link
                                        href={item.href}
                                        style={getNavLinkStyle(isActive)}
                                        className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all border ${isActive
                                            ? "bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/10"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent"
                                            }`}
                                    >
                                        <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                            {item.icon}
                                        </span>
                                    </Link>
                                    {/* Tooltip */}
                                    <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-x-2 group-hover:translate-x-0">
                                        {item.label}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>

                    {!isCustomDashboardHost && (
                        <div className="mt-auto pt-6 border-t border-slate-800 w-full flex justify-center relative group">
                            <Link
                                href="/dashboard"
                                className="flex items-center justify-center w-12 h-12 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all"
                            >
                                <BackIcon />
                            </Link>
                            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-x-2 group-hover:translate-x-0">
                                Back to Servers
                            </div>
                        </div>
                    )}
                </aside>
            )}

            {/* 5. Split Multi-Level Sidebar Layout */}
            {customDashboardLayout === 'split_sidebar' && (
                <aside className="hidden md:flex flex-row fixed inset-y-0 left-0 w-[296px] border-r border-slate-800 bg-[#020617]/50 backdrop-blur-md z-[40]">
                    {/* Category Switcher Column (Leftmost) */}
                    <div className="w-16 flex flex-col items-center py-6 border-r border-slate-800/80 bg-slate-950/20 h-full">
                        <Link href={dashboardHomeHref} className="mb-8 hover:opacity-80 transition-opacity">
                            <img src={customDashboardLogo} alt="" className="w-9 h-9 rounded object-cover shadow-lg shadow-sky-500/10" />
                        </Link>

                        <div className="flex-1 w-full px-2 flex flex-col items-center gap-5">
                            {/* Utility Category */}
                            <button
                                onClick={() => setActiveCategory('utility')}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 border ${activeCategory === 'utility'
                                    ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/5'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border-transparent'
                                }`}
                            >
                                <HomeIcon />
                            </button>

                            {/* Moderation Category */}
                            {moderationItems.length > 0 && (
                                <button
                                    onClick={() => setActiveCategory('moderation')}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 border ${activeCategory === 'moderation'
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/5'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <ShieldIcon />
                                </button>
                            )}

                            {/* Settings Category */}
                            {settingItems.length > 0 && (
                                <button
                                    onClick={() => setActiveCategory('settings')}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 border ${activeCategory === 'settings'
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/5'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                                </button>
                            )}
                        </div>

                        {!isCustomDashboardHost && (
                            <div className="mt-auto pt-6 border-t border-slate-800/80 w-full flex justify-center">
                                <Link
                                    href="/dashboard"
                                    className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all"
                                >
                                    <BackIcon />
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Items Listing Column (Rightmost) */}
                    <div className="w-[232px] flex flex-col py-6 px-4 h-full">
                        <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase mb-6 ml-2 italic">
                            {activeCategory === 'utility' ? 'Utility' : activeCategory === 'moderation' ? 'Moderation' : 'Settings'}
                        </h3>

                        <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
                            {activeCategory === 'utility' && utilityItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        style={getNavLinkStyle(isActive)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                            ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                            }`}
                                    >
                                        <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </Link>
                                );
                            })}

                            {activeCategory === 'moderation' && moderationItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        style={getNavLinkStyle(isActive)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                            ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                            }`}
                                    >
                                        <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </Link>
                                );
                            })}

                            {activeCategory === 'settings' && settingItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        style={getNavLinkStyle(isActive)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                            ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                            }`}
                                    >
                                        <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </aside>
            )}

            {/* --- MAIN CONTENT AREA --- */}
            <main className={`flex-1 min-w-0 ${mainMarginClass} ${mainPaddingClass} min-h-screen flex flex-col`}>
                <header className="sticky top-0 z-50 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#020617]/80 px-4 py-3 backdrop-blur-md md:h-16 md:flex-nowrap md:px-10 md:py-0">
                    <div className="flex min-w-0 items-center gap-3 h-full">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <HamburgerIcon />
                        </button>

                        {/* Brand Logo & Name (Visible on desktop for top-nav/floating-dock/minimalist-drawer) */}
                        {['spacious', 'floating_dock', 'minimalist_drawer'].includes(customDashboardLayout) && (
                            <Link href={dashboardHomeHref} className="hidden md:flex min-w-0 items-center gap-3 mr-6 hover:opacity-80 transition-opacity cursor-pointer">
                                <img src={customDashboardLogo} alt="" className="w-8 h-8 rounded object-cover shadow-lg shadow-sky-500/10" />
                                <span className="truncate text-lg font-black tracking-tighter text-white uppercase italic">{customDashboardBrand}</span>
                            </Link>
                        )}

                        {/* Top-Nav Desktop Horizontal Menu Bar (spacious) */}
                        {customDashboardLayout === 'spacious' && (
                            <div className="hidden md:flex items-center gap-6 mr-6 h-full">
                                {/* Utility Menu */}
                                <div className="relative group h-full flex items-center">
                                    <button className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors py-2">
                                        Utility
                                        <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="m19 9-7 7-7-7"/></svg>
                                    </button>
                                    <div className="absolute top-[80%] left-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-xl rounded-xl p-2 min-w-[200px] shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                        {utilityItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    style={getNavLinkStyle(isActive)}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isActive
                                                        ? 'bg-sky-600/10 text-sky-400 border border-sky-500/10'
                                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                                                    }`}
                                                >
                                                    <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500'}>{item.icon}</span>
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Moderation Menu */}
                                {moderationItems.length > 0 && (
                                    <div className="relative group h-full flex items-center">
                                        <button className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors py-2">
                                            Moderation
                                            <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="m19 9-7 7-7-7"/></svg>
                                        </button>
                                        <div className="absolute top-[80%] left-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-xl rounded-xl p-2 min-w-[200px] shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                            {moderationItems.map((item) => {
                                                const isActive = pathname === item.href;
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        style={getNavLinkStyle(isActive)}
                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isActive
                                                            ? 'bg-sky-600/10 text-sky-400 border border-sky-500/10'
                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                                                        }`}
                                                    >
                                                        <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500'}>{item.icon}</span>
                                                        {item.label}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Settings Menu */}
                                {settingItems.length > 0 && (
                                    <div className="relative group h-full flex items-center">
                                        <button className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors py-2">
                                            Settings
                                            <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="m19 9-7 7-7-7"/></svg>
                                        </button>
                                        <div className="absolute top-[80%] left-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-xl rounded-xl p-2 min-w-[200px] shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                            {settingItems.map((item) => {
                                                const isActive = pathname === item.href;
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        style={getNavLinkStyle(isActive)}
                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isActive
                                                            ? 'bg-sky-600/10 text-sky-400 border border-sky-500/10 font-bold'
                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                                                        }`}
                                                    >
                                                        <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500'}>{item.icon}</span>
                                                        {item.label}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Back to Servers */}
                                {!isCustomDashboardHost && (
                                    <Link
                                        href="/dashboard"
                                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-white transition-all py-2"
                                    >
                                        <BackIcon />
                                        Exit
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* Minimalist Drawer Navigation Trigger (minimalist_drawer) */}
                        {customDashboardLayout === 'minimalist_drawer' && (
                            <button
                                onClick={() => setIsDrawerMenuOpen(true)}
                                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-850 backdrop-blur-md text-xs font-bold text-slate-300 hover:text-white hover:border-sky-500/30 transition-all mr-4"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                Navigation Menu
                            </button>
                        )}

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:block">Server ID</span>
                            <div className="h-4 w-[1px] bg-slate-800 mx-2 hidden sm:block"></div>
                            <code className="max-w-[180px] truncate rounded border border-sky-400/10 bg-sky-400/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-sky-400 sm:max-w-none">
                                {id}
                            </code>
                        </div>
                    </div>

                    <div className="flex w-full items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 sm:w-auto sm:justify-end sm:gap-6">
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)] ${networkState.className === 'text-emerald-500'
                                ? 'bg-emerald-500'
                                : networkState.className === 'text-amber-400'
                                    ? 'bg-amber-400'
                                    : networkState.className === 'text-red-400'
                                        ? 'bg-red-400'
                                        : 'bg-slate-400'
                                }`}></div>
                            <span className="hidden xs:inline">Network:</span> <span className={networkState.className}>{networkState.label}</span>
                        </div>
                        <div className="h-3 w-[1px] bg-slate-800 hidden sm:block"></div>
                        <span className="hidden sm:inline">API Latency:</span> <span className={`hidden sm:inline ${apiLatencyState === 'error' ? 'text-red-400' : 'text-sky-500'}`}>{apiLatencyLabel}</span>
                    </div>
                </header>

                <div className="dashboard-content-frame motion-page min-w-0 flex-1 bg-gradient-to-tr from-[#020617] via-[#020617] to-sky-950/5 p-4 md:p-10">
                    <PermissionsProvider permissions={userPermissions}>
                        {children}
                    </PermissionsProvider>
                </div>
            </main>

            {/* 3. Floating Bottom Dock Layout */}
            {customDashboardLayout === 'floating_dock' && (
                <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#090d16]/75 border border-slate-800/80 backdrop-blur-xl rounded-2xl px-4 py-3 items-center gap-3.5 shadow-2xl shadow-black/80 z-[40] transition-all duration-350 hover:border-sky-500/30 hover:shadow-sky-500/10">
                    {/* Utility Items */}
                    {utilityItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <div key={item.href} className="relative group">
                                <Link
                                    href={item.href}
                                    style={getNavLinkStyle(isActive)}
                                    className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border hover:scale-115 active:scale-95 duration-150 ${isActive
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    {item.label}
                                </div>
                            </div>
                        );
                    })}

                    {/* Divider */}
                    {moderationItems.length > 0 && <div className="w-[1px] h-6 bg-slate-800/80" />}

                    {/* Moderation Items */}
                    {moderationItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <div key={item.href} className="relative group">
                                <Link
                                    href={item.href}
                                    style={getNavLinkStyle(isActive)}
                                    className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border hover:scale-115 active:scale-95 duration-150 ${isActive
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    {item.label}
                                </div>
                            </div>
                        );
                    })}

                    {/* Divider */}
                    {settingItems.length > 0 && <div className="w-[1px] h-6 bg-slate-800/80" />}

                    {/* Settings Items */}
                    {settingItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <div key={item.href} className="relative group">
                                <Link
                                    href={item.href}
                                    style={getNavLinkStyle(isActive)}
                                    className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border hover:scale-115 active:scale-95 duration-150 ${isActive
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    {item.label}
                                </div>
                            </div>
                        );
                    })}

                    {/* Exit Button */}
                    {!isCustomDashboardHost && (
                        <>
                            <div className="w-[1px] h-6 bg-slate-800/80" />
                            <div className="relative group">
                                <Link
                                    href="/dashboard"
                                    className="flex items-center justify-center w-11 h-11 rounded-xl transition-all border text-slate-500 hover:text-white hover:bg-slate-800/40 border-transparent hover:scale-115 active:scale-95 duration-150"
                                >
                                    <BackIcon />
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    Back to Servers
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 6. Minimalist Drawer Navigation Overlay (revealed full-screen when trigger clicked) */}
            {isDrawerMenuOpen && customDashboardLayout === 'minimalist_drawer' && (
                <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl z-[99] flex flex-col items-center justify-center p-6 md:p-24 transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
                    <button
                        onClick={() => setIsDrawerMenuOpen(false)}
                        className="absolute top-8 right-8 p-3 rounded-full border border-slate-800 text-slate-400 hover:text-white hover:rotate-90 hover:border-sky-500/30 transition-all duration-300 bg-slate-900/60 backdrop-blur-md"
                    >
                        <CloseIcon />
                    </button>

                    <div className="w-full max-w-5xl flex flex-col gap-12">
                        <div className="flex flex-col items-center text-center">
                            <img src={customDashboardLogo} alt="" className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-xl shadow-sky-500/10" />
                            <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white">{customDashboardBrand}</h2>
                            <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">Dashboard Navigation Hub</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Column 1: Utility */}
                            <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4">
                                <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase border-b border-slate-800/80 pb-2">Utility</h3>
                                <div className="flex flex-col gap-2">
                                    {utilityItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setIsDrawerMenuOpen(false)}
                                                style={getNavLinkStyle(isActive)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                    ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                }`}
                                            >
                                                <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Column 2: Moderation */}
                            {moderationItems.length > 0 && (
                                <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4">
                                    <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase border-b border-slate-800/80 pb-2">Moderation</h3>
                                    <div className="flex flex-col gap-2">
                                        {moderationItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setIsDrawerMenuOpen(false)}
                                                    style={getNavLinkStyle(isActive)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                        ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                                >
                                                    <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                                        {item.icon}
                                                    </span>
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Column 3: Settings */}
                            {settingItems.length > 0 && (
                                <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4">
                                    <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase border-b border-slate-800/80 pb-2">Settings</h3>
                                    <div className="flex flex-col gap-2 font-sans">
                                        {settingItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setIsDrawerMenuOpen(false)}
                                                    style={getNavLinkStyle(isActive)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                        ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                                >
                                                    <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                                        {item.icon}
                                                    </span>
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Back button */}
                        {!isCustomDashboardHost && (
                            <div className="flex justify-center mt-6">
                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsDrawerMenuOpen(false)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all font-semibold text-sm"
                                >
                                    <BackIcon />
                                    Back to Servers
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
