'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
    authorDiscordId: string | null;
    sourceChecksum: string;
    configSchema: Record<string, ModuleConfigField>;
    installed: boolean;
    enabled: boolean;
    settings: Record<string, unknown>;
    installedAt: string | null;
}

function formatDate(value: string | null) {
    if (!value) return 'Not installed';
    return new Date(value).toLocaleDateString();
}

function reviewBadgeClassName(status: string) {
    if (status === 'PUBLISHED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    if (status === 'PENDING_REVIEW') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    if (status === 'REJECTED') return 'border-red-400/20 bg-red-400/10 text-red-300';
    return 'border-slate-700 bg-slate-950 text-slate-500';
}

function reviewLabel(status: string) {
    if (status === 'PENDING_REVIEW') return 'Creator Preview';
    if (status === 'REJECTED') return 'Rejected';
    return status.replace(/_/g, ' ');
}

export default function DashboardModulesPage() {
    const { id } = useParams();
    const serverId = Array.isArray(id) ? id[0] : String(id || '');
    const [modules, setModules] = useState<MarketplaceModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [moduleLimit, setModuleLimit] = useState(5);
    const [installedTotal, setInstalledTotal] = useState(0);

    const enabledCount = useMemo(() => modules.filter((addon) => addon.installed && addon.enabled).length, [modules]);
    const selectedModule = useMemo(
        () => modules.find((addon) => addon.id === selectedModuleId) || null,
        [modules, selectedModuleId],
    );

    const loadModules = useCallback(async () => {
        if (!serverId) return;
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/dashboard/modules?serverId=${encodeURIComponent(serverId)}`, {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to load modules.'));
            }

            const nextModules = Array.isArray(payload.modules) ? payload.modules : [];
            setModules(nextModules);
            setModuleLimit(Number(payload.moduleLimit || 5));
            setInstalledTotal(Number(payload.installedCount || nextModules.filter((addon: MarketplaceModule) => addon.installed).length));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load modules.');
        } finally {
            setLoading(false);
        }
    }, [serverId]);

    useEffect(() => {
        loadModules();
    }, [loadModules]);

    async function sendAction(moduleId: string, action: string) {
        setSavingId(moduleId);
        setError(null);

        try {
            const body: Record<string, unknown> = {
                serverId,
                moduleId,
                action,
            };

            const response = await fetch('/api/dashboard/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(String(payload.error || 'Module action failed.'));
            }

            await loadModules();
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Module action failed.');
        } finally {
            setSavingId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-400">Add-ons Marketplace</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-white uppercase italic">Modules</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                        Manage server add-ons that the Roblox runtime loads from Ro-Link when the game bridge starts.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-right">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4">
                        <div className="text-2xl font-black text-white">{installedTotal}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Installed / {moduleLimit}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4">
                        <div className="text-2xl font-black text-emerald-400">{enabledCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Enabled</div>
                    </div>
                </div>
            </header>

            {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                    {error}
                </div>
            )}

            {modules.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-500">
                    No modules are installed on this server.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {modules.map((addon) => {
                        const busy = savingId === addon.id;

                        return (
                            <article key={addon.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                                                {addon.category}
                                            </span>
                                            <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${addon.enabled ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : addon.installed ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-slate-700 bg-slate-950 text-slate-500'}`}>
                                                {addon.installed ? (addon.enabled ? 'Enabled' : 'Paused') : 'Available'}
                                            </span>
                                            {addon.status !== 'PUBLISHED' && (
                                                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${reviewBadgeClassName(addon.status)}`}>
                                                    {reviewLabel(addon.status)}
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
                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{addon.description || 'No description provided.'}</p>
                                    </div>

                                    <div className="shrink-0 text-left sm:text-right">
                                        <div className="font-mono text-xs text-slate-500">v{addon.version}</div>
                                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">{addon.slug}</div>
                                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                            {Object.keys(addon.configSchema || {}).length} config fields
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-wrap items-center gap-2 md:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedModuleId(addon.id)}
                                        className="rounded-xl border border-sky-500/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-colors hover:bg-sky-500/10"
                                    >
                                        Open
                                    </button>
                                    {!addon.installed ? (
                                        <button
                                            onClick={() => sendAction(addon.id, 'install')}
                                            disabled={busy}
                                            className="rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                                        >
                                            {busy ? 'Saving' : 'Install'}
                                        </button>
                                    ) : (
                                        <>
                                            <Link
                                                href={`/dashboard/${serverId}/modules/${addon.id}`}
                                                className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                                            >
                                                Configure
                                            </Link>
                                            <button
                                                onClick={() => sendAction(addon.id, addon.enabled ? 'disable' : 'enable')}
                                                disabled={busy}
                                                className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-sky-500 hover:text-white disabled:opacity-50"
                                            >
                                                {addon.enabled ? 'Disable' : 'Enable'}
                                            </button>
                                            <button
                                                onClick={() => sendAction(addon.id, 'remove')}
                                                disabled={busy}
                                                className="rounded-xl border border-red-500/30 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                            >
                                                Remove
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                    <span>Installed: {formatDate(addon.installedAt)}</span>
                                    <span>Checksum: {addon.sourceChecksum.slice(0, 12)}</span>
                                </div>
                            </article>
                        );
                    })}
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
                                    <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${selectedModule.enabled ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : selectedModule.installed ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-slate-700 bg-slate-950 text-slate-500'}`}>
                                        {selectedModule.installed ? (selectedModule.enabled ? 'Enabled' : 'Paused') : 'Available'}
                                    </span>
                                    {selectedModule.status !== 'PUBLISHED' && (
                                        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${reviewBadgeClassName(selectedModule.status)}`}>
                                            {reviewLabel(selectedModule.status)}
                                        </span>
                                    )}
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
                                    <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        v{selectedModule.version}
                                    </span>
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
                                <section className="space-y-5">
                                    <div>
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
                                    </div>

                                </section>

                                <aside className="space-y-4">
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</p>
                                        <p className="mt-2 break-all font-mono text-sm text-slate-300">{selectedModule.slug}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Checksum</p>
                                        <p className="mt-2 break-all font-mono text-xs text-slate-300">{selectedModule.sourceChecksum || 'Unavailable'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Install Status</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-300">{selectedModule.installed ? `Installed ${formatDate(selectedModule.installedAt)}` : 'Not installed on this server'}</p>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <Link
                                            href={`/dashboard/${serverId}/modules/${selectedModule.id}`}
                                            className="inline-flex items-center justify-center rounded-xl border border-sky-500/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-colors hover:bg-sky-500/10"
                                        >
                                            {selectedModule.installed ? 'Open Config' : 'Open Setup'}
                                        </Link>
                                        {!selectedModule.installed ? (
                                            <button
                                                type="button"
                                                onClick={() => sendAction(selectedModule.id, 'install')}
                                                disabled={savingId === selectedModule.id}
                                                className="rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                                            >
                                                {savingId === selectedModule.id ? 'Installing' : 'Install Module'}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => sendAction(selectedModule.id, selectedModule.enabled ? 'disable' : 'enable')}
                                                disabled={savingId === selectedModule.id}
                                                className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-sky-500 hover:text-white disabled:opacity-50"
                                            >
                                                {selectedModule.enabled ? 'Disable Module' : 'Enable Module'}
                                            </button>
                                        )}
                                    </div>
                                </aside>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
