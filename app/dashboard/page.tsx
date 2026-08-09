'use client';

import { BriefcaseBusiness as LucideBriefcaseBusiness } from 'lucide-react';

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from 'next/link';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
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
        <span className="rl-dashboard-tooltip">
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
    return (
        <Link
            href={href}
            aria-label={label}
            className="rl-dashboard-icon-action group/server-action"
            data-tone={tone}
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
            try {
                const response = await fetch('/api/guilds', { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok) {
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
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <div className="rl-dashboard-spinner" aria-label="Loading dashboard" />
            </main>
        );
    }

    if (status === "unauthenticated") {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <PublicHeroBackdrop />
                <section className="rl-dashboard-auth-card" aria-labelledby="dashboard-access-title">
                    <span className="rl-dashboard-state-icon"><ShieldAlert aria-hidden="true" /></span>
                    <p className="rl-eyebrow">Secure dashboard</p>
                    <h1 id="dashboard-access-title">Access your Ro-Link workspace.</h1>
                    <p>Authenticate with Discord to manage and monitor your community servers.</p>
                    <button onClick={() => signIn('discord')} className="rl-button rl-button-primary" type="button">
                        Sign in with Discord
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="rl-public-page rl-dashboard-page">
            <nav className="rl-dashboard-nav" aria-label="Dashboard navigation">
                <div className="rl-dashboard-nav-inner rl-shell">
                    <Link href="/" className="rl-brand" aria-label="Ro-Link home">
                        <span className="rl-brand-mark"><img src="/Media/Ro-LinkIcon.png" alt="" /></span>
                        <span>Ro-Link</span>
                    </Link>

                    <div className="rl-dashboard-account">
                        {(sessionUserId === '953414442060746854') && (
                            <Link href="/management" className="rl-button rl-dashboard-management">
                                <LucideBriefcaseBusiness aria-hidden="true" width="14" height="14" strokeWidth="2.5" />
                                Management
                            </Link>
                        )}
                        <div className="rl-dashboard-user-copy">
                            <strong>{session?.user?.name}</strong>
                            <button type="button" onClick={handleSignOut}>
                                <LogOutIcon />
                                Sign Out
                            </button>
                        </div>
                        <div className="rl-dashboard-avatar-wrap">
                            <img src={getDiscordMediaProxyUrl(session?.user?.image)} alt="" className="rl-dashboard-avatar" />
                            <button type="button" onClick={handleSignOut} className="rl-dashboard-mobile-signout" aria-label="Sign out">
                                <LogOutIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <section className="rl-dashboard-hero" aria-labelledby="dashboard-title">
                <div className="rl-dashboard-hero-inner rl-shell">
                    <div className="rl-dashboard-hero-copy">
                        <span className="rl-dashboard-hero-icon"><LayoutDashboard aria-hidden="true" /></span>
                        <div>
                            <p className="rl-eyebrow">Community workspace</p>
                            <div className="rl-dashboard-hero-title-row">
                                <h1 id="dashboard-title">Select a server</h1>
                                <p>Choose a community to manage.</p>
                            </div>
                        </div>
                    </div>
                    <div className="rl-dashboard-primary-actions">
                        <Link href="/dashboard/marketplace" className="rl-button"><MarketplaceIcon />Marketplace</Link>
                        <Link href="/dashboard/creator/modules" className="rl-button rl-button-primary"><PlusIcon />Creator dashboard</Link>
                    </div>
                </div>
            </section>

            <section className="rl-dashboard-content rl-shell" aria-label="Available servers">
                {loading ? (
                    <div className="rl-dashboard-state-inline">
                        <div className="rl-dashboard-spinner" />
                        <p>Loading servers...</p>
                    </div>
                ) : guildsError ? (
                    <div className="rl-dashboard-message" data-tone="error">
                        <span className="rl-dashboard-state-icon"><ShieldAlert aria-hidden="true" /></span>
                        <h2>Could not load servers</h2>
                        <p>{guildsError}</p>
                        <button onClick={() => window.location.reload()} className="rl-button" type="button">Retry</button>
                    </div>
                ) : sortedGuilds.length === 0 ? (
                    <div className="rl-dashboard-message">
                        <h2>No servers available</h2>
                        <p>Ro-Link could not find any Discord servers you can manage.</p>
                    </div>
                ) : (
                    <div className="motion-list rl-dashboard-grid">
                        {sortedGuilds.map(guild => (
                            <article key={guild.id} className="interactive-lift rl-dashboard-server-card">
                                <div className="rl-dashboard-card-head">
                                    <div className="rl-dashboard-server-icon-wrap">
                                        {guild.icon ? (
                                            <img
                                                src={getDiscordGuildIconProxyUrl(guild.id, guild.icon)}
                                                alt={guild.name}
                                                className="rl-dashboard-server-icon"
                                            />
                                        ) : (
                                            <div className="rl-dashboard-server-icon rl-dashboard-server-fallback">
                                                {guild.name.substring(0, 1)}
                                            </div>
                                        )}
                                        {guild.hasBot && (
                                            <span className="rl-dashboard-online" aria-label="Ro-Link connected" />
                                        )}
                                    </div>
                                    <div className="rl-dashboard-server-id">
                                        ID {guild.id.substring(0, 8)}
                                    </div>
                                </div>

                                <h3>{guild.name}</h3>

                                <div className="rl-dashboard-card-footer">
                                    {guild.hasBot ? (
                                        <div className="rl-dashboard-card-actions">
                                                {canOpenDashboardFromServerList(guild, guildPermissions[guild.id]) && (
                                                    <ServerIconLink href={`/dashboard/${guild.id}`} label="Open Console">
                                                        <SettingsIcon />
                                                    </ServerIconLink>
                                                )}
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
                                    ) : (
                                        <a
                                            href={getDiscordBotInviteUrl(guild.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rl-button rl-button-primary rl-dashboard-invite"
                                        >
                                            <PlusIcon />
                                            Invite
                                        </a>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
