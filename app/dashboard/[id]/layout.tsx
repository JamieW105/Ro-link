'use client';

import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
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
    name: string;
    icon?: string | null;
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

const LookupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
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

        async function detectCustomDashboardHost() {
            try {
                const response = await fetch(`/api/custom-dashboard/resolve?hostname=${encodeURIComponent(window.location.hostname)}`, {
                    cache: 'no-store',
                });

                if (!response.ok || cancelled) return;

                const data = await response.json() as { found?: boolean; serverId?: string };
                if (!cancelled) {
                    const isCurrentCustomDashboard = Boolean(data.found && data.serverId === String(id));
                    setIsCustomDashboardHost(isCurrentCustomDashboard);

                    if (isCurrentCustomDashboard) {
                        const infoResponse = await fetch(`/api/custom-dashboard/${encodeURIComponent(String(id))}`, {
                            cache: 'no-store',
                        });

                        if (infoResponse.ok && !cancelled) {
                            setCustomDashboardInfo(await infoResponse.json() as CustomDashboardInfo);
                        }
                    } else {
                        setCustomDashboardInfo(null);
                    }
                }
            } catch {
                if (!cancelled) {
                    setIsCustomDashboardHost(false);
                    setCustomDashboardInfo(null);
                }
            }
        }

        detectCustomDashboardHost();

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

        window.addEventListener('rolink:custom-dashboard-preview', handleCustomDashboardPreview);

        return () => {
            window.removeEventListener('rolink:custom-dashboard-preview', handleCustomDashboardPreview);
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

    // Close sidebar on pathname change (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
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
    const isCustomDashboardStyled = Boolean(customDashboardPreview || isCustomDashboardHost);
    const customDashboardMetadata = customDashboardPreview?.metadata || customDashboardInfo?.metadata;
    const customDashboardTheme = getCustomDashboardTheme(
        customDashboardPreview?.theme
        || (isCustomDashboardHost ? customDashboardInfo?.theme : undefined)
        || DEFAULT_CUSTOM_DASHBOARD_THEME,
    );
    const customDashboardLayout = customDashboardPreview?.layout
        || (isCustomDashboardHost ? customDashboardInfo?.layout : undefined)
        || DEFAULT_CUSTOM_DASHBOARD_LAYOUT;
    const customDashboardLogo = isCustomDashboardStyled
        ? customDashboardMetadata?.logoUrl || (customDashboardInfo?.icon ? `https://cdn.discordapp.com/icons/${id}/${customDashboardInfo.icon}.png` : '/Media/Ro-LinkIcon.png')
        : '/Media/Ro-LinkIcon.png';
    const customDashboardBrand = isCustomDashboardStyled
        ? customDashboardMetadata?.title || customDashboardInfo?.name || 'Ro-Link'
        : 'Ro-Link';

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
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                </svg>
            ),
            href: `/dashboard/${id}/verification`
        },
        {
            label: "Modules",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                </svg>
            ),
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
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            ),
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

    const ScrollIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" /><path d="M12 11V7" /><path d="M12 17v-2" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h8" /></svg>
    );

    const settingItems = [
        {
            label: "Overview",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
                </svg>
            ),
            href: `/dashboard/${id}/settings`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Roles",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" />
                </svg>
            ),
            href: `/dashboard/${id}/settings/roles`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Commands",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
                </svg>
            ),
            href: `/dashboard/${id}/settings/commands`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Reports",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" />
                </svg>
            ),
            href: `/dashboard/${id}/settings/reports`,
            hide: !canManageDashboardSettings
        },
        {
            label: "Dashboard",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="14" x="3" y="5" rx="2" /><path d="M7 9h10" /><path d="M7 13h4" />
                </svg>
            ),
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

    return (
        <div
            className="custom-dashboard-shell min-h-screen bg-[#020617] text-slate-200 flex min-w-0 flex-col md:flex-row font-sans"
            data-dashboard-layout={customDashboardLayout}
            style={isCustomDashboardStyled ? { background: customDashboardTheme.gradient } : undefined}
        >
            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar (Desktop & Mobile Drawer) */}
            <aside className={`
                fixed inset-y-0 left-0 w-[85vw] max-w-72 bg-[#020617] border-r border-slate-800 z-[70] 
                transform transition-transform duration-300 ease-in-out flex flex-col
                md:w-72 md:max-w-none md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                        <Link href={dashboardHomeHref} className="flex min-w-0 items-center gap-3 pl-2 hover:opacity-80 transition-opacity cursor-pointer">
                            <img src={customDashboardLogo} alt="" className="w-8 h-8 rounded object-cover shadow-lg shadow-sky-500/10" />
                            <span className="truncate text-xl font-black tracking-tighter text-white uppercase italic">{customDashboardBrand}</span>
                        </Link>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-500 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
                                            <span
                                                style={getNavIconStyle(isActive)}
                                                className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}
                                            >
                                                {item.icon}
                                            </span>
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

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
                                            <span
                                                style={getNavIconStyle(isActive)}
                                                className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}
                                            >
                                                {item.icon}
                                            </span>
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

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
                                                <span
                                                    style={getNavIconStyle(isActive)}
                                                    className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}
                                                >
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

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 md:ml-72 min-h-screen flex flex-col">
                <header className="sticky top-0 z-50 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#020617]/80 px-4 py-3 backdrop-blur-md md:h-16 md:flex-nowrap md:px-10 md:py-0">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </button>

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

                <div className="dashboard-content-frame min-w-0 flex-1 bg-gradient-to-tr from-[#020617] via-[#020617] to-sky-950/5 p-4 md:p-10">
                    <PermissionsProvider permissions={userPermissions}>
                        {children}
                    </PermissionsProvider>
                </div>
            </main>
            <style>{`
                @media (min-width: 768px) {
                    .custom-dashboard-shell[data-dashboard-layout="compact"] aside {
                        width: 15rem;
                    }

                    .custom-dashboard-shell[data-dashboard-layout="compact"] main {
                        margin-left: 15rem;
                    }

                    .custom-dashboard-shell[data-dashboard-layout="compact"] .dashboard-content-frame {
                        padding: 1.5rem;
                    }

                    .custom-dashboard-shell[data-dashboard-layout="spacious"] aside {
                        width: 20rem;
                    }

                    .custom-dashboard-shell[data-dashboard-layout="spacious"] main {
                        margin-left: 20rem;
                    }

                    .custom-dashboard-shell[data-dashboard-layout="spacious"] .dashboard-content-frame {
                        padding: 3.25rem;
                    }
                }
            `}</style>
        </div>
    );
}
