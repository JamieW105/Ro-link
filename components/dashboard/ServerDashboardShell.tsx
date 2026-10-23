'use client';

import { DashboardChrome } from '@/components/dashboard/DashboardChrome';

import { Button } from '@/components/ui/button';


import { FileText as LucideFileText, Home as LucideHome, LayoutDashboard as LucideLayoutDashboard, MonitorPlay as LucideMonitorPlay, Package as LucidePackage, Rss as LucideRss, Search as LucideSearch, Server as LucideServer, Settings as LucideSettings, ShieldCheck as LucideShieldCheck, TriangleAlert as LucideTriangleAlert, UserCheck as LucideUserCheck, WandSparkles as LucideWandSparkles } from 'lucide-react';

import { useParams, usePathname } from "next/navigation";
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
import { signIn, useSession } from "next-auth/react";
import { PermissionsProvider } from "@/context/PermissionsContext";

interface DashboardPermissions {
    can_access_dashboard: boolean;
    can_access_live_panel: boolean;
    can_kick: boolean;
    can_ban: boolean;
    can_timeout: boolean;
    can_mute: boolean;
    can_lookup: boolean;
    can_manage_reports: boolean;
    can_view_logs: boolean;
    can_view_runtime_logs: boolean;
    can_manage_staff_notes: boolean;
    can_manage_settings: boolean;
    allowed_misc_cmds: string[];
    is_admin: boolean;
}

type DashboardAccessError = 'denied' | 'reauthenticate' | 'unavailable' | null;

function isDashboardPermissions(value: unknown): value is DashboardPermissions {
    if (!value || typeof value !== 'object') return false;

    const permissions = value as Partial<DashboardPermissions>;
    return typeof permissions.is_admin === 'boolean'
        && typeof permissions.can_access_dashboard === 'boolean'
        && typeof permissions.can_access_live_panel === 'boolean';
}

function canAccessDashboardRoute(perms: DashboardPermissions, pathname: string) {
    const livePanelRoute = pathname.includes('/live-panel');
    const profileRoute = pathname.includes('/players/');

    if (livePanelRoute) {
        return perms.is_admin || perms.can_access_live_panel;
    }

    if (profileRoute) {
        return perms.is_admin || perms.can_access_dashboard || perms.can_access_live_panel;
    }

    return perms.is_admin || perms.can_access_dashboard;
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
    <LucideHome width="18" height="18" />
);

const ServersIcon = () => (
    <LucideServer width="18" height="18" />
);

const LivePanelIcon = () => (
    <LucideMonitorPlay width="18" height="18" />
);

const MagicIcon = () => (
    <LucideWandSparkles width="18" height="18" />
);

const LookupIcon = () => (
    <LucideSearch width="18" height="18" />
);

const VerificationIcon = () => (
    <LucideShieldCheck width="18" height="18" />
);

const ModulesIcon = () => (
    <LucidePackage width="18" height="18" />
);

const ReportsIcon = () => (
    <LucideTriangleAlert width="18" height="18" />
);

const ScrollIcon = () => (
    <LucideFileText width="18" height="18" />
);

const OverviewIcon = () => (
    <LucideSettings width="18" height="18" strokeWidth="2" />
);

const RolesIcon = () => (
    <LucideUserCheck width="18" height="18" />
);

const CommandsIcon = () => (
    <LucideRss width="18" height="18" />
);

const SettingsReportsIcon = () => (
    <LucideTriangleAlert width="18" height="18" />
);

const DashboardIcon = () => (
    <LucideLayoutDashboard width="18" height="18" />
);

export default function ServerLayout({ children }: { children: React.ReactNode }) {
    const { id } = useParams();
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [userPermissions, setUserPermissions] = useState<DashboardPermissions | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<DashboardAccessError>(null);
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

        let cancelled = false;

        async function checkAccess() {
            setLoading(true);
            setAccessError(null);
            try {
                const permsRes = await fetch(`/api/user/permissions?serverId=${encodeURIComponent(String(id))}`, {
                    cache: 'no-store',
                });
                const payload: unknown = await permsRes.json().catch(() => null);

                if (!permsRes.ok || !isDashboardPermissions(payload)) {
                    const nextError: DashboardAccessError = permsRes.status === 401
                        ? 'reauthenticate'
                        : permsRes.status === 403
                            ? 'denied'
                            : 'unavailable';
                    if (!cancelled) {
                        setAccessError(nextError);
                        setUserPermissions(null);
                    }
                    return;
                }

                if (!cancelled) {
                    setUserPermissions(payload);
                }
            } catch (err) {
                console.error("[Guard] Error checking access:", err);
                if (!cancelled) {
                    setAccessError('unavailable');
                    setUserPermissions(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        checkAccess();

        return () => {
            cancelled = true;
        };
    }, [session, id]);

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

    if (status === 'loading') return null;

    if (status === 'unauthenticated') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
                <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
                    <img src="/Media/Ro-LinkIcon.png" alt="" className="mx-auto mb-5 h-12 w-12 rounded-xl" />
                    <h1 className="text-2xl font-medium tracking-tight">Sign in required</h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Sign in with Discord before accessing this Ro-Link dashboard.
                    </p>
                    <Button variant="default" size="default"
                        onClick={signInFromCustomDashboard}
                        className="mt-6 w-full transition-all"
                    >
                        Sign in with Discord
                    </Button>
                </div>
            </div>
        );
    }

    if (accessError || (userPermissions && !canAccessDashboardRoute(userPermissions, pathname))) {
        const requiresSignIn = accessError === 'reauthenticate';
        const temporarilyUnavailable = accessError === 'unavailable';
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
                <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
                    <img src="/Media/Ro-LinkIcon.png" alt="" className="mx-auto mb-5 h-12 w-12 rounded-xl" />
                    <h1 className="text-2xl font-medium tracking-tight">
                        {requiresSignIn
                            ? 'Your Discord session has expired.'
                            : temporarilyUnavailable
                                ? 'Dashboard access could not be checked.'
                                : 'Sorry, you do not have access to this dashboard.'}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {requiresSignIn
                            ? 'Sign in again to continue.'
                            : temporarilyUnavailable
                                ? 'Discord or Ro-Link may be temporarily unavailable. Please try again.'
                                : 'If this is a mistake, please contact the server owner.'}
                    </p>
                    {(requiresSignIn || temporarilyUnavailable) && (
                        <Button variant="default" size="default"
                            type="button"
                            onClick={() => requiresSignIn
                                ? signIn('discord', { callbackUrl: window.location.href })
                                : window.location.reload()}
                            className="mt-6 w-full transition-all"
                        >
                            {requiresSignIn ? 'Sign in with Discord' : 'Try again'}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    if (loading || !userPermissions) return null;

    if (pathname.includes('/live-panel')) {
        return (
            <div className="h-screen min-h-screen overflow-hidden bg-background text-foreground font-sans">
                <PermissionsProvider permissions={userPermissions}>
                    {children}
                </PermissionsProvider>
            </div>
        );
    }

    const apiLatencyLabel = apiLatencyState === 'error'
        ? 'Unavailable'
        : apiLatencyMs !== null
            ? `${apiLatencyMs}ms`
            : '...';
    const canManageDashboardSettings = userPermissions.is_admin || userPermissions.can_manage_settings;
    const canUseStandardDashboard = userPermissions.is_admin || userPermissions.can_access_dashboard;
    const canUseLivePanel = userPermissions.is_admin || userPermissions.can_access_live_panel;
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
    const customDashboardBrand = isCustomDashboardStyled
        ? customDashboardMetadata?.title || customDashboardInfo?.name || 'Ro-Link'
        : 'Ro-Link';
    const customDashboardStyle: CSSProperties | undefined = isCustomDashboardStyled ? {
        '--dice-primary': customDashboardTheme.accent,
        '--dice-primary-foreground': '#171717',
        '--dice-ring': customDashboardTheme.accent,
    } as CSSProperties : undefined;

    const utilityItems = [
        { label: "Home", icon: <HomeIcon />, href: `/dashboard/${id}`, hide: !canUseStandardDashboard },
        { label: "Live Servers", icon: <ServersIcon />, href: `/dashboard/${id}/servers`, hide: !canUseStandardDashboard },
        { label: "Live Panel", icon: <LivePanelIcon />, href: `/dashboard/${id}/live-panel`, hide: !canUseLivePanel },
        {
            label: "Verification",
            icon: <VerificationIcon />,
            href: `/dashboard/${id}/verification`,
            hide: !canUseStandardDashboard
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
            label: "/cmds Logs",
            icon: <ScrollIcon />,
            href: `/dashboard/${id}/settings/logs`,
            hide: !userPermissions.is_admin && !userPermissions.can_view_logs
        },
    ].filter(item => !item.hide);

    return (
        <DashboardChrome
            key={pathname}
            groups={[
                { label: 'Workspace', items: utilityItems },
                { label: 'Moderation', items: moderationItems },
                { label: 'Settings', items: settingItems },
            ]}
            serverId={String(id)}
            brand={customDashboardBrand}
            userName={session?.user?.name || 'Discord user'}
            latency={apiLatencyLabel}
            online={apiLatencyState === 'ready'}
            homeHref={dashboardHomeHref}
            customHost={isCustomDashboardHost}
            layout={customDashboardLayout}
            style={customDashboardStyle}
        >
            <PermissionsProvider permissions={userPermissions}>{children}</PermissionsProvider>
        </DashboardChrome>
    );
}
