'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ModuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
type ModuleConfigFieldType = 'bool' | 'dropdown' | 'checkboxes' | 'color' | 'integer' | 'string' | 'group' | 'player' | 'server';

interface ModuleConfigField {
    key: string;
    label: string;
    shortDescription: string;
    type: ModuleConfigFieldType;
    options: string[];
    defaultValue: boolean | string | string[] | number | Record<string, unknown>;
}

interface AddonModule {
    id: string;
    slug: string;
    name: string;
    description: string;
    version: string;
    category: string;
    status: ModuleStatus;
    isOfficial: boolean;
    sourceCode: string;
    sourceChecksum: string;
    configSchema?: Record<string, ModuleConfigField>;
    authorDiscordId: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    moderationNote: string;
    updatedAt: string | null;
    publishedAt: string | null;
}

interface CreatorBlock {
    discord_id: string;
    reason: string;
    active: boolean;
}

interface PendingModuleCardProps {
    addon: AddonModule;
    saving: boolean;
    activeBlockIds: Set<string>;
    onBlockCreator: (addon: AddonModule) => void;
}

function formatDate(value: string | null) {
    if (!value) return 'Never';
    return new Date(value).toLocaleString();
}

function configSummary(addon: AddonModule) {
    return Object.values(addon.configSchema || {});
}

function PendingModuleCard({ addon, saving, activeBlockIds, onBlockCreator }: PendingModuleCardProps) {
    const configs = configSummary(addon);

    return (
        <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                            Awaiting moderation
                        </span>
                        {addon.authorDiscordId && (
                            <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${activeBlockIds.has(addon.authorDiscordId) ? 'border-red-400/20 bg-red-400/10 text-red-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
                                Creator {addon.authorDiscordId}
                            </span>
                        )}
                        {addon.isOfficial && (
                            <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                Offical
                            </span>
                        )}
                    </div>
                    <h3 className="mt-3 text-base font-bold text-white">{addon.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">{addon.description || 'No description provided.'}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        <span>{addon.slug}</span>
                        <span>{addon.category}</span>
                        <span>Submitted {formatDate(addon.submittedAt)}</span>
                        <span>{addon.sourceChecksum.slice(0, 12)}</span>
                    </div>
                    <div className="mt-4 rounded-lg border border-slate-800 bg-black/20 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Available configs
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                {configs.length} {configs.length === 1 ? 'field' : 'fields'}
                            </span>
                        </div>
                        {configs.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {configs.map((field) => (
                                    <span key={field.key} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-slate-400">
                                        {field.label} <span className="text-slate-600">({field.type})</span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-xs text-slate-600">This submission does not declare configurable fields.</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link
                        href={`/management/modules/${addon.id}`}
                        className="rounded-lg border border-sky-500/30 px-3 py-2 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-500/10"
                    >
                        Review Module
                    </Link>
                    <button
                        onClick={() => onBlockCreator(addon)}
                        disabled={saving || !addon.authorDiscordId || activeBlockIds.has(addon.authorDiscordId)}
                        className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                        {addon.authorDiscordId && activeBlockIds.has(addon.authorDiscordId) ? 'Blocked' : 'Block Creator'}
                    </button>
                </div>
            </div>
        </article>
    );
}

export default function ManagementModulesPage() {
    const [modules, setModules] = useState<AddonModule[]>([]);
    const [creatorBlocks, setCreatorBlocks] = useState<CreatorBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const filteredModules = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return modules;

        return modules.filter((addon) => (
            addon.name.toLowerCase().includes(query)
            || addon.slug.toLowerCase().includes(query)
            || addon.category.toLowerCase().includes(query)
        ));
    }, [modules, search]);

    const pendingModules = useMemo(
        () => modules.filter((addon) => addon.status === 'PENDING_REVIEW'),
        [modules],
    );

    const activeBlockIds = useMemo(
        () => new Set(creatorBlocks.filter((block) => block.active).map((block) => block.discord_id)),
        [creatorBlocks],
    );

    async function loadModules() {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/management/modules', { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to load modules.'));
            }
            setModules(Array.isArray(payload) ? payload : []);
            const blocksResponse = await fetch('/api/management/module-creator-blocks', { cache: 'no-store' });
            const blocksPayload = await blocksResponse.json().catch(() => ([]));
            if (blocksResponse.ok) {
                setCreatorBlocks(Array.isArray(blocksPayload) ? blocksPayload : []);
            }
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load modules.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadModules();
    }, []);

    async function deleteModule(addon: AddonModule) {
        if (!confirm(`Delete ${addon.name}? Installed copies will be removed from servers.`)) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/management/modules/${addon.id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to delete module.'));
            }

            setSuccess('Module deleted.');
            await loadModules();
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete module.');
        } finally {
            setSaving(false);
        }
    }

    async function copySource(addon: AddonModule) {
        await navigator.clipboard.writeText(addon.sourceCode || '');
        setSuccess(`Copied ${addon.name} source code.`);
    }

    async function blockCreator(addon: AddonModule) {
        if (!addon.authorDiscordId) {
            setError('This module does not have a creator Discord ID.');
            return;
        }

        const reason = prompt('Reason for blocking this creator from submitting modules?') || 'Repeated module terms violations.';
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/management/module-creator-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId: addon.authorDiscordId, reason, active: true }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to block creator.'));
            }

            setSuccess('Creator blocked from future module submissions.');
            await loadModules();
        } catch (blockError) {
            setError(blockError instanceof Error ? blockError.message : 'Failed to block creator.');
        } finally {
            setSaving(false);
        }
    }

    function statusClassName(status: ModuleStatus) {
        if (status === 'PUBLISHED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
        if (status === 'PENDING_REVIEW') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
        if (status === 'REJECTED') return 'border-red-400/20 bg-red-400/10 text-red-300';
        return 'border-slate-700 bg-slate-950 text-slate-500';
    }

    return (
        <div className="space-y-6">
            <section className="space-y-6">
                <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Module Marketplace</h1>
                        <p className="mt-1 text-sm text-slate-400">Create and publish add-ons stored by Ro-Link for Roblox runtimes.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search modules..."
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500 md:w-72"
                        />
                        <Link
                            href="/dashboard/marketplace/create"
                            className="rounded-xl bg-sky-600 px-5 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500"
                        >
                            Create Module
                        </Link>
                    </div>
                </header>

                {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-300">
                        {success}
                    </div>
                )}

                {pendingModules.length > 0 && (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Awaiting Moderation</h2>
                                <p className="mt-1 text-xs text-slate-400">Open a submitted module to inspect source, review creator history, then accept or deny it.</p>
                            </div>
                            <div className="text-2xl font-black text-amber-300">{pendingModules.length}</div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {pendingModules.map((addon) => (
                                <PendingModuleCard
                                    key={addon.id}
                                    addon={addon}
                                    saving={saving}
                                    activeBlockIds={activeBlockIds}
                                    onBlockCreator={blockCreator}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
                        <div className="table-responsive">
                            <table className="w-full min-w-[780px] text-left text-sm">
                                <thead className="border-b border-slate-800 bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Module</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Version</th>
                                        <th className="px-6 py-4">Updated</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {filteredModules.map((addon) => (
                                        <tr key={addon.id} className="transition-colors hover:bg-slate-800/30">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-white">{addon.name}</div>
                                                <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    <span>{addon.slug}</span>
                                                    <span>{addon.category}</span>
                                                    {addon.isOfficial && <span>Offical</span>}
                                                    <span>{Object.keys(addon.configSchema || {}).length} config fields</span>
                                                    <span>{addon.sourceChecksum.slice(0, 12)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(addon.status)}`}>
                                                    {addon.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-400">v{addon.version}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{formatDate(addon.updatedAt)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => copySource(addon)}
                                                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                                                    >
                                                        Copy
                                                    </button>
                                                    <Link
                                                        href={`/management/modules/${addon.id}`}
                                                        className="rounded-lg border border-sky-500/30 px-3 py-2 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-500/10"
                                                    >
                                                        Open
                                                    </Link>
                                                    <button
                                                        onClick={() => deleteModule(addon)}
                                                        disabled={saving}
                                                        className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredModules.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                No modules found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
