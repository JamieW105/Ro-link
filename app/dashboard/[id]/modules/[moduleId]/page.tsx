'use client';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { Card } from '@/components/ui/card';

import { Checkbox } from '@/components/ui/checkbox';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import { Select } from '@/components/ui/select';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

function optionValueDescription(value: unknown) {
    if (isRecord(value)) {
        return String(value.description || value.displayName || value.userId || value.jobId || value.id || '');
    }

    return '';
}

function optionValueIcon(value: unknown) {
    if (isRecord(value)) {
        return String(value.iconUrl || value.avatarUrl || '');
    }

    return '';
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
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const source = field.optionSource || (field.type === 'server' ? 'live-servers' : 'live-players');
    const selectedValue = readDynamicValue(value);
    const selectedLabel = optionValueLabel(value);
    const selectedDescription = optionValueDescription(value);
    const selectedIcon = optionValueIcon(value);

    useEffect(() => {
        if (!open) {
            setQuery('');
        }
    }, [open, value]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    useEffect(() => {
        if (!open) return;
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
                    const nextOptions = Array.isArray(payload.options) ? payload.options : [];
                    setOptions(nextOptions);
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
    }, [field.type, open, query, referenceValue, serverId, source]);

    function selectOption(option: DynamicOption) {
        const data = option.data || {};
        onChange({
            ...data,
            value: option.value,
            label: option.label,
            description: option.description || '',
            iconUrl: option.iconUrl || null,
        });
        setQuery('');
        setOpen(false);
    }

    return (
        <div ref={containerRef} className="relative">
            <Button variant="outline" size="default"
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex w-full items-center text-left outline-none transition-colors"
            >
                {field.type === 'player' && selectedIcon && (
                    <span
                        aria-hidden="true"
                        className="h-7 w-7 shrink-0 rounded-md border border-border bg-cover bg-center"
                        style={{ backgroundImage: `url(${selectedIcon})` }}
                    />
                )}
                <span className="min-w-0 flex-1 truncate">
                    {selectedLabel ? (
                        <>
                            <span className="font-semibold">{selectedLabel}</span>
                            {selectedDescription && <span className="text-muted-foreground"> - {selectedDescription}</span>}
                        </>
                    ) : (
                        <span className="text-muted-foreground">{field.type === 'server' ? 'Choose a live server...' : 'Choose a Roblox user...'}</span>
                    )}
                </span>
                <span className="shrink-0 text-muted-foreground">{open ? '^' : 'v'}</span>
            </Button>

            {open && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card">
                    <div className="border-b border-border p-2">
                        <Input
                            value={query}
                            autoFocus
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={field.type === 'server' ? 'Search live servers...' : source === 'roblox-users' ? 'Search Roblox users...' : 'Search live players...'}
                            className="w-full transition-colors"
                        />
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                        {loading && (
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Loading</div>
                        )}
                        {!loading && options.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                                {source === 'roblox-users' && query.trim().length < 2 ? 'Type at least two characters.' : 'No matches found.'}
                            </div>
                        )}
                        {!loading && options.map((option) => {
                            const isSelected = selectedValue && selectedValue === option.value;
                            return (
                                <Button variant="outline" size="default"
                                    key={`${option.value}-${option.description || ''}`}
                                    type="button"
                                    onClick={() => selectOption(option)}
                                    className={`flex  w-full items-center   text-left transition-colors  ${isSelected ? '' : ''}`}
                                >
                                    {field.type === 'player' && option.iconUrl && (
                                        <span
                                            aria-hidden="true"
                                            className="h-7 w-7 shrink-0 rounded-md border border-border bg-cover bg-center"
                                            style={{ backgroundImage: `url(${option.iconUrl})` }}
                                        />
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                        <span className="font-semibold">{option.label}</span>
                                        {option.description && <span className="text-muted-foreground"> - {option.description}</span>}
                                    </span>
                                </Button>
                            );
                        })}
                    </div>
                </div>
            )}
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
                <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                    <Checkbox
                        checked={value === true}
                        onCheckedChange={(checked) => onChange(checked === true)}
                        className="w-4 accent-muted-foreground"
                    />
                    Enabled
                </label>
            );
        }

        if (field.type === 'dropdown') {
            return (
                <Select
                    value={String(value ?? field.defaultValue ?? '')}
                    onValueChange={(nextValue) => onChange(nextValue)}
                    className="w-full transition-colors"
                    aria-label={field.label}
                    options={field.options.map(option => ({ value: option, label: option }))}
                />
            );
        }

        if (field.type === 'checkboxes') {
            return (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {field.options.map((option) => {
                        const selected = Array.isArray(value) ? value as string[] : [];
                        const checked = selected.includes(option);
                        return (
                            <label key={option} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={(checked) => {
                                        const next = checked === true
                                            ? Array.from(new Set([...selected, option]))
                                            : selected.filter((item) => item !== option);
                                        onChange(next);
                                    }}
                                    className="w-4 accent-muted-foreground"
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
                    <Input
                        type="color"
                        value={String(value || field.defaultValue || '#38bdf8')}
                        onChange={(event) => onChange(event.target.value)}
                        className="w-14"
                    />
                    <Input
                        value={String(value || field.defaultValue || '#38bdf8')}
                        onChange={(event) => onChange(event.target.value)}
                        className="w-32 transition-colors"
                    />
                </div>
            );
        }

        if (field.type === 'integer') {
            return (
                <Input
                    type="number"
                    step="1"
                    value={Number(value ?? field.defaultValue ?? 0)}
                    onChange={(event) => onChange(Math.trunc(Number(event.target.value || 0)))}
                    className="w-full transition-colors"
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
            <Input
                type="text"
                value={String(value ?? field.defaultValue ?? '')}
                onChange={(event) => onChange(event.target.value)}
                className="w-full transition-colors"
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
            <Card key={field.key} className={nested ? 'rounded-lg border border-border bg-card p-4' : ''}>
                {nested && (
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <label className="text-sm font-medium text-foreground">{field.label}</label>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{fieldDescription(field)}</p>
                        </div>
                        <span className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
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
            </Card>
        );
    }

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
            </div>
        );
    }

    if (!module) {
        return (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                {error || 'Module not found.'}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <Link href={`/dashboard/${serverId}/modules`} className="text-xs font-medium text-foreground hover:text-foreground">
                        Back to modules
                    </Link>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3"><PageIcon name="modules" />{module.name}</h1>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {module.isOfficial && (
                            <div className="inline-flex rounded-md border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground">
                                Official
                            </div>
                        )}
                        {module.creatorIsVerified && (
                            <div className="inline-flex rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                Verified Creator
                            </div>
                        )}
                        {module.isCustom && (
                            <div className="inline-flex rounded-md border border-violet-300/30 bg-violet-300/10 px-2 py-1 text-xs font-medium text-violet-200">
                                Server Custom
                            </div>
                        )}
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{module.description || 'No description provided.'}</p>
                </div>

                <div className="rounded-xl border border-border bg-card px-5 py-4 text-right">
                    <div className="font-mono text-xs text-muted-foreground">v{module.version}</div>
                    <div className="mt-1 text-xs font-medium text-muted-foreground">{module.slug}</div>
                    <div className={`mt-3 rounded-md border px-2 py-1 text-xs font-medium   ${module.enabled ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : module.installed ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'border-border bg-card text-muted-foreground'}`}>
                        {module.installed ? (module.enabled ? 'Enabled' : 'Paused') : 'Not installed'}
                    </div>
                </div>
            </header>

            {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {success}
                </div>
            )}
            {module.isCustom && module.status === 'NEEDS_REUPLOAD' && (
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                    This custom module is disabled until it is re-uploaded.
                </div>
            )}

            <section className="rounded-xl border border-border bg-card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-medium text-foreground">Module Config</h2>
                        <p className="mt-1 text-sm text-muted-foreground">These values are saved per Discord server and are available in Roblox as <code className="font-mono text-foreground">context.Settings</code>.</p>
                    </div>
                    <Button variant="default" size="default"
                        onClick={saveSettings}
                        disabled={saving || savedFields.length === 0}
                        className="transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving' : savedFields.length === 0 ? 'No Saved Config' : module.installed ? 'Save Config' : 'Install And Save'}
                    </Button>
                </div>

                {fields.length === 0 ? (
                    <Card className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                        This module does not declare a <code className="font-mono text-foreground">CONFIG</code> block.
                    </Card>
                ) : (
                    <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
                        {fields.map((field) => {
                            const fieldValue = getFieldValue(field);
                            const sendButtonText = field.liveButtonText || 'Send';

                            return (
                                <Card key={field.key} className="rounded-xl border border-border bg-card p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground">{field.label}</label>
                                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{fieldDescription(field)}</p>
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {field.live && (
                                                <span className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                    Live
                                                </span>
                                            )}
                                            <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
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
                                            <Button variant="ghost" size="default"
                                                type="button"
                                                onClick={() => sendLiveSetting(field)}
                                                disabled={liveSending === field.key}
                                                className="transition-colors disabled:opacity-50 sm:min-w-28"
                                            >
                                                {liveSending === field.key ? 'Sending' : sendButtonText}
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
