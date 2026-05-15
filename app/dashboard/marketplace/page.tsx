'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

type ModuleConfigFieldType = 'bool' | 'dropdown' | 'checkboxes' | 'color';

interface ModuleConfigField {
    key: string;
    label: string;
    shortDescription: string;
    type: ModuleConfigFieldType;
    options: string[];
    defaultValue: boolean | string | string[];
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
    sourceChecksum: string;
    configSchema: Record<string, ModuleConfigField>;
    authorDiscordId: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    moderationNote: string;
    publishedAt: string | null;
    updatedAt: string | null;
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

export default function DashboardMarketplacePage() {
    const { data: session, status } = useSession();
    const [modules, setModules] = useState<MarketplaceModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const sessionUserId = (session?.user as SessionUserWithId | undefined)?.id;

    const selectedModule = useMemo(
        () => modules.find((addon) => addon.id === selectedModuleId) || null,
        [modules, selectedModuleId],
    );

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
                setModules(Array.isArray(payload.modules) ? payload.modules : []);
            })
            .catch((loadError) => {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load marketplace.');
            })
            .finally(() => setLoading(false));
    }, [status]);

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
                                            Offical
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
                                        onClick={() => setSelectedModuleId(addon.id)}
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
                                                Offical
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
                                    onClick={() => setSelectedModuleId(null)}
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
                                        <Link
                                            href="/dashboard"
                                            className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500"
                                        >
                                            Select Server To Install
                                        </Link>
                                    </aside>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
