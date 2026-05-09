'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
    sourceChecksum: string;
    installed: boolean;
    enabled: boolean;
    settings: Record<string, unknown>;
    configSchema: Record<string, ModuleConfigField>;
}

function normalizeInitialSettings(module: MarketplaceModule) {
    const next: Record<string, unknown> = { ...(module.settings || {}) };
    for (const [key, field] of Object.entries(module.configSchema || {})) {
        if (next[key] === undefined) {
            next[key] = field.defaultValue;
        }
    }
    return next;
}

function fieldDescription(field: ModuleConfigField) {
    if (field.shortDescription) return field.shortDescription;
    if (field.type === 'bool') return 'Toggle this module setting on or off.';
    if (field.type === 'dropdown') return 'Choose one option for this module setting.';
    if (field.type === 'checkboxes') return 'Choose any options that should be active.';
    return 'Pick a hex color used by this module.';
}

export default function DashboardModuleConfigPage() {
    const params = useParams();
    const serverId = Array.isArray(params.id) ? params.id[0] : String(params.id || '');
    const moduleId = Array.isArray(params.moduleId) ? params.moduleId[0] : String(params.moduleId || '');

    const [module, setModule] = useState<MarketplaceModule | null>(null);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fields = useMemo(() => Object.values(module?.configSchema || {}), [module]);

    const loadModule = useCallback(async () => {
        if (!serverId || !moduleId) return;
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/dashboard/modules?serverId=${encodeURIComponent(serverId)}`, {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to load module config.'));
            }

            const found = Array.isArray(payload.modules)
                ? payload.modules.find((item: MarketplaceModule) => item.id === moduleId)
                : null;
            if (!found) {
                throw new Error('Module not found.');
            }

            setModule(found);
            setSettings(normalizeInitialSettings(found));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load module config.');
        } finally {
            setLoading(false);
        }
    }, [serverId, moduleId]);

    useEffect(() => {
        loadModule();
    }, [loadModule]);

    function updateSetting(key: string, value: unknown) {
        setSettings((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function saveSettings() {
        if (!module) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/dashboard/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    moduleId: module.id,
                    action: module.installed ? 'settings' : 'install',
                    settings,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to save module config.'));
            }

            setSuccess('Module config saved.');
            await loadModule();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save module config.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!module) {
        return (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                {error || 'Module not found.'}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <Link href={`/dashboard/${serverId}/modules`} className="text-xs font-bold uppercase tracking-widest text-sky-300 hover:text-sky-200">
                        Back to modules
                    </Link>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-white">{module.name}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{module.description || 'No description provided.'}</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-right">
                    <div className="font-mono text-xs text-slate-400">v{module.version}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{module.slug}</div>
                    <div className={`mt-3 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${module.enabled ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : module.installed ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-slate-700 bg-slate-950 text-slate-500'}`}>
                        {module.installed ? (module.enabled ? 'Enabled' : 'Paused') : 'Not installed'}
                    </div>
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

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Module Config</h2>
                        <p className="mt-1 text-sm text-slate-500">These values are saved per Discord server and are available in Roblox as <code className="font-mono text-slate-300">context.Settings</code>.</p>
                    </div>
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="rounded-xl bg-sky-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                    >
                        {saving ? 'Saving' : module.installed ? 'Save Config' : 'Install And Save'}
                    </button>
                </div>

                {fields.length === 0 ? (
                    <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/50 p-6 text-sm text-slate-500">
                        This module does not declare a <code className="font-mono text-slate-300">CONFIG</code> block.
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
                        {fields.map((field) => (
                            <div key={field.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <label className="text-sm font-bold text-white">{field.label}</label>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{fieldDescription(field)}</p>
                                    </div>
                                    <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        {field.type}
                                    </span>
                                </div>

                                <div className="mt-4">
                                    {field.type === 'bool' && (
                                        <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={settings[field.key] === true}
                                                onChange={(event) => updateSetting(field.key, event.target.checked)}
                                                className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                                            />
                                            Enabled
                                        </label>
                                    )}

                                    {field.type === 'dropdown' && (
                                        <select
                                            value={String(settings[field.key] ?? field.defaultValue ?? '')}
                                            onChange={(event) => updateSetting(field.key, event.target.value)}
                                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                                        >
                                            {field.options.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    )}

                                    {field.type === 'checkboxes' && (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {field.options.map((option) => {
                                                const selected = Array.isArray(settings[field.key]) ? settings[field.key] as string[] : [];
                                                const checked = selected.includes(option);
                                                return (
                                                    <label key={option} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(event) => {
                                                                const next = event.target.checked
                                                                    ? Array.from(new Set([...selected, option]))
                                                                    : selected.filter((item) => item !== option);
                                                                updateSetting(field.key, next);
                                                            }}
                                                            className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                                                        />
                                                        {option}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {field.type === 'color' && (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={String(settings[field.key] || field.defaultValue || '#38bdf8')}
                                                onChange={(event) => updateSetting(field.key, event.target.value)}
                                                className="h-11 w-14 rounded-lg border border-slate-700 bg-slate-950 p-1"
                                            />
                                            <input
                                                value={String(settings[field.key] || field.defaultValue || '#38bdf8')}
                                                onChange={(event) => updateSetting(field.key, event.target.value)}
                                                className="w-32 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none transition-colors focus:border-sky-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
