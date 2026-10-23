'use client';

import { X } from 'lucide-react';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
    authorDiscordId: string | null;
    sourceChecksum: string;
    configSchema: Record<string, ModuleConfigField>;
    installed: boolean;
    isCustom?: boolean;
    enabled: boolean;
    settings: Record<string, unknown>;
    installedAt: string | null;
    reviewResults?: Array<{
        id: string;
        title: string;
        status: 'pass' | 'fail';
        details: string[];
    }>;
}

function formatDate(value: string | null) {
    if (!value) return 'Not installed';
    return new Date(value).toLocaleDateString();
}

function reviewBadgeClassName(status: string) {
    if (status === 'READY') return 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400';
    if (status === 'NEEDS_REUPLOAD') return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400';
    if (status === 'PUBLISHED') return 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400';
    if (status === 'PENDING_REVIEW') return 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
    if (status === 'REJECTED') return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400';
    return 'border-border bg-card text-muted-foreground';
}

function reviewLabel(status: string) {
    if (status === 'READY') return 'Ready';
    if (status === 'NEEDS_REUPLOAD') return 'Needs Re-upload';
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
    const [customModuleLimit, setCustomModuleLimit] = useState(20);
    const [installedTotal, setInstalledTotal] = useState(0);
    const [customInstalledTotal, setCustomInstalledTotal] = useState(0);
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [customVersion, setCustomVersion] = useState('');
    const [customSourceCode, setCustomSourceCode] = useState('');
    const [customUploadTarget, setCustomUploadTarget] = useState<MarketplaceModule | null>(null);
    const [uploadingCustom, setUploadingCustom] = useState(false);

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
            setCustomModuleLimit(Number(payload.customModuleLimit || 20));
            setInstalledTotal(Number(payload.installedCount || nextModules.filter((addon: MarketplaceModule) => addon.installed).length));
            setCustomInstalledTotal(Number(payload.customInstalledCount || nextModules.filter((addon: MarketplaceModule) => addon.isCustom).length));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load modules.');
        } finally {
            setLoading(false);
        }
    }, [serverId]);

    useEffect(() => {
        loadModules();
    }, [loadModules]);

    async function sendAction(addon: MarketplaceModule, action: string) {
        const moduleId = addon.id;
        setSavingId(moduleId);
        setError(null);

        try {
            const body: Record<string, unknown> = {
                serverId,
                moduleId,
                action: addon.isCustom ? `custom-${action}` : action,
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

    function startCustomUpload(target?: MarketplaceModule) {
        setCustomUploadTarget(target || null);
        setCustomName(target?.name || '');
        setCustomDescription(target?.description || '');
        setCustomVersion(target?.version || '');
        setCustomSourceCode('');
        setError(null);
    }

    async function submitCustomModule() {
        setUploadingCustom(true);
        setError(null);

        try {
            const response = await fetch('/api/dashboard/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    moduleId: customUploadTarget?.id,
                    action: customUploadTarget ? 'custom-reupload' : 'custom-create',
                    name: customName,
                    description: customDescription,
                    version: customVersion,
                    sourceCode: customSourceCode,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(String(payload.error || 'Custom module upload failed.'));
            }

            if (payload.warning) {
                setError(`Custom module saved but cannot run yet. ${payload.warning}`);
            }

            setCustomName('');
            setCustomDescription('');
            setCustomVersion('');
            setCustomSourceCode('');
            setCustomUploadTarget(null);
            await loadModules();
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Custom module upload failed.');
        } finally {
            setUploadingCustom(false);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-xs font-medium text-foreground">Add-ons Marketplace</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Modules</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Manage server add-ons that the Roblox runtime loads from Ro-Link when the game bridge starts.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-right">
                    <div className="rounded-xl border border-border bg-card px-5 py-4">
                        <div className="text-2xl font-semibold text-foreground">{installedTotal}</div>
                        <div className="text-xs font-medium text-muted-foreground">Marketplace / {moduleLimit}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-5 py-4">
                        <div className="text-2xl font-semibold text-foreground">{customInstalledTotal}</div>
                        <div className="text-xs font-medium text-muted-foreground">Custom / {customModuleLimit}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-5 py-4">
                        <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{enabledCount}</div>
                        <div className="text-xs font-medium text-muted-foreground">Enabled</div>
                    </div>
                </div>
            </header>

            <section className="rounded-xl border border-border bg-card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h2 className="text-lg font-medium text-foreground">Server Custom Module</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            Upload Luau directly to this server without submitting it to the module marketplace.
                        </p>
                    </div>
                    {customUploadTarget && (
                        <Button variant="outline" size="default"
                            type="button"
                            onClick={() => startCustomUpload()}
                            className="transition-colors"
                        >
                            New Upload
                        </Button>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-3">
                        <Input
                            value={customName}
                            onChange={(event) => setCustomName(event.target.value)}
                            placeholder="Module name"
                            className="w-full transition-colors"
                        />
                        <Input
                            value={customVersion}
                            onChange={(event) => setCustomVersion(event.target.value)}
                            placeholder="Version"
                            className="w-full transition-colors"
                        />
                        <Textarea
                            value={customDescription}
                            onChange={(event) => setCustomDescription(event.target.value)}
                            placeholder="Description"
                            rows={4}
                            className="w-full resize-none transition-colors"
                        />
                    </div>
                    <div className="space-y-3">
                        {customUploadTarget && (
                            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                Re-uploading {customUploadTarget.name}. Paste the replacement source below.
                            </div>
                        )}
                        <Textarea
                            value={customSourceCode}
                            onChange={(event) => setCustomSourceCode(event.target.value)}
                            placeholder="Paste Luau module source"
                            rows={10}
                            className="custom-scrollbar w-full resize-y transition-colors"
                        />
                        <Button variant="default" size="default"
                            type="button"
                            onClick={submitCustomModule}
                            disabled={uploadingCustom || !customName.trim() || !customSourceCode.trim()}
                            className="transition-colors disabled:opacity-50"
                        >
                            {uploadingCustom ? 'Uploading' : customUploadTarget ? 'Re-upload Module' : 'Upload Module'}
                        </Button>
                    </div>
                </div>
            </section>

            {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {modules.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
                    No modules are installed on this server.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {modules.map((addon) => {
                        const busy = savingId === addon.id;

                        return (
                            <article key={addon.id} className="rounded-xl border border-border bg-card p-6">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-md border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground">
                                                {addon.category}
                                            </span>
                                            <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${addon.enabled ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : addon.installed ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'border-border bg-card text-muted-foreground'}`}>
                                                {addon.installed ? (addon.enabled ? 'Enabled' : 'Paused') : 'Available'}
                                            </span>
                                            {addon.status !== 'PUBLISHED' && (
                                                <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${reviewBadgeClassName(addon.status)}`}>
                                                    {reviewLabel(addon.status)}
                                                </span>
                                            )}
                                            {addon.isCustom && (
                                                <span className="rounded-md border border-violet-300/30 bg-violet-300/10 px-2 py-1 text-xs font-medium text-violet-200">
                                                    Server Custom
                                                </span>
                                            )}
                                            {addon.isOfficial && (
                                                <span className="rounded-md border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground">
                                                    Official
                                                </span>
                                            )}
                                            {addon.creatorIsVerified && (
                                                <span className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                    Verified Creator
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="mt-4 text-xl font-medium text-foreground">{addon.name}</h2>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{addon.description || 'No description provided.'}</p>
                                        {addon.isCustom && addon.status === 'NEEDS_REUPLOAD' && (
                                            <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs leading-relaxed text-red-700 dark:text-red-400">
                                                {(addon.reviewResults || [])
                                                    .filter((result) => result.status === 'fail')
                                                    .slice(0, 2)
                                                    .map((result) => `${result.title}: ${result.details.join(' ')}`)
                                                    .join(' ') || 'Re-upload this module before enabling it in game.'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0 text-left sm:text-right">
                                        <div className="font-mono text-xs text-muted-foreground">v{addon.version}</div>
                                        <div className="mt-1 text-xs font-medium text-muted-foreground">{addon.slug}</div>
                                        <div className="mt-1 text-xs font-medium text-muted-foreground">
                                            {Object.keys(addon.configSchema || {}).length} config fields
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-wrap items-center gap-2 md:justify-end">
                                    <Button variant="outline" size="default"
                                        type="button"
                                        onClick={() => setSelectedModuleId(addon.id)}
                                        className="transition-colors"
                                    >
                                        Open
                                    </Button>
                                    {!addon.installed ? (
                                        <Button variant="default" size="default"
                                            onClick={() => sendAction(addon, 'install')}
                                            disabled={busy}
                                            className="transition-colors disabled:opacity-50"
                                        >
                                            {busy ? 'Saving' : 'Install'}
                                        </Button>
                                    ) : (
                                        <>
                                            {addon.isCustom && (
                                                <Button variant="outline" size="default"
                                                    onClick={() => startCustomUpload(addon)}
                                                    disabled={busy}
                                                    className="transition-colors disabled:opacity-50"
                                                >
                                                    Re-upload
                                                </Button>
                                            )}
                                            <Link
                                                href={`/dashboard/${serverId}/modules/${addon.id}`}
                                                className="rounded-xl border border-border px-4 py-3 text-xs font-medium text-foreground transition-colors hover:border-border hover:text-foreground"
                                            >
                                                Configure
                                            </Link>
                                            <Button variant="outline" size="default"
                                                onClick={() => sendAction(addon, addon.enabled ? 'disable' : 'enable')}
                                                disabled={busy || (addon.isCustom && addon.status === 'NEEDS_REUPLOAD')}
                                                className="transition-colors disabled:opacity-50"
                                            >
                                                {addon.enabled ? 'Disable' : 'Enable'}
                                            </Button>
                                            <Button variant="outline" size="default"
                                                onClick={() => sendAction(addon, 'remove')}
                                                disabled={busy}
                                                className="transition-colors disabled:opacity-50"
                                            >
                                                Remove
                                            </Button>
                                        </>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                                    <span>Installed: {formatDate(addon.installedAt)}</span>
                                    <span>Checksum: {addon.sourceChecksum.slice(0, 12)}</span>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {selectedModule && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-background">
                        <div className="flex flex-col gap-4 border-b border-border bg-card px-5 py-5 md:flex-row md:items-start md:justify-between md:px-7">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground">
                                        {selectedModule.category}
                                    </span>
                                    <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${selectedModule.enabled ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : selectedModule.installed ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'border-border bg-card text-muted-foreground'}`}>
                                        {selectedModule.installed ? (selectedModule.enabled ? 'Enabled' : 'Paused') : 'Available'}
                                    </span>
                                    {selectedModule.status !== 'PUBLISHED' && (
                                        <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${reviewBadgeClassName(selectedModule.status)}`}>
                                            {reviewLabel(selectedModule.status)}
                                        </span>
                                    )}
                                    {selectedModule.isCustom && (
                                        <span className="rounded-md border border-violet-300/30 bg-violet-300/10 px-2 py-1 text-xs font-medium text-violet-200">
                                            Server Custom
                                        </span>
                                    )}
                                    {selectedModule.isOfficial && (
                                        <span className="rounded-md border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground">
                                            Official
                                        </span>
                                    )}
                                    {selectedModule.creatorIsVerified && (
                                        <span className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                            Verified Creator
                                        </span>
                                    )}
                                    <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
                                        v{selectedModule.version}
                                    </span>
                                </div>
                                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{selectedModule.name}</h2>
                                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                                    {selectedModule.description || 'No description provided.'}
                                </p>
                                {selectedModule.isCustom && selectedModule.status === 'NEEDS_REUPLOAD' && (
                                    <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs leading-relaxed text-red-700 dark:text-red-400">
                                        {(selectedModule.reviewResults || [])
                                            .filter((result) => result.status === 'fail')
                                            .map((result) => `${result.title}: ${result.details.join(' ')}`)
                                            .join(' ') || 'Re-upload this module before enabling it in game.'}
                                    </div>
                                )}
                            </div>
                            <Button variant="outline" size="default"
                                type="button"
                                onClick={() => setSelectedModuleId(null)}
                                className="inline-flex shrink-0 items-center justify-center transition-colors"
                                aria-label="Close module preview"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </Button>
                        </div>

                        <div className="custom-scrollbar max-h-[calc(90vh-180px)] overflow-y-auto px-5 py-6 md:px-7">
                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                                <section className="space-y-5">
                                    <div>
                                        <h3 className="text-sm font-medium text-foreground">Configuration Fields</h3>
                                        {Object.values(selectedModule.configSchema || {}).length === 0 ? (
                                            <Card className="mt-4 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                                                This module does not expose configurable fields.
                                            </Card>
                                        ) : (
                                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {Object.values(selectedModule.configSchema || {}).map((field) => (
                                                    <Card key={field.key} className="rounded-xl border border-border bg-card p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-medium text-foreground">{field.label}</p>
                                                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                                                    {field.shortDescription || 'No field description provided.'}
                                                                </p>
                                                            </div>
                                                            <span className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
                                                                {field.type}
                                                            </span>
                                                        </div>
                                                        {field.options.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {field.options.slice(0, 6).map((option) => (
                                                                    <span key={option} className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                                                                        {option}
                                                                    </span>
                                                                ))}
                                                                {field.options.length > 6 && (
                                                                    <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                                                                        +{field.options.length - 6} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </section>

                                <aside className="space-y-4">
                                    <Card className="rounded-xl border border-border bg-card p-5">
                                        <p className="text-xs font-medium text-muted-foreground">Slug</p>
                                        <p className="mt-2 break-all font-mono text-sm text-foreground">{selectedModule.slug}</p>
                                    </Card>
                                    <Card className="rounded-xl border border-border bg-card p-5">
                                        <p className="text-xs font-medium text-muted-foreground">Checksum</p>
                                        <p className="mt-2 break-all font-mono text-xs text-foreground">{selectedModule.sourceChecksum || 'Unavailable'}</p>
                                    </Card>
                                    <Card className="rounded-xl border border-border bg-card p-5">
                                        <p className="text-xs font-medium text-muted-foreground">Install Status</p>
                                        <p className="mt-2 text-sm font-semibold text-foreground">{selectedModule.installed ? `Installed ${formatDate(selectedModule.installedAt)}` : 'Not installed on this server'}</p>
                                    </Card>
                                    <div className="flex flex-col gap-3">
                                        <Link
                                            href={`/dashboard/${serverId}/modules/${selectedModule.id}`}
                                            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                                        >
                                            {selectedModule.installed ? 'Open Config' : 'Open Setup'}
                                        </Link>
                                        {!selectedModule.installed ? (
                                            <Button variant="default" size="default"
                                                type="button"
                                                onClick={() => sendAction(selectedModule, 'install')}
                                                disabled={savingId === selectedModule.id}
                                                className="transition-colors disabled:opacity-50"
                                            >
                                                {savingId === selectedModule.id ? 'Installing' : 'Install Module'}
                                            </Button>
                                        ) : (
                                            <>
                                                {selectedModule.isCustom && (
                                                    <Button variant="outline" size="default"
                                                        type="button"
                                                        onClick={() => {
                                                            startCustomUpload(selectedModule);
                                                            setSelectedModuleId(null);
                                                        }}
                                                        className="transition-colors"
                                                    >
                                                        Re-upload Module
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="default"
                                                    type="button"
                                                    onClick={() => sendAction(selectedModule, selectedModule.enabled ? 'disable' : 'enable')}
                                                    disabled={savingId === selectedModule.id || (selectedModule.isCustom && selectedModule.status === 'NEEDS_REUPLOAD')}
                                                    className="transition-colors disabled:opacity-50"
                                                >
                                                    {selectedModule.enabled ? 'Disable Module' : 'Enable Module'}
                                                </Button>
                                            </>
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
