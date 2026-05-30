'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from 'next/link';
import { getDiscordBotInviteUrl } from "@/lib/discordInvite";

// SVGs
const LogOutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);

const MarketplaceIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4Z" /><path d="M9 11h6" /><path d="M9 15h4" /></svg>
);

const LivePanelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M8 21h8" /><path d="M12 16v5" /><path d="m10 8 4 2-4 2Z" /></svg>
);

function ActionTooltip({ label }: { label: string }) {
    return (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 opacity-0 shadow-xl transition-all group-hover/server-action:translate-y-0 group-hover/server-action:opacity-100">
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
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/70 hover:bg-emerald-500/20'
        : tone === 'market'
            ? 'border-sky-500/30 bg-sky-500/10 text-sky-200 hover:border-sky-300/70 hover:bg-sky-500/20'
            : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-400/60 hover:bg-sky-500/15 hover:text-white';

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

function canOpenLivePanelAction(permissions?: GuildDashboardPermissions) {
    return canOpenDashboardAction(permissions) && Boolean(permissions?.is_admin || permissions?.can_access_live_panel);
}

export default function Dashboard() {
    const { data: session, status } = useSession();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [guildPermissions, setGuildPermissions] = useState<Record<string, GuildDashboardPermissions>>({});
    const [loading, setLoading] = useState(false);
    const sessionUserId = (session?.user as SessionUserWithId | undefined)?.id;
    const sortedGuilds = useMemo(() => [...guilds].sort(compareGuildsByBotStatus), [guilds]);

    useEffect(() => {
        let cancelled = false;

        async function loadGuilds() {
            if (!session?.accessToken) return;

            setLoading(true);
            try {
                const response = await fetch('/api/guilds');
                const data = await response.json();
                if (!cancelled && Array.isArray(data)) {
                    setGuilds(data);
                }
            } catch (err) {
                console.error(err);
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
    }, [session?.accessToken]);

    useEffect(() => {
        let cancelled = false;

        async function loadGuildPermissions() {
            const botGuilds = guilds.filter((guild) => guild.hasBot);
            if (!session?.accessToken || botGuilds.length === 0) {
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
    }, [guilds, session?.accessToken]);

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-slate-400 border border-slate-700 shadow-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">Access Denied</h1>
                <p className="text-slate-400 mb-8 max-w-sm text-sm">Please authenticate with Discord to manage your community servers.</p>
                <button
                    onClick={() => signIn('discord')}
                    className="bg-sky-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-sky-500 transition-all shadow-lg shadow-sky-900/10 text-sm"
                >
                    Sign In with Discord
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200">
            {/* Sticky Professional Navbar */}
            <nav className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-7xl mx-auto flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-20 md:py-0">
                    <Link href="/" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-8 h-8 md:w-9 md:h-9 rounded-lg object-contain shadow-lg border border-white/5" />
                        <span className="text-base md:text-xl font-bold tracking-tight text-white">Ro-Link</span>
                    </Link>

                    <div className="ml-auto flex items-center gap-2 border-l border-slate-800 pl-3 sm:gap-4 md:pl-4">
                        {(sessionUserId === '953414442060746854') && (
                            <Link
                                href="/management"
                                className="hidden md:flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-sky-900/20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="M3 9h18" /></svg>
                                Management
                            </Link>
                        )}
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-white leading-none mb-1">{session?.user?.name}</p>
                            <button onClick={() => signOut()} className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest flex items-center gap-1.5 justify-end">
                                <LogOutIcon />
                                Sign Out
                            </button>
                        </div>
                        <div className="relative group">
                            <img src={session?.user?.image || ''} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl border border-slate-700 shadow-sm transition-transform group-hover:scale-105" />
                            <button
                                onClick={() => signOut()}
                                className="sm:hidden absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 p-1 rounded-md text-slate-400 hover:text-red-400 shadow-xl"
                                title="Sign Out"
                            >
                                <LogOutIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="motion-page max-w-7xl mx-auto px-4 sm:px-8 py-6 md:py-12">
                <header className="mb-6 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-xl md:text-4xl font-extrabold text-white tracking-tight mb-1">Select a Server</h1>
                        <p className="text-slate-500 text-xs md:text-base font-medium">Choose a community to manage and monitor.</p>
                    </div>
                    <Link
                        href="/dashboard/marketplace"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-5 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-colors hover:border-sky-400/60 hover:bg-sky-500/20"
                    >
                        <MarketplaceIcon />
                        Open Marketplace
                    </Link>
                    <Link
                        href="/dashboard/creator/modules"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-xs font-bold uppercase tracking-widest text-emerald-200 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/20"
                    >
                        <PlusIcon />
                        Creator Dashboard
                    </Link>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="w-10 h-10 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <p className="text-slate-500 text-sm font-medium animate-pulse">Loading servers...</p>
                    </div>
                ) : (
                    <div className="motion-list grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                        {sortedGuilds.map(guild => (
                            <div key={guild.id} className="interactive-lift subtle-glow group relative flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all hover:border-sky-500/30 sm:p-6">
                                <div className="mb-5 flex flex-col items-start gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="relative">
                                        {guild.icon ? (
                                            <img
                                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                                                alt={guild.name}
                                                className="w-16 h-16 rounded-xl shadow-lg relative z-10 border border-white/5"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center text-xl font-bold text-sky-500 relative z-10 border border-white/5">
                                                {guild.name.substring(0, 1)}
                                            </div>
                                        )}
                                        {guild.hasBot && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#020617] z-20 shadow-lg"></div>
                                        )}
                                    </div>
                                    <div className="break-all rounded-md border border-slate-700/50 bg-slate-800/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        ID: {guild.id.substring(0, 8)}
                                    </div>
                                </div>

                                <h3 className="mb-6 w-full break-words text-lg font-bold tracking-tight text-white sm:mb-8">{guild.name}</h3>

                                <div className="mt-auto">
                                    {guild.hasBot ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                {canOpenDashboardAction(guildPermissions[guild.id]) && (
                                                    <ServerIconLink href={`/dashboard/${guild.id}`} label="Open Console">
                                                        <SettingsIcon />
                                                    </ServerIconLink>
                                                )}
                                                {canOpenLivePanelAction(guildPermissions[guild.id]) && (
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
                                        <a
                                            href={getDiscordBotInviteUrl(guild.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-sky-900/10 flex items-center justify-center gap-2"
                                        >
                                            <PlusIcon />
                                            Invite
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
