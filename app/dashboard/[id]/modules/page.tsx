'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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

export default function DashboardModulesPage() {
    const { id } = useParams();
    const serverId = Array.isArray(id) ? id[0] : String(id || '');
    const [modules, setModules] = useState<MarketplaceModule[]>([]);
    const [settingsDrafts, setSettingsDrafts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const installedCount = useMemo(() => modules.filter((addon) => addon.installed).length, [modules]);
    const enabledCount = useMemo(() => modules.filter((addon) => addon.installed && addon.enabled).length, [modules]);

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
            setSettingsDrafts(Object.fromEntries(
                nextModules.map((addon: MarketplaceModule) => [
                    addon.id,
                    JSON.stringify(addon.settings || {}, null, 2),
                ]),
            ));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load modules.');
        } finally {
            setLoading(false);
        }
    }, [serverId]);

    useEffect(() => {
        loadModules();
    }, [loadModules]);

    function parseSettings(moduleId: string) {
        const draft = settingsDrafts[moduleId]?.trim() || '{}';
        try {
            const parsed = JSON.parse(draft);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Settings must be a JSON object.');
            }
            return parsed as Record<string, unknown>;
        } catch (settingsError) {
            throw new Error(settingsError instanceof Error ? settingsError.message : 'Invalid JSON settings.');
        }
    }

    async function sendAction(moduleId: string, action: string, includeSettings = false) {
        setSavingId(moduleId);
        setError(null);

        try {
            const body: Record<string, unknown> = {
                serverId,
                moduleId,
                action,
            };

            if (includeSettings) {
                body.settings = parseSettings(moduleId);
            }

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
                        <div className="text-2xl font-black text-white">{installedCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Installed</div>
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
                    No published modules are available.
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

                                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
                                    <div>
                                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            Settings JSON
                                        </label>
                                        <textarea
                                            value={settingsDrafts[addon.id] || '{}'}
                                            onChange={(event) => setSettingsDrafts((current) => ({
                                                ...current,
                                                [addon.id]: event.target.value,
                                            }))}
                                            disabled={!addon.installed || busy}
                                            className="h-28 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-200 outline-none transition-colors focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            spellCheck={false}
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                        {!addon.installed ? (
                                            <button
                                                onClick={() => sendAction(addon.id, 'install', true)}
                                                disabled={busy}
                                                className="rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                                            >
                                                {busy ? 'Saving' : 'Install'}
                                            </button>
                                        ) : (
                                            <>
                                                <Link
                                                    href={`/dashboard/${serverId}/modules/${addon.id}`}
                                                    className="rounded-xl border border-sky-500/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-colors hover:bg-sky-500/10"
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
                                                    onClick={() => sendAction(addon.id, 'settings', true)}
                                                    disabled={busy}
                                                    className="rounded-xl bg-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                                                >
                                                    Save
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
        </div>
    );
}
