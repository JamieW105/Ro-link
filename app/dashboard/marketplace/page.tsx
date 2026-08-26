'use client';

import {
    Boxes,
    FileText,
    Library,
    LogOut as LucideLogOut,
    Plus,
    ShieldAlert as LucideShieldAlert,
    Store,
    X,
} from 'lucide-react';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDiscordGuildIconProxyUrl, getDiscordMediaProxyUrl } from '@/lib/discordMedia';

type ModuleConfigFieldType = 'bool' | 'dropdown' | 'checkboxes' | 'color' | 'integer' | 'string' | 'group' | 'player' | 'server';

interface ModuleConfigField {
    key: string;
    label: string;
    shortDescription: string;
    type: ModuleConfigFieldType;
    options: string[];
    defaultValue: boolean | string | string[] | number | Record<string, unknown>;
}

interface MarketplaceModule {
    id: string;
    slug: string;
    name: string;
    description: string;
    version: string;
    category: string;
    status: string;
    isOfficial: boolean;
    creatorIsVerified: boolean;
    creatorApprovedModuleCount: number;
    creatorMaxModuleInstallCount: number;
    sourceChecksum: string;
    configSchema: Record<string, ModuleConfigField>;
    authorDiscordId: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    moderationNote: string;
    publishedAt: string | null;
    updatedAt: string | null;
}

interface InstallTarget {
    id: string;
    name: string;
    icon: string | null;
    installedModuleCount: number;
    moduleLimit: number;
}

type SessionUserWithId = {
    id?: string;
};

const LogOutIcon = () => (
    <LucideLogOut width="14" height="14" strokeWidth="2" />
);

function formatDate(value: string | null) {
    if (!value) return 'Unpublished';
    return new Date(value).toLocaleDateString();
}

function statusClassName(status: string) {
    if (status === 'PUBLISHED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    if (status === 'PENDING_REVIEW') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    if (status === 'REJECTED') return 'border-red-400/20 bg-red-400/10 text-red-300';
    return 'border-slate-700 bg-slate-950 text-slate-500';
}

function statusLabel(status: string) {
    if (status === 'PENDING_REVIEW') return 'Awaiting Moderation';
    return status.replace(/_/g, ' ');
}

function getModuleParam() {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('module') || '';
}

export default function DashboardMarketplacePage() {
    const { data: session, status } = useSession();
    const [modules, setModules] = useState<MarketplaceModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [installTargets, setInstallTargets] = useState<InstallTarget[]>([]);
    const [installPickerModuleId, setInstallPickerModuleId] = useState<string | null>(null);
    const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
    const [multiSelectInstall, setMultiSelectInstall] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installMessage, setInstallMessage] = useState<string | null>(null);
    const [installError, setInstallError] = useState<string | null>(null);
    const sessionUserId = (session?.user as SessionUserWithId | undefined)?.id;

    const selectedModule = useMemo(
        () => modules.find((addon) => addon.id === selectedModuleId) || null,
        [modules, selectedModuleId],
    );
    const installPickerModule = useMemo(
        () => modules.find((addon) => addon.id === installPickerModuleId) || null,
        [modules, installPickerModuleId],
    );

    const syncSelectedModuleFromUrl = useCallback((nextModules: MarketplaceModule[]) => {
        const moduleParam = getModuleParam();
        if (!moduleParam) {
            setSelectedModuleId(null);
            return;
        }

        const decodedModuleParam = moduleParam.toLowerCase();
        const matchedModule = nextModules.find((addon) => (
            addon.slug.toLowerCase() === decodedModuleParam
            || addon.id.toLowerCase() === decodedModuleParam
        ));

        setSelectedModuleId(matchedModule?.id || null);
    }, []);

    function setMarketplaceModuleUrl(moduleSlug: string | null) {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        if (moduleSlug) {
            url.searchParams.set('module', moduleSlug);
        } else {
            url.searchParams.delete('module');
        }
        window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function openModulePreview(addon: MarketplaceModule) {
        setSelectedModuleId(addon.id);
        setMarketplaceModuleUrl(addon.slug);
    }

    function closeModulePreview() {
        setSelectedModuleId(null);
        setMarketplaceModuleUrl(null);
    }

    useEffect(() => {
        if (status !== 'authenticated') {
            return;
        }

        fetch('/api/dashboard/marketplace', { cache: 'no-store' })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(String(payload.error || 'Failed to load marketplace.'));
                }
                const nextModules = Array.isArray(payload.modules) ? payload.modules : [];
                setModules(nextModules);
                setInstallTargets(Array.isArray(payload.installTargets) ? payload.installTargets : []);
                syncSelectedModuleFromUrl(nextModules);
            })
            .catch((loadError) => {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load marketplace.');
            })
            .finally(() => setLoading(false));
    }, [status, syncSelectedModuleFromUrl]);

    useEffect(() => {
        function handlePopState() {
            syncSelectedModuleFromUrl(modules);
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [modules, syncSelectedModuleFromUrl]);

    function openInstallPicker(moduleId: string) {
        setInstallPickerModuleId(moduleId);
        setSelectedServerIds([]);
        setMultiSelectInstall(false);
        setInstallMessage(null);
        setInstallError(null);
    }

    function closeInstallPicker() {
        if (installing) return;
        setInstallPickerModuleId(null);
        setSelectedServerIds([]);
        setMultiSelectInstall(false);
        setInstallMessage(null);
        setInstallError(null);
    }

    function handleSignOut() {
        void signOut({ callbackUrl: '/auth/signin' });
    }

    function toggleServerSelection(serverId: string) {
        const target = installTargets.find((server) => server.id === serverId);
        if (target && target.installedModuleCount >= target.moduleLimit && !selectedServerIds.includes(serverId)) {
            return;
        }

        setSelectedServerIds((current) => (
            current.includes(serverId)
                ? current.filter((id) => id !== serverId)
                : [...current, serverId]
        ));
    }

    async function installModuleToServers(moduleId: string, serverIds: string[]) {
        if (serverIds.length === 0) return;

        setInstalling(true);
        setInstallError(null);
        setInstallMessage(null);

        try {
            const results = await Promise.all(serverIds.map(async (serverId) => {
                const response = await fetch('/api/dashboard/modules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serverId,
                        moduleId,
                        action: 'install',
                    }),
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    const target = installTargets.find((server) => server.id === serverId);
                    throw new Error(`${target?.name || serverId}: ${String(payload.error || 'Install failed.')}`);
                }

                return serverId;
            }));

            setInstallMessage(`Installed to ${results.length} server${results.length === 1 ? '' : 's'}.`);
            setSelectedServerIds([]);
            setMultiSelectInstall(false);
        } catch (installFailure) {
            setInstallError(installFailure instanceof Error ? installFailure.message : 'Install failed.');
        } finally {
            setInstalling(false);
        }
    }

    if (status === 'loading') {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <div className="rl-dashboard-spinner" aria-label="Loading marketplace" />
            </main>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <section className="rl-dashboard-auth-card" aria-labelledby="marketplace-access-title">
                    <span className="rl-dashboard-state-icon"><LucideShieldAlert aria-hidden="true" /></span>
                    <p className="rl-eyebrow">Module marketplace</p>
                    <h1 id="marketplace-access-title">Sign in to browse modules.</h1>
                    <p>Authenticate with Discord to explore and install modules for your Ro-Link servers.</p>
                    <button onClick={() => signIn('discord')} className="rl-button rl-button-primary" type="button">
                        Sign in with Discord
                    </button>
                </section>
            </main>
        );
    }

    return (
        <div className="rl-public-page min-h-screen bg-[#080b0f] text-slate-200">
            <nav className="rl-dashboard-nav" aria-label="Marketplace navigation">
                <div className="rl-dashboard-nav-inner rl-shell">
                    <Link href="/dashboard" className="rl-brand" aria-label="Back to Ro-Link dashboard">
                        <span className="rl-brand-mark"><img src="/Media/Ro-LinkIcon.png" alt="" /></span>
                        <span>Ro-Link</span>
                    </Link>

                    <div className="rl-dashboard-account">
                        {sessionUserId === '953414442060746854' && (
                            <Link
                                href="/management"
                                className="rl-button rl-dashboard-management"
                            >
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

            <main>
                <section className="rl-dashboard-hero" aria-labelledby="marketplace-title">
                    <div className="rl-dashboard-hero-inner rl-shell">
                        <div className="rl-dashboard-hero-copy">
                            <div>
                                <p className="rl-eyebrow">Module library</p>
                                <div className="rl-dashboard-hero-title-row">
                                    <h1 id="marketplace-title">Marketplace</h1>
                                    <p>{modules.length} module{modules.length === 1 ? '' : 's'} available.</p>
                                </div>
                            </div>
                        </div>
                        <div className="rl-dashboard-primary-actions">
                            <Link href="/terms/modules/use" className="rl-button"><FileText size={14} aria-hidden="true" />Terms</Link>
                            <Link href="/dashboard/creator/modules" className="rl-button"><Library size={14} aria-hidden="true" />My Modules</Link>
                            <Link href="/dashboard/marketplace/create" className="rl-button rl-button-primary"><Plus size={14} strokeWidth={2.5} aria-hidden="true" />Create</Link>
                        </div>
                    </div>
                </section>

                <section className="rl-dashboard-content rl-shell" aria-label="Available modules">
                    {loading ? (
                        <div className="rl-dashboard-state-inline">
                            <div className="rl-dashboard-spinner" />
                            <p>Loading marketplace...</p>
                        </div>
                    ) : error ? (
                        <div className="rl-dashboard-message" data-tone="error">
                            <span className="rl-dashboard-state-icon"><LucideShieldAlert aria-hidden="true" /></span>
                            <h2>Could not load modules</h2>
                            <p>{error}</p>
                        </div>
                    ) : modules.length === 0 ? (
                        <div className="rl-dashboard-message">
                            <span className="rl-dashboard-state-icon"><Boxes aria-hidden="true" /></span>
                            <h2>No modules available</h2>
                            <p>Published modules and your submissions will appear here.</p>
                        </div>
                    ) : (
                        <div className="motion-list grid gap-2">
                            {modules.map((addon) => (
                                <article key={addon.id} className="interactive-lift flex min-w-0 flex-col gap-4 rounded-lg border border-slate-800 bg-[#0d1116] p-3 transition-colors hover:border-sky-500/30 hover:bg-[#0f141a] sm:flex-row sm:items-center">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70 text-sky-300">
                                        <Store size={18} aria-hidden="true" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <h2 className="mr-1 text-sm font-bold text-white">{addon.name}</h2>
                                            <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">{addon.category}</span>
                                            <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusClassName(addon.status)}`}>{statusLabel(addon.status)}</span>
                                            {addon.authorDiscordId === sessionUserId && addon.status !== 'PUBLISHED' && (
                                                <span className="rounded-md border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-300">Yours</span>
                                            )}
                                            {addon.isOfficial && (
                                                <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200">Official</span>
                                            )}
                                            {addon.creatorIsVerified && (
                                                <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">Verified Creator</span>
                                            )}
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{addon.description || 'No description provided.'}</p>
                                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-600">
                                            <span>v{addon.version}</span>
                                            <span>{Object.keys(addon.configSchema || {}).length} config fields</span>
                                            {addon.status === 'PENDING_REVIEW' && <span>Submitted {formatDate(addon.submittedAt)}</span>}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openModulePreview(addon)}
                                        className="rl-button w-full shrink-0 sm:w-auto"
                                    >
                                        Open Module
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                {selectedModule && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                        <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-700 bg-[#070b12] shadow-2xl shadow-black/50">
                            <div className="flex flex-col gap-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 px-5 py-5 md:flex-row md:items-start md:justify-between md:px-7">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                                            {selectedModule.category}
                                        </span>
                                        <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            v{selectedModule.version}
                                        </span>
                                        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(selectedModule.status)}`}>
                                            {statusLabel(selectedModule.status)}
                                        </span>
                                        {selectedModule.isOfficial && (
                                            <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                                Official
                                            </span>
                                        )}
                                        {selectedModule.creatorIsVerified && (
                                            <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                                                Verified Creator
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">{selectedModule.name}</h2>
                                    <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-400">
                                        {selectedModule.description || 'No description provided.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeModulePreview}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/40 text-slate-400 transition-colors hover:border-sky-500/40 hover:text-white"
                                    aria-label="Close module preview"
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-180px)] overflow-y-auto px-5 py-6 md:px-7">
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Configuration Fields</h3>
                                        {Object.values(selectedModule.configSchema || {}).length === 0 ? (
                                            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-500">
                                                This module does not expose configurable fields.
                                            </div>
                                        ) : (
                                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {Object.values(selectedModule.configSchema || {}).map((field) => (
                                                    <div key={field.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{field.label}</p>
                                                                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                                                    {field.shortDescription || 'No field description provided.'}
                                                                </p>
                                                            </div>
                                                            <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                {field.type}
                                                            </span>
                                                        </div>
                                                        {field.options.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {field.options.slice(0, 6).map((option) => (
                                                                    <span key={option} className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-400">
                                                                        {option}
                                                                    </span>
                                                                ))}
                                                                {field.options.length > 6 && (
                                                                    <span className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-500">
                                                                        +{field.options.length - 6} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <aside className="space-y-4">
                                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</p>
                                            <p className="mt-2 break-all font-mono text-sm text-slate-300">{selectedModule.slug}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Review Status</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">{statusLabel(selectedModule.status)}</p>
                                            {selectedModule.status === 'REJECTED' && selectedModule.moderationNote && (
                                                <p className="mt-2 text-xs leading-relaxed text-red-300">{selectedModule.moderationNote}</p>
                                            )}
                                        </div>
                                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Published</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">{formatDate(selectedModule.publishedAt)}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Checksum</p>
                                            <p className="mt-2 break-all font-mono text-xs text-slate-300">{selectedModule.sourceChecksum || 'Unavailable'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openInstallPicker(selectedModule.id)}
                                            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 text-xs font-bold uppercase tracking-wider text-sky-200 transition-colors hover:bg-sky-500/15 hover:text-white"
                                        >
                                            Select Server To Install
                                        </button>
                                    </aside>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {installPickerModule && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                        <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-slate-700 bg-[#070b12] shadow-2xl shadow-black/50">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 px-5 py-5">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-400">Install Module</p>
                                    <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{installPickerModule.name}</h3>
                                    <p className="mt-2 text-sm font-medium leading-6 text-slate-400">
                                        Click a server to install. Right-click a server to start multi-select.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeInstallPicker}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/40 text-slate-400 transition-colors hover:border-sky-500/40 hover:text-white disabled:opacity-50"
                                    aria-label="Close install picker"
                                    disabled={installing}
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-170px)] overflow-y-auto px-5 py-5">
                                {installError && (
                                    <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                                        {installError}
                                    </div>
                                )}
                                {installMessage && (
                                    <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
                                        {installMessage}
                                    </div>
                                )}

                                {installTargets.length === 0 ? (
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
                                        No servers are available for module installs.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {installTargets.map((server) => {
                                            const selected = selectedServerIds.includes(server.id);
                                            const full = server.installedModuleCount >= server.moduleLimit;

                                            return (
                                                <button
                                                    key={server.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (multiSelectInstall) {
                                                            toggleServerSelection(server.id);
                                                            return;
                                                        }

                                                        installModuleToServers(installPickerModule.id, [server.id]);
                                                    }}
                                                    onContextMenu={(event) => {
                                                        event.preventDefault();
                                                        setMultiSelectInstall(true);
                                                        toggleServerSelection(server.id);
                                                    }}
                                                    disabled={installing || full}
                                                    className={`flex min-h-20 items-center gap-3 rounded-lg border p-4 text-left transition-all disabled:opacity-50 ${selected ? 'border-sky-400 bg-sky-500/15' : 'border-slate-800 bg-slate-950/45 hover:border-sky-500/40 hover:bg-slate-900/55'}`}
                                                >
                                                    {server.icon ? (
                                                        <img
                                                            src={getDiscordGuildIconProxyUrl(server.id, server.icon)}
                                                            alt=""
                                                            className="h-11 w-11 shrink-0 rounded-lg border border-white/5 object-cover"
                                                        />
                                                    ) : (
                                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-sky-300">
                                                            {server.name.substring(0, 1)}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0">
                                                        <span className="block break-words text-sm font-bold text-white">{server.name}</span>
                                                        <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                            {full ? `${server.installedModuleCount}/${server.moduleLimit} installed` : selected ? 'Selected' : `${server.installedModuleCount}/${server.moduleLimit} installed`}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {multiSelectInstall && installTargets.length > 0 && (
                                <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-semibold text-slate-400">
                                        {selectedServerIds.length} server{selectedServerIds.length === 1 ? '' : 's'} selected
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMultiSelectInstall(false);
                                                setSelectedServerIds([]);
                                            }}
                                            disabled={installing}
                                            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-700 px-4 text-xs font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => installModuleToServers(installPickerModule.id, selectedServerIds)}
                                            disabled={installing || selectedServerIds.length === 0}
                                            className="inline-flex h-10 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 text-xs font-bold uppercase tracking-wider text-sky-200 transition-colors hover:bg-sky-500/15 hover:text-white disabled:opacity-50"
                                        >
                                            {installing ? 'Installing' : 'Install Selected'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
