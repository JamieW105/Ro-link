'use client';

import { DashboardHeader, DashboardBrand } from "@/components/dashboard/DashboardHeader";
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Status, StatusLabel } from '@/components/ui/status';
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import Image from 'next/image';
import Link from 'next/link';
import { getDiscordBotInviteUrl } from "@/lib/discordInvite";
import { getDiscordGuildIconProxyUrl } from "@/lib/discordMedia";
import { BriefcaseBusiness, Gauge, LayoutDashboard, Loader2, LogOut, MonitorPlay, Plus, ShieldAlert, Store } from "lucide-react";

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
            <div role="status" className="flex min-h-dvh items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading dashboard…
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <ShieldAlert className="mb-2 size-5 text-muted-foreground" aria-hidden="true" />
                        <CardTitle>Sign in to your dashboard</CardTitle>
                        <CardDescription>Authenticate with Discord to manage your community servers.</CardDescription>
                    </CardHeader>
                    <CardFooter><Button type="button" onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}>Sign In with Discord</Button></CardFooter>
                </Card>
            </main>
        );
    }

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <DashboardHeader contained>
                <DashboardBrand href="/" />
                <div className="flex shrink-0 items-center gap-2">
                    <ThemeToggle />
                    {sessionUserId === '953414442060746854' && <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex"><Link href="/management"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />Management</Link></Button>}
                    <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">{session?.user?.name}</span>
                    <Button variant="outline" size="sm" type="button" onClick={handleSignOut}><LogOut className="size-3.5" aria-hidden="true" />Sign Out</Button>
                </div>
            </DashboardHeader>

            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
                <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><span aria-hidden="true" data-slot="page-icon" className="inline-flex size-14 shrink-0 items-center justify-center text-foreground"><LayoutDashboard className="size-6" /></span>Select a Server</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Choose a community to manage and monitor.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="sm"><Link href="/dashboard/marketplace" aria-label="Open Marketplace"><Store className="size-4" aria-hidden="true" />Marketplace</Link></Button>
                        <Button asChild variant="outline" size="sm"><Link href="/dashboard/creator/modules" aria-label="Creator Dashboard"><Plus className="size-4" aria-hidden="true" />Creator Dashboard</Link></Button>
                    </div>
                </header>

                {loading ? (
                    <Card><CardContent role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading servers…</CardContent></Card>
                ) : guildsError ? (
                    <Card role="alert">
                        <CardHeader>
                            <CardTitle>{needsReauthentication ? 'Discord session expired' : 'Could not load servers'}</CardTitle>
                            <CardDescription>{needsReauthentication ? 'Sign in with Discord again to refresh your server access.' : guildsError}</CardDescription>
                        </CardHeader>
                        <CardFooter><Button type="button" variant="outline" onClick={() => needsReauthentication ? signIn('discord', { callbackUrl: '/dashboard' }) : window.location.reload()}>{needsReauthentication ? 'Sign in again' : 'Retry'}</Button></CardFooter>
                    </Card>
                ) : sortedGuilds.length === 0 ? (
                    <Card><CardHeader>
                        <CardTitle>No servers available</CardTitle>
                        <CardDescription>Ro-Link could not find any Discord servers you can manage.</CardDescription>
                    </CardHeader></Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {sortedGuilds.map(guild => {
                            const dashboardAccess = canOpenDashboardFromServerList(guild, guildPermissions[guild.id]);
                            const livePanelAccess = canOpenLivePanelFromServerList(guild, guildPermissions[guild.id]);
                            return (
                                <Card key={guild.id} aria-label={guild.name} className="flex min-w-0 flex-col">
                                    <CardHeader className="flex-row items-center gap-3 p-4">
                                        {guild.icon ? (
                                            <Image unoptimized src={getDiscordGuildIconProxyUrl(guild.id, guild.icon)} alt="" width={40} height={40} className="size-10 shrink-0 rounded-md" />
                                        ) : (
                                            <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">{guild.name.substring(0, 1)}</div>
                                        )}
                                        <div className="min-w-0 space-y-1.5">
                                            <CardTitle className="break-words text-sm leading-snug">{guild.name}</CardTitle>
                                            <Status variant={guild.hasBot ? 'success' : 'default'} className="px-2 py-0.5"><StatusLabel>{guild.hasBot ? 'Installed' : 'Not installed'}</StatusLabel></Status>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4"><p className="break-all text-xs text-muted-foreground">Server ID: {guild.id}</p></CardContent>
                                    <CardFooter className="mt-auto flex-wrap border-t border-border p-4">
                                        {guild.hasBot ? (
                                            <>
                                                {dashboardAccess && <Button asChild size="sm"><Link href={`/dashboard/${guild.id}`}><Gauge className="size-4" aria-hidden="true" />Dashboard</Link></Button>}
                                                {livePanelAccess && <Button asChild variant="outline" size="sm"><Link href={`/dashboard/${guild.id}/live-panel`}><MonitorPlay className="size-4" aria-hidden="true" />Live Panel</Link></Button>}
                                                {!dashboardAccess && !livePanelAccess && <p className="text-xs text-muted-foreground">Ask a server administrator for dashboard access.</p>}
                                            </>
                                        ) : (
                                            <Button asChild size="sm"><a href={getDiscordBotInviteUrl(guild.id)} target="_blank" rel="noopener noreferrer"><Plus className="size-4" aria-hidden="true" />Invite</a></Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
