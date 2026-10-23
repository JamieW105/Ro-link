'use client';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';


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
    can_view_staff_shifts: boolean;
    can_manage_staff_shifts: boolean;
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

                if (permissions?.can_view_staff_shifts || permissions?.can_manage_staff_shifts) {
                    router.replace(`/dashboard/${serverId}/staff-shifts`);
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
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: theme.accent, borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (accessDenied || accessError) {
        const requiresSignIn = accessError === 'reauthenticate';
        const temporarilyUnavailable = accessError === 'unavailable';
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
                <Card className="w-full max-w-md rounded-xl border bg-card p-8 text-center">
                    <img src={iconUrl} alt="" className="mx-auto mb-5 h-14 w-14 rounded-xl bg-muted object-cover" />
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
                            onClick={() => requiresSignIn ? handleSignIn() : window.location.reload()}
                            className="mt-6 w-full transition-all hover:brightness-110"

                        >
                            {requiresSignIn ? 'Sign in with Discord' : 'Try again'}
                        </Button>
                    )}
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
            <Card className="w-full max-w-md rounded-xl border bg-card p-8 text-center">
                <img src={iconUrl} alt="" className="mx-auto mb-5 h-14 w-14 rounded-xl bg-muted object-cover" />
                {dashboard?.hostname && (
                    <p className="mb-4 font-mono text-xs font-medium">
                        {dashboard.hostname}
                    </p>
                )}
                <h1 className="text-2xl font-medium tracking-tight">Sign into {serverName} Dashboard</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
                {dashboard?.metadata?.supportUrl && (
                    <a
                        href={dashboard.metadata.supportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex text-xs font-medium hover:text-foreground"

                    >
                        Contact Support
                    </a>
                )}
                <Button variant="default" size="default"
                    onClick={handleSignIn}
                    className="mt-6 w-full transition-all hover:brightness-110"

                >
                    Sign in with Discord
                </Button>
            </Card>
        </div>
    );
}

