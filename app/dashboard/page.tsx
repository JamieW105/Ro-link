'use client';

import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';


import { BriefcaseBusiness as LucideBriefcaseBusiness } from 'lucide-react';

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from 'next/link';
import { getDiscordBotInviteUrl } from "@/lib/discordInvite";
import { getDiscordGuildIconProxyUrl, getDiscordMediaProxyUrl } from "@/lib/discordMedia";
import { LayoutDashboard, LogOut, MonitorPlay, Plus, ShieldAlert, Store } from "lucide-react";

const LogOutIcon = () => <LogOut size={14} aria-hidden="true" />;
const PlusIcon = () => <Plus size={14} strokeWidth={2.5} aria-hidden="true" />;
const SettingsIcon = () => <LayoutDashboard size={15} aria-hidden="true" />;
const MarketplaceIcon = () => <Store size={15} aria-hidden="true" />;
const LivePanelIcon = () => <MonitorPlay size={15} aria-hidden="true" />;

function ActionTooltip({ label }: { label: string }) {
    return (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 transition-all group-hover/server-action:translate-y-0 group-hover/server-action:opacity-100">
            {label}
        </span>
    );
}

function ServerIconLink({
    href,
    label,
    children,
    tone = 'default',
}: {
    href: string;
    label: string;
    children: ReactNode;
    tone?: 'default' | 'live' | 'market';
}) {
    const toneClass = tone === 'live'
        ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:border-emerald-200 hover:bg-emerald-50'
        : tone === 'market'
            ? 'border-border bg-accent text-foreground hover:border-border hover:bg-accent'
            : 'border-border bg-muted text-foreground hover:border-border hover:bg-accent hover:text-foreground';

    return (
        <Link
            href={href}
            aria-label={label}
            className={`group/server-action relative flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${toneClass}`}
        >
            {children}
            <ActionTooltip label={label} />
        </Link>
    );
}

interface Guild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: number | string;
    hasBot?: boolean;
    isRoleAccess?: boolean;
}

interface GuildDashboardPermissions {
    can_view_staff_shifts: boolean;
    can_manage_staff_shifts: boolean;
    can_access_dashboard: boolean;
    can_access_live_panel: boolean;
    is_admin: boolean;
}

type SessionUserWithId = {
    id?: string;
};

const ADMINISTRATOR_PERMISSION = 0x8n;
const MANAGE_GUILD_PERMISSION = 0x20n;

function canOpenMarketplaceFromServerList(guild: Guild) {
    if (guild.owner) {
        return true;
    }

    try {
        const permissions = BigInt(guild.permissions || 0);
        return (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION
            || (permissions & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
    } catch {
        return false;
    }
}

function compareGuildsByBotStatus(a: Guild, b: Guild) {
    if (a.hasBot === b.hasBot) {
        return 0;
    }

    return a.hasBot ? -1 : 1;
}

function canOpenDashboardAction(permissions?: GuildDashboardPermissions) {
    return Boolean(permissions?.is_admin || permissions?.can_access_dashboard);
}

function canOpenDashboardFromServerList(guild: Guild, permissions?: GuildDashboardPermissions) {
    return canOpenDashboardAction(permissions) || canOpenMarketplaceFromServerList(guild);
}

function canOpenLivePanelAction(permissions?: GuildDashboardPermissions) {
    return Boolean(permissions?.is_admin || permissions?.can_access_live_panel);
}

function canOpenLivePanelFromServerList(guild: Guild, permissions?: GuildDashboardPermissions) {
    return canOpenLivePanelAction(permissions) || canOpenMarketplaceFromServerList(guild);
}

export default function Dashboard() {
    const { data: session, status } = useSession();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [guildPermissions, setGuildPermissions] = useState<Record<string, GuildDashboardPermissions>>({});
    const [loading, setLoading] = useState(false);
    const [guildsError, setGuildsError] = useState<string | null>(null);
    const [needsReauthentication, setNeedsReauthentication] = useState(false);
    const sessionUserId = (session?.user as SessionUserWithId | undefined)?.id;
    const sortedGuilds = useMemo(() => [...guilds].sort(compareGuildsByBotStatus), [guilds]);

    function handleSignOut() {
        void signOut({ callbackUrl: '/auth/signin' });
    }

    useEffect(() => {
        let cancelled = false;

        async function loadGuilds() {
            if (status !== 'authenticated') return;

            setLoading(true);
            setGuildsError(null);
            setNeedsReauthentication(false);
            try {
                const response = await fetch('/api/guilds', { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok) {
                    if (response.status === 401) {
                        setNeedsReauthentication(true);
                    }
                    throw new Error(typeof data?.error === 'string' ? data.error : `Failed to load servers (${response.status})`);
                }
                if (!Array.isArray(data)) {
                    throw new Error('Failed to load servers.');
                }
                if (!cancelled) {
                    setGuilds(data);
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setGuilds([]);
                    setGuildsError(err instanceof Error ? err.message : 'Failed to load servers.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadGuilds();

        return () => {
            cancelled = true;
        };
    }, [status]);

    useEffect(() => {
        let cancelled = false;

        async function loadGuildPermissions() {
            const botGuilds = guilds.filter((guild) => guild.hasBot);
            if (status !== 'authenticated' || botGuilds.length === 0) {
                if (!cancelled) {
                    setGuildPermissions({});
                }
                return;
            }

            const entries = await Promise.all(
                botGuilds.map(async (guild) => {
                    try {
                        const response = await fetch(`/api/user/permissions?serverId=${encodeURIComponent(guild.id)}`, {
                            cache: 'no-store',
                        });
                        if (!response.ok) return null;
                        const permissions = await response.json() as GuildDashboardPermissions;
                        return [guild.id, permissions] as const;
                    } catch {
                        return null;
                    }
                }),
            );

            if (!cancelled) {
                setGuildPermissions(Object.fromEntries(entries.filter((entry): entry is readonly [string, GuildDashboardPermissions] => Boolean(entry))));
            }
        }

        loadGuildPermissions();

        return () => {
            cancelled = true;
        };
    }, [guilds, status]);

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-6 text-muted-foreground border border-border">
                    <ShieldAlert size={32} aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-medium mb-2 tracking-tight">Access Denied</h1>
                <p className="text-muted-foreground mb-8 max-w-sm text-sm">Please authenticate with Discord to manage your community servers.</p>
                <Button variant="default" size="default"
                    onClick={() => signIn('discord')}
                    className="transition-all"
                >
                    Sign In with Discord
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Sticky Professional Navbar */}
            <nav className="sticky top-0 z-50 bg-background border-b border-border">
                <div className="max-w-7xl mx-auto flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-20 md:py-0">
                    <Link href="/" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-8 h-8 md:w-9 md:h-9 object-contain" />
                        <span className="text-base md:text-xl font-medium tracking-tight text-foreground">Ro-Link</span>
                    </Link>

                    <div className="ml-auto flex items-center gap-2 border-l border-border pl-3 sm:gap-4 md:pl-4">
                        <ThemeToggle />
                        {(sessionUserId === '953414442060746854') && (
                            <Link
                                href="/management"
                                className="hidden md:flex items-center gap-2 text-foreground px-4 py-2 rounded-lg text-xs font-medium transition-all"
                            >
                                <LucideBriefcaseBusiness width="14" height="14" strokeWidth="2.5" />
                                Management
                            </Link>
                        )}
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-foreground leading-none mb-1">{session?.user?.name}</p>
                            <Button variant="ghost" size="default" type="button" onClick={handleSignOut} className="transition-colors flex items-center  justify-end">
                                <LogOutIcon />
                                Sign Out
                            </Button>
                        </div>
                        <div className="relative group">
                            <img src={getDiscordMediaProxyUrl(session?.user?.image)} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl border border-border transition-transform group-hover:scale-105" />
                            <Button variant="outline" size="icon"
                                type="button"
                                onClick={handleSignOut}
                                className="sm:hidden absolute -bottom-1 -right-1"
                                title="Sign Out"
                            >
                                <LogOutIcon />
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="motion-page max-w-7xl mx-auto px-4 sm:px-8 py-6 md:py-12">
                <header className="mb-6 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-xl md:text-4xl font-semibold text-foreground tracking-tight mb-1">Select a Server</h1>
                        <p className="text-muted-foreground text-xs md:text-base font-medium">Choose a community to manage and monitor.</p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        <Button asChild variant="secondary" size="icon">
                            <Link href="/dashboard/marketplace" aria-label="Open Marketplace" title="Open Marketplace">
                                <MarketplaceIcon />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon" className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300">
                            <Link href="/dashboard/creator/modules" aria-label="Creator Dashboard" title="Creator Dashboard">
                                <PlusIcon />
                            </Link>
                        </Button>
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="w-10 h-10 border-2 border-border border-t-transparent rounded-full animate-spin mb-6"></div>
                        <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading servers...</p>
                    </div>
                ) : guildsError ? (
                    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-8 text-center">
                        <h2 className="text-lg font-medium text-foreground">
                            {needsReauthentication ? 'Discord session expired' : 'Could not load servers'}
                        </h2>
                        <p className="mt-2 text-sm font-medium text-red-100/80">
                            {needsReauthentication ? 'Sign in with Discord again to refresh your server access.' : guildsError}
                        </p>
                        <Button variant="destructive" size="default"
                            onClick={() => needsReauthentication
                                ? signIn('discord', { callbackUrl: '/dashboard' })
                                : window.location.reload()}
                            className="mt-6 transition-colors"
                        >
                            {needsReauthentication ? 'Sign in again' : 'Retry'}
                        </Button>
                    </div>
                ) : sortedGuilds.length === 0 ? (
                    <Card className="rounded-xl border border-border bg-card p-8 text-center">
                        <h2 className="text-lg font-medium text-foreground">No servers available</h2>
                        <p className="mt-2 text-sm font-medium text-muted-foreground">Ro-Link could not find any Discord servers you can manage.</p>
                    </Card>
                ) : (
                    <div className="motion-list grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                        {sortedGuilds.map(guild => (
                            <Card key={guild.id} className="interactive-lift subtle-glow group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-border sm:p-6">
                                <div className="mb-5 flex flex-col items-start gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="relative">
                                        {guild.icon ? (
                                            <img
                                                src={getDiscordGuildIconProxyUrl(guild.id, guild.icon)}
                                                alt={guild.name}
                                                className="w-16 h-16 rounded-xl relative z-10 border border-border"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-xl font-medium text-foreground relative z-10 border border-border">
                                                {guild.name.substring(0, 1)}
                                            </div>
                                        )}
                                        {guild.hasBot && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-border z-20"></div>
                                        )}
                                    </div>
                                    <div className="break-all rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                        ID: {guild.id.substring(0, 8)}
                                    </div>
                                </div>

                                <h3 className="mb-6 w-full break-words text-lg font-medium tracking-tight text-foreground sm:mb-8">{guild.name}</h3>

                                <div className="mt-auto">
                                    {guild.hasBot ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                {canOpenDashboardFromServerList(guild, guildPermissions[guild.id]) && (
                                                    <ServerIconLink href={`/dashboard/${guild.id}`} label="Open Console">
                                                        <SettingsIcon />
                                                    </ServerIconLink>
                                                )}
                                                {(guildPermissions[guild.id]?.is_admin || guildPermissions[guild.id]?.can_view_staff_shifts || guildPermissions[guild.id]?.can_manage_staff_shifts) && <Button asChild variant="outline" size="sm"><Link href={`/dashboard/${guild.id}/staff-shifts`}>Staff shifts</Link></Button>}
                                                {canOpenLivePanelFromServerList(guild, guildPermissions[guild.id]) && (
                                                    <ServerIconLink href={`/dashboard/${guild.id}/live-panel`} label="Live Panel" tone="live">
                                                        <LivePanelIcon />
                                                    </ServerIconLink>
                                                )}
                                                {canOpenMarketplaceFromServerList(guild) && (
                                                    <ServerIconLink href="/dashboard/marketplace" label="Open Marketplace" tone="market">
                                                        <MarketplaceIcon />
                                                    </ServerIconLink>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <Button asChild className="w-full">
                                            <a
                                                href={getDiscordBotInviteUrl(guild.id)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <PlusIcon />
                                                Invite
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
