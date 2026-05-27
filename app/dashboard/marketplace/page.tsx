'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ModuleConfigFieldType = 'bool' | 'dropdown' | 'checkboxes' | 'color' | 'integer' | 'string';

interface ModuleConfigField {
    key: string;
    label: string;
    shortDescription: string;
    type: ModuleConfigFieldType;
    options: string[];
    defaultValue: boolean | string | string[] | number;
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
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
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
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-slate-400 border border-slate-700 shadow-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">Access Denied</h1>
                <p className="text-slate-400 mb-8 max-w-sm text-sm">Please authenticate with Discord to browse marketplace modules.</p>
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
            <nav className="sticky top-0 z-50 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-20 md:py-0">
                    <Link href="/dashboard" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-8 h-8 md:w-9 md:h-9 rounded-lg object-contain shadow-lg border border-white/5" />
                        <span className="text-base md:text-xl font-bold tracking-tight text-white">Ro-Link</span>
                    </Link>

                    <div className="ml-auto flex items-center gap-2 border-l border-slate-800 pl-3 sm:gap-4 md:pl-4">
                        {sessionUserId === '953414442060746854' && (
                            <Link
                                href="/management"
                                className="hidden md:flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-sky-900/20"
                            >
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
                        <img src={session?.user?.image || ''} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl border border-slate-700 shadow-sm" />
                    </div>
                </div>
            </nav>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 md:py-12">
                <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <Link href="/dashboard" className="text-xs font-bold uppercase tracking-widest text-sky-300 hover:text-sky-200">
                            Back to Dashboard
                        </Link>
                        <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">Marketplace</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                            Browse published modules, submit your own, and track your submissions while moderation reviews them.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Link
                            href="/terms/modules/use"
                            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-5 py-4 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                        >
                            Module Terms
                        </Link>
                        <Link
                            href="/dashboard/creator/modules"
                            className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 px-5 py-4 text-xs font-bold uppercase tracking-widest text-emerald-200 transition-colors hover:bg-emerald-500/10"
                        >
                            My Modules
                        </Link>
                        <Link
                            href="/dashboard/marketplace/create"
                            className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500"
                        >
                            Create Module
                        </Link>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-right">
                            <div className="text-2xl font-black text-white">{modules.length}</div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Visible Modules</div>
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="flex min-h-[360px] items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                        {error}
                    </div>
                ) : modules.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-500">
                        No modules are available.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {modules.map((addon) => (
                            <article key={addon.id} className="flex min-h-64 flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition-colors hover:border-sky-500/30">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                                        {addon.category}
                                    </span>
                                    <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(addon.status)}`}>
                                        {statusLabel(addon.status)}
                                    </span>
                                    {addon.authorDiscordId === sessionUserId && addon.status !== 'PUBLISHED' && (
                                        <span className="rounded-md border border-indigo-400/20 bg-indigo-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                                            Yours
                                        </span>
                                    )}
                                    {addon.isOfficial && (
                                        <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                            Official
                                        </span>
                                    )}
                                    {addon.creatorIsVerified && (
                                        <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                                            Verified Creator
                                        </span>
                                    )}
                                </div>
                                <h2 className="mt-4 text-xl font-bold text-white">{addon.name}</h2>
                                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-400">{addon.description || 'No description provided.'}</p>
                                <div className="mt-auto pt-6">
                                    <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                        <span>v{addon.version}</span>
                                        <span>{Object.keys(addon.configSchema || {}).length} config fields</span>
                                        {addon.status === 'PENDING_REVIEW' && <span>Submitted {formatDate(addon.submittedAt)}</span>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openModulePreview(addon)}
                                        className="w-full rounded-xl border border-sky-500/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-colors hover:bg-sky-500/10"
                                    >
                                        Open Module
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {selectedModule && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                        <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-[#020617] shadow-2xl">
                            <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950/80 px-5 py-5 md:flex-row md:items-start md:justify-between md:px-7">
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
                                    <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-4xl">{selectedModule.name}</h2>
                                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                                        {selectedModule.description || 'No description provided.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeModulePreview}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
                                    aria-label="Close module preview"
                                >
                                    x
                                </button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-180px)] overflow-y-auto px-5 py-6 md:px-7">
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Configuration Fields</h3>
                                        {Object.values(selectedModule.configSchema || {}).length === 0 ? (
                                            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-500">
                                                This module does not expose configurable fields.
                                            </div>
                                        ) : (
                                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {Object.values(selectedModule.configSchema || {}).map((field) => (
                                                    <div key={field.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
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
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</p>
                                            <p className="mt-2 break-all font-mono text-sm text-slate-300">{selectedModule.slug}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Review Status</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">{statusLabel(selectedModule.status)}</p>
                                            {selectedModule.status === 'REJECTED' && selectedModule.moderationNote && (
                                                <p className="mt-2 text-xs leading-relaxed text-red-300">{selectedModule.moderationNote}</p>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Published</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">{formatDate(selectedModule.publishedAt)}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Checksum</p>
                                            <p className="mt-2 break-all font-mono text-xs text-slate-300">{selectedModule.sourceChecksum || 'Unavailable'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openInstallPicker(selectedModule.id)}
                                            className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500"
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
                        <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#020617] shadow-2xl">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-5 py-5">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-400">Install Module</p>
                                    <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{installPickerModule.name}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                                        Click a server to install. Right-click a server to start multi-select.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeInstallPicker}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-50"
                                    aria-label="Close install picker"
                                    disabled={installing}
                                >
                                    x
                                </button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-170px)] overflow-y-auto px-5 py-5">
                                {installError && (
                                    <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                                        {installError}
                                    </div>
                                )}
                                {installMessage && (
                                    <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
                                        {installMessage}
                                    </div>
                                )}

                                {installTargets.length === 0 ? (
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
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
                                                    className={`flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${selected ? 'border-sky-400 bg-sky-500/15' : 'border-slate-800 bg-slate-900/40 hover:border-sky-500/40'}`}
                                                >
                                                    {server.icon ? (
                                                        <img
                                                            src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`}
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
                                            className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => installModuleToServers(installPickerModule.id, selectedServerIds)}
                                            disabled={installing || selectedServerIds.length === 0}
                                            className="rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
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
