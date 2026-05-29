'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ModuleConfigFieldType = 'bool' | 'dropdown' | 'checkboxes' | 'color' | 'integer' | 'string' | 'group' | 'player' | 'server';
type ModuleConfigOptionSource = 'static' | 'roblox-users' | 'live-players' | 'live-server-players' | 'live-servers';

interface ModuleConfigField {
    key: string;
    label: string;
    shortDescription: string;
    type: ModuleConfigFieldType;
    options: string[];
    defaultValue: boolean | string | string[] | number | Record<string, unknown>;
    live?: boolean;
    liveButtonText?: string;
    subFields?: ModuleConfigField[];
    optionSource?: ModuleConfigOptionSource;
    referenceKey?: string;
    searchable?: boolean;
}

interface DynamicOption {
    value: string;
    label: string;
    description?: string;
    iconUrl?: string | null;
    data?: Record<string, unknown>;
}

interface MarketplaceModule {
    id: string;
    slug: string;
    name: string;
    description: string;
    version: string;
    category: string;
    isOfficial: boolean;
    creatorIsVerified: boolean;
    creatorApprovedModuleCount: number;
    creatorMaxModuleInstallCount: number;
    sourceChecksum: string;
    installed: boolean;
    isCustom?: boolean;
    status?: string;
    enabled: boolean;
    settings: Record<string, unknown>;
    configSchema: Record<string, ModuleConfigField>;
}

function normalizeInitialSettings(module: MarketplaceModule) {
    const next: Record<string, unknown> = { ...(module.settings || {}) };
    for (const [key, field] of Object.entries(module.configSchema || {})) {
        if (field.live) {
            delete next[key];
            continue;
        }
        if (next[key] === undefined) {
            next[key] = defaultFieldValue(field);
        }
    }
    return next;
}

function normalizeInitialLiveValues(module: MarketplaceModule) {
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(module.configSchema || {})) {
        if (field.live) {
            next[key] = defaultFieldValue(field);
        }
    }
    return next;
}

function defaultFieldValue(field: ModuleConfigField): unknown {
    const subFields = field.subFields || [];
    if (subFields.length > 0) {
        const nested: Record<string, unknown> = {};
        for (const subField of subFields) {
            nested[subField.key] = defaultFieldValue(subField);
        }
        if (field.type !== 'group') {
            nested.value = field.defaultValue;
        }
        return nested;
    }

    return field.defaultValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionValueLabel(value: unknown) {
    if (isRecord(value)) {
        return String(value.label || value.username || value.name || value.jobId || value.value || '');
    }

    return String(value ?? '');
}

function readDynamicValue(value: unknown) {
    if (isRecord(value)) {
        return String(value.value || value.username || value.name || value.jobId || value.id || '');
    }

    return String(value ?? '');
}

function findReferencedValue(referenceKey: string | undefined, roots: Record<string, unknown>[]) {
    const target = String(referenceKey || '').trim();
    if (!target) return '';

    const visit = (value: unknown): unknown => {
        if (!isRecord(value)) return undefined;
        if (Object.prototype.hasOwnProperty.call(value, target)) {
            return value[target];
        }
        for (const nested of Object.values(value)) {
            const found = visit(nested);
            if (found !== undefined) return found;
        }
        return undefined;
    };

    for (const root of roots) {
        const found = visit(root);
        if (found !== undefined) {
            if (isRecord(found)) {
                return String(found.jobId || found.value || found.id || '');
            }
            return String(found ?? '');
        }
    }

    return '';
}

function fieldDescription(field: ModuleConfigField) {
    if (field.shortDescription) return field.shortDescription;
    if (field.live) return 'Send this value to live Roblox servers without saving it as module config.';
    if (field.type === 'bool') return 'Toggle this module setting on or off.';
    if (field.type === 'dropdown') return 'Choose one option for this module setting.';
    if (field.type === 'checkboxes') return 'Choose any options that should be active.';
    if (field.type === 'integer') return 'Enter a whole-number value for this module setting.';
    if (field.type === 'string') return 'Enter a text value for this module setting.';
    if (field.type === 'group') return 'Fill out the inputs for this live module action.';
    if (field.type === 'player') return 'Search for a Roblox player and use that selection for this module action.';
    if (field.type === 'server') return 'Search for a live Roblox server and use that selection for this module action.';
    return 'Pick a hex color used by this module.';
}

function DynamicOptionSelect({
    serverId,
    field,
    value,
    onChange,
    referenceValue,
}: {
    serverId: string;
    field: ModuleConfigField;
    value: unknown;
    onChange: (value: unknown) => void;
    referenceValue: string;
}) {
    const [query, setQuery] = useState(optionValueLabel(value));
    const [options, setOptions] = useState<DynamicOption[]>([]);
    const [loading, setLoading] = useState(false);
    const source = field.optionSource || (field.type === 'server' ? 'live-servers' : 'live-players');
    const selectedValue = readDynamicValue(value);

    useEffect(() => {
        setQuery(optionValueLabel(value));
    }, [value]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            if (!serverId) return;
            if (source === 'roblox-users' && query.trim().length < 2) {
                setOptions([]);
                return;
            }

            setLoading(true);
            try {
                const params = new URLSearchParams({
                    serverId,
                    type: field.type,
                    source,
                    query: query.trim(),
                });
                if (referenceValue) params.set('jobId', referenceValue);

                const response = await fetch(`/api/dashboard/modules/input-options?${params.toString()}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(String(payload.error || 'Failed to load options.'));
                }
                if (!cancelled) {
                    setOptions(Array.isArray(payload.options) ? payload.options : []);
                }
            } catch (error) {
                if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
                    setOptions([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 220);

        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [field.type, query, referenceValue, serverId, source]);

    function selectOption(option: DynamicOption) {
        const data = option.data || {};
        onChange({
            ...data,
            value: option.value,
            label: option.label,
        });
        setQuery(option.label);
    }

    return (
        <div className="space-y-2">
            <input
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    if (!event.target.value.trim()) {
                        onChange('');
                    }
                }}
                placeholder={field.type === 'server' ? 'Search live servers...' : source === 'roblox-users' ? 'Search Roblox users...' : 'Search live players...'}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80">
                {loading && (
                    <div className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Loading</div>
                )}
                {!loading && options.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500">
                        {source === 'roblox-users' && query.trim().length < 2 ? 'Type at least two characters.' : 'No matches found.'}
                    </div>
                )}
                {!loading && options.map((option) => {
                    const isSelected = selectedValue && selectedValue === option.value;
                    return (
                        <button
                            key={`${option.value}-${option.description || ''}`}
                            type="button"
                            onClick={() => selectOption(option)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-900 ${isSelected ? 'bg-sky-500/10' : ''}`}
                        >
                            {option.iconUrl ? (
                                <span
                                    aria-hidden="true"
                                    className="h-9 w-9 rounded-lg border border-slate-700 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${option.iconUrl})` }}
                                />
                            ) : (
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-[10px] font-black uppercase text-slate-500">
                                    {field.type === 'server' ? 'SRV' : 'USR'}
                                </span>
                            )}
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-white">{option.label}</span>
                                {option.description && (
                                    <span className="block truncate text-xs text-slate-500">{option.description}</span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function DashboardModuleConfigPage() {
    const params = useParams();
    const serverId = Array.isArray(params.id) ? params.id[0] : String(params.id || '');
    const moduleId = Array.isArray(params.moduleId) ? params.moduleId[0] : String(params.moduleId || '');

    const [module, setModule] = useState<MarketplaceModule | null>(null);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});
    const [liveSending, setLiveSending] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fields = useMemo(() => Object.values(module?.configSchema || {}), [module]);
    const savedFields = useMemo(() => fields.filter((field) => !field.live), [fields]);

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
            setLiveValues(normalizeInitialLiveValues(found));
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

    function updateLiveValue(key: string, value: unknown) {
        setLiveValues((current) => ({
            ...current,
            [key]: value,
        }));
    }

    function getFieldValue(field: ModuleConfigField) {
        return field.live ? liveValues[field.key] : settings[field.key];
    }

    function updateFieldValue(field: ModuleConfigField, value: unknown) {
        if (field.live) {
            updateLiveValue(field.key, value);
        } else {
            updateSetting(field.key, value);
        }
    }

    async function saveSettings() {
        if (!module || savedFields.length === 0) return;
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
                    action: module.isCustom ? 'custom-settings' : module.installed ? 'settings' : 'install',
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

    async function sendLiveSetting(field: ModuleConfigField) {
        if (!module || !field.live) return;
        setLiveSending(field.key);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/dashboard/modules/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    moduleId: module.id,
                    fieldKey: field.key,
                    value: liveValues[field.key],
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to send live module action.'));
            }

            setSuccess(`${field.label} sent to ${Number(payload.deliveredTargets || 0)} live server(s).`);
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : 'Failed to send live module action.');
        } finally {
            setLiveSending(null);
        }
    }

    function renderFieldInput(
        field: ModuleConfigField,
        value: unknown,
        onChange: (value: unknown) => void,
        valueRoots: Record<string, unknown>[],
    ) {
        if (field.type === 'bool') {
            return (
                <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-200">
                    <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) => onChange(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                    />
                    Enabled
                </label>
            );
        }

        if (field.type === 'dropdown') {
            return (
                <select
                    value={String(value ?? field.defaultValue ?? '')}
                    onChange={(event) => onChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                >
                    {field.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            );
        }

        if (field.type === 'checkboxes') {
            return (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {field.options.map((option) => {
                        const selected = Array.isArray(value) ? value as string[] : [];
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
                                        onChange(next);
                                    }}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                                />
                                {option}
                            </label>
                        );
                    })}
                </div>
            );
        }

        if (field.type === 'color') {
            return (
                <div className="flex items-center gap-3">
                    <input
                        type="color"
                        value={String(value || field.defaultValue || '#38bdf8')}
                        onChange={(event) => onChange(event.target.value)}
                        className="h-11 w-14 rounded-lg border border-slate-700 bg-slate-950 p-1"
                    />
                    <input
                        value={String(value || field.defaultValue || '#38bdf8')}
                        onChange={(event) => onChange(event.target.value)}
                        className="w-32 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none transition-colors focus:border-sky-500"
                    />
                </div>
            );
        }

        if (field.type === 'integer') {
            return (
                <input
                    type="number"
                    step="1"
                    value={Number(value ?? field.defaultValue ?? 0)}
                    onChange={(event) => onChange(Math.trunc(Number(event.target.value || 0)))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none transition-colors focus:border-sky-500"
                />
            );
        }

        if (field.type === 'player' || field.type === 'server') {
            return (
                <DynamicOptionSelect
                    serverId={serverId}
                    field={field}
                    value={value}
                    onChange={onChange}
                    referenceValue={findReferencedValue(field.referenceKey, valueRoots)}
                />
            );
        }

        if (field.type === 'group') {
            return null;
        }

        return (
            <input
                type="text"
                value={String(value ?? field.defaultValue ?? '')}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
            />
        );
    }

    function renderConfigField(
        field: ModuleConfigField,
        value: unknown,
        onChange: (value: unknown) => void,
        valueRoots: Record<string, unknown>[],
        nested = false,
    ) {
        const subFields = field.subFields || [];
        const recordValue = isRecord(value) ? value : {};
        const ownValue = field.type === 'group' ? undefined : (subFields.length > 0 ? recordValue.value : value);
        const nextRoots = [recordValue, ...valueRoots];

        return (
            <div key={field.key} className={nested ? 'rounded-lg border border-slate-800 bg-slate-950/60 p-4' : ''}>
                {nested && (
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <label className="text-sm font-bold text-white">{field.label}</label>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{fieldDescription(field)}</p>
                        </div>
                        <span className="shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {field.type}
                        </span>
                    </div>
                )}

                {field.type !== 'group' && (
                    <div>
                        {renderFieldInput(field, ownValue, (nextValue) => {
                            if (subFields.length > 0) {
                                onChange({ ...recordValue, value: nextValue });
                            } else {
                                onChange(nextValue);
                            }
                        }, nextRoots)}
                    </div>
                )}

                {subFields.length > 0 && (
                    <div className={field.type === 'group' ? 'space-y-3' : 'mt-4 space-y-3'}>
                        {subFields.map((subField) => renderConfigField(
                            subField,
                            recordValue[subField.key] ?? defaultFieldValue(subField),
                            (nextValue) => onChange({ ...recordValue, [subField.key]: nextValue }),
                            nextRoots,
                            true,
                        ))}
                    </div>
                )}
            </div>
        );
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
                    <div className="mt-3 flex flex-wrap gap-2">
                        {module.isOfficial && (
                            <div className="inline-flex rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                Official
                            </div>
                        )}
                        {module.creatorIsVerified && (
                            <div className="inline-flex rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                                Verified Creator
                            </div>
                        )}
                        {module.isCustom && (
                            <div className="inline-flex rounded-md border border-violet-300/30 bg-violet-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-200">
                                Server Custom
                            </div>
                        )}
                    </div>
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
            {module.isCustom && module.status === 'NEEDS_REUPLOAD' && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                    This custom module is disabled until it is re-uploaded and passes the automatic checks.
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
                        disabled={saving || savedFields.length === 0}
                        className="rounded-xl bg-sky-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                    >
                        {saving ? 'Saving' : savedFields.length === 0 ? 'No Saved Config' : module.installed ? 'Save Config' : 'Install And Save'}
                    </button>
                </div>

                {fields.length === 0 ? (
                    <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/50 p-6 text-sm text-slate-500">
                        This module does not declare a <code className="font-mono text-slate-300">CONFIG</code> block.
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
                        {fields.map((field) => {
                            const fieldValue = getFieldValue(field);
                            const sendButtonText = field.liveButtonText || 'Send';

                            return (
                                <div key={field.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <label className="text-sm font-bold text-white">{field.label}</label>
                                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{fieldDescription(field)}</p>
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {field.live && (
                                                <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                                                    Live
                                                </span>
                                            )}
                                            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                {field.type}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={field.live ? 'mt-4 flex flex-col gap-3 sm:flex-row sm:items-start' : 'mt-4'}>
                                        <div className="min-w-0 flex-1">
                                            {renderConfigField(
                                                field,
                                                fieldValue ?? defaultFieldValue(field),
                                                (nextValue) => updateFieldValue(field, nextValue),
                                                [liveValues, settings],
                                            )}
                                        </div>

                                        {field.live && (
                                            <button
                                                type="button"
                                                onClick={() => sendLiveSetting(field)}
                                                disabled={liveSending === field.key}
                                                className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 sm:min-w-28"
                                            >
                                                {liveSending === field.key ? 'Sending' : sendButtonText}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
