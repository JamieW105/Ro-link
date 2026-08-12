'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getDiscordGuildIconProxyUrl } from '@/lib/discordMedia';
import {
    DEFAULT_CUSTOM_DASHBOARD_THEME,
    getCustomDashboardTheme,
    type CustomDashboardLayout,
    type CustomDashboardMetadata,
    type CustomDashboardTheme,
} from '@/lib/customDashboardSettings';

interface DashboardInfo {
    id: string;
    name: string;
    icon?: string | null;
    layout?: CustomDashboardLayout;
    theme?: CustomDashboardTheme;
    metadata?: CustomDashboardMetadata;
    hostname?: string;
}

interface DashboardPermissions {
    can_access_dashboard: boolean;
    can_access_live_panel: boolean;
    is_admin: boolean;
}

export default function CustomDashboardLandingPage() {
    const { serverId } = useParams();
    const router = useRouter();
    const { status } = useSession();
    const [dashboard, setDashboard] = useState<DashboardInfo | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [accessError, setAccessError] = useState<'reauthenticate' | 'unavailable' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!serverId) return;

        async function loadDashboardInfo() {
            try {
                const res = await fetch(`/api/custom-dashboard/${encodeURIComponent(String(serverId))}`, { cache: 'no-store' });
                if (res.ok) {
                    setDashboard(await res.json());
                }
            } finally {
                setLoading(false);
            }
        }

        loadDashboardInfo();
    }, [serverId]);

    useEffect(() => {
        if (status !== 'authenticated' || !serverId) return;

        async function checkAccess() {
            try {
                const res = await fetch(`/api/user/permissions?serverId=${encodeURIComponent(String(serverId))}`, { cache: 'no-store' });
                if (!res.ok) {
                    if (res.status === 401) {
                        setAccessError('reauthenticate');
                    } else if (res.status === 403) {
                        setAccessDenied(true);
                    } else {
                        setAccessError('unavailable');
                    }
                    return;
                }

                const permissions = await res.json() as DashboardPermissions | null;
                if (permissions?.is_admin || permissions?.can_access_dashboard) {
                    router.replace(`/dashboard/${serverId}`);
                    return;
                }

                setAccessDenied(true);
            } catch {
                setAccessError('unavailable');
            }
        }

        checkAccess();
    }, [router, serverId, status]);

    function handleSignIn() {
        window.location.href = `/api/auth/custom-dashboard?callbackUrl=${encodeURIComponent(window.location.href)}`;
    }

    const serverName = dashboard?.name || 'this server';
    const theme = getCustomDashboardTheme(dashboard?.theme || DEFAULT_CUSTOM_DASHBOARD_THEME);
    const iconUrl = dashboard?.metadata?.logoUrl
        || (dashboard?.icon
        ? getDiscordGuildIconProxyUrl(dashboard.id, dashboard.icon)
            : '/Media/Ro-LinkIcon.png');
    const description = dashboard?.metadata?.description
        || 'Use Discord to continue. Ro-Link will check whether your account has permission to access this dashboard.';

    if (loading || status === 'loading') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]" style={{ background: theme.gradient }}>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: theme.accent, borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (accessDenied || accessError) {
        const requiresSignIn = accessError === 'reauthenticate';
        const temporarilyUnavailable = accessError === 'unavailable';
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-white" style={{ background: theme.gradient }}>
                <div className="w-full max-w-md rounded-2xl border bg-slate-900/70 p-8 text-center shadow-2xl shadow-black/30" style={{ borderColor: theme.border }}>
                    <img src={iconUrl} alt="" className="mx-auto mb-5 h-14 w-14 rounded-xl bg-slate-800 object-cover" />
                    <h1 className="text-2xl font-bold tracking-tight">
                        {requiresSignIn
                            ? 'Your Discord session has expired.'
                            : temporarilyUnavailable
                                ? 'Dashboard access could not be checked.'
                                : 'Sorry, you do not have access to this dashboard.'}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        {requiresSignIn
                            ? 'Sign in again to continue.'
                            : temporarilyUnavailable
                                ? 'Discord or Ro-Link may be temporarily unavailable. Please try again.'
                                : 'If this is a mistake, please contact the server owner.'}
                    </p>
                    {(requiresSignIn || temporarilyUnavailable) && (
                        <button
                            type="button"
                            onClick={() => requiresSignIn ? handleSignIn() : window.location.reload()}
                            className="mt-6 w-full rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:brightness-110"
                            style={{ backgroundColor: theme.accent }}
                        >
                            {requiresSignIn ? 'Sign in with Discord' : 'Try again'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-white" style={{ background: theme.gradient }}>
            <div className="w-full max-w-md rounded-2xl border bg-slate-900/70 p-8 text-center shadow-2xl shadow-black/30" style={{ borderColor: theme.border }}>
                <img src={iconUrl} alt="" className="mx-auto mb-5 h-14 w-14 rounded-xl bg-slate-800 object-cover" />
                {dashboard?.hostname && (
                    <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.accentText }}>
                        {dashboard.hostname}
                    </p>
                )}
                <h1 className="text-2xl font-bold tracking-tight">Sign into {serverName} Dashboard</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                    {description}
                </p>
                {dashboard?.metadata?.supportUrl && (
                    <a
                        href={dashboard.metadata.supportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex text-xs font-bold uppercase tracking-widest hover:text-white"
                        style={{ color: theme.accentText }}
                    >
                        Contact Support
                    </a>
                )}
                <button
                    onClick={handleSignIn}
                    className="mt-6 w-full rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:brightness-110"
                    style={{ backgroundColor: theme.accent }}
                >
                    Sign in with Discord
                </button>
            </div>
        </div>
    );
}

