'use client';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import { useRouter } from 'next/navigation';
import { DashboardHeader, DashboardBrand } from "@/components/dashboard/DashboardHeader";
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Package, Plus, Search, X } from 'lucide-react';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';


import { ShieldAlert as LucideShieldAlert } from 'lucide-react';

import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDiscordGuildIconProxyUrl } from '@/lib/discordMedia';

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

function formatDate(value: string | null) {
    if (!value) return 'Unpublished';
    return new Date(value).toLocaleDateString();
}

function statusClassName(status: string) {
    if (status === 'PUBLISHED') return 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400';
    if (status === 'PENDING_REVIEW') return 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
    if (status === 'REJECTED') return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400';
    return 'border-border bg-card text-muted-foreground';
}

function statusLabel(status: string) {
    if (status === 'PENDING_REVIEW') return 'Awaiting Moderation';
    return status.split('_').map(part => part[0] + part.slice(1).toLowerCase()).join(' ');
}

function getModuleParam() {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('module') || '';
}

export default function MarketplaceClient({ moduleSlug }: { moduleSlug?: string }) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
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
        const moduleParam = moduleSlug || getModuleParam();
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
    }, [moduleSlug]);

    function closeModulePreview() {
        if (!moduleSlug) setSelectedModuleId(null);
        router.push('/dashboard/marketplace');
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

    const productView = Boolean(moduleSlug || selectedModule);
    const filteredModules = modules.filter(addon => (category === 'all' || addon.category === category)
        && `${addon.name} ${addon.description} ${addon.category}`.toLowerCase().includes(search.toLowerCase()));
    const categories = [...new Set(modules.map(addon => addon.category))].sort();

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-6 text-muted-foreground border border-border">
                    <LucideShieldAlert width="32" height="32" strokeWidth="2" />
                </div>
                <h1 className="text-2xl font-medium mb-2 tracking-tight">Access Denied</h1>
                <p className="text-muted-foreground mb-8 max-w-sm text-sm">Please authenticate with Discord to browse marketplace modules.</p>
                <Button variant="default" size="default"
                    onClick={() => signIn('discord')}
                    className="transition-all"
                >
                    Sign In with Discord
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <DashboardHeader contained>
                <DashboardBrand label="Marketplace" />
                <div className="flex shrink-0 items-center gap-2"><ThemeToggle /><Button asChild variant="outline" size="sm"><Link href="/dashboard"><ArrowLeft className="size-3.5" />All servers</Link></Button></div>
            </DashboardHeader>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 md:py-12">
                {!productView && <>
                <header className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-start">
                    <div><h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3"><PageIcon name="marketplace" />Module marketplace</h1><p className="mt-2 text-sm text-muted-foreground">Extend your workspace with tools built for your community.</p></div>
                    <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/dashboard/creator/modules">My modules</Link></Button><Button asChild><Link href="/dashboard/marketplace/create"><Plus className="size-4" />Create module</Link></Button></div>
                </header>
                <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search modules" placeholder="Search modules…" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
                    <div className="sm:w-56"><Select aria-label="Module category" value={category} onValueChange={setCategory} options={[{value: 'all', label: 'All categories'}, ...categories.map(value => ({value, label: value}))]} /></div>
                </div>

                {loading ? (
                    <div className="flex min-h-[360px] items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                        {error}
                    </div>
                ) : filteredModules.length === 0 ? (
                    <Card><CardContent className="flex min-h-60 flex-col items-center justify-center gap-3 pt-6 text-center"><Package className="size-8 text-muted-foreground" /><p className="text-sm font-medium">No modules found</p><p className="text-sm text-muted-foreground">Try another search or category.</p></CardContent></Card>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {filteredModules.map(addon => <Card key={addon.id} className="flex flex-col">
                            <CardHeader><div className="mb-3 flex items-start justify-between gap-3"><span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">{addon.category}</span></div><CardTitle>{addon.name}</CardTitle><CardDescription className="line-clamp-3 min-h-16 leading-relaxed">{addon.description || 'No description provided.'}</CardDescription></CardHeader>
                            <CardContent className="mt-auto"><div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>v{addon.version}</span>{addon.isOfficial && <span>· Official</span>}{addon.creatorIsVerified && <span>· Verified creator</span>}<span className={`ml-auto rounded-md px-2 py-1 ${statusClassName(addon.status)}`}>{statusLabel(addon.status)}</span></div><Button asChild variant="outline" className="w-full"><Link href={`/dashboard/marketplace/${encodeURIComponent(addon.slug)}`} aria-label={`View ${addon.name}`}>View module<ArrowRight className="size-4" /></Link></Button></CardContent>
                        </Card>)}
                    </div>
                )}
                <p className="mt-6 text-xs text-muted-foreground">{filteredModules.length} modules · <Link href="/terms/modules/use" className="underline underline-offset-4">Module terms</Link></p>
                </>}
                {productView && <div className="mb-6"><Button variant="ghost" size="sm" onClick={closeModulePreview}><ArrowLeft className="size-4" />Back to marketplace</Button></div>}
                {moduleSlug && loading && <Card><CardContent className="py-12 text-center text-muted-foreground">Loading module…</CardContent></Card>}
                {moduleSlug && !loading && !selectedModule && <Card><CardHeader><CardTitle>{error ? 'Module unavailable' : 'Module not found'}</CardTitle><CardDescription>{error || 'This module is unavailable or you do not have access to it.'}</CardDescription></CardHeader></Card>}

                {selectedModule && (
                    <div className="w-full">
                        <Card className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-border bg-card px-5 py-5 md:flex-row md:items-start md:justify-between md:px-7">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-md border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground">
                                            {selectedModule.category}
                                        </span>
                                        <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
                                            v{selectedModule.version}
                                        </span>
                                        <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${statusClassName(selectedModule.status)}`}>
                                            {statusLabel(selectedModule.status)}
                                        </span>
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
                                    </div>
                                    <h1 className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-tight"><PageIcon name="modules" />{selectedModule.name}</h1>
                                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                                        {selectedModule.description || 'No description provided.'}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon"
                                    type="button"
                                    onClick={closeModulePreview}
                                    className="inline-flex shrink-0 items-center justify-center transition-colors"
                                    aria-label="Close module preview"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </Button>
                            </div>

                            <div className="px-5 py-6 md:px-7">
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                                    <section>
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
                                    </section>

                                    <aside className="space-y-4">
                                        <Card className="rounded-xl border border-border bg-card p-5">
                                            <p className="text-xs font-medium text-muted-foreground">Slug</p>
                                            <p className="mt-2 break-all font-mono text-sm text-foreground">{selectedModule.slug}</p>
                                        </Card>
                                        <Card className="rounded-xl border border-border bg-card p-5">
                                            <p className="text-xs font-medium text-muted-foreground">Review Status</p>
                                            <p className="mt-2 text-sm font-semibold text-foreground">{statusLabel(selectedModule.status)}</p>
                                            {selectedModule.status === 'REJECTED' && selectedModule.moderationNote && (
                                                <p className="mt-2 text-xs leading-relaxed text-red-700 dark:text-red-400">{selectedModule.moderationNote}</p>
                                            )}
                                        </Card>
                                        <Card className="rounded-xl border border-border bg-card p-5">
                                            <p className="text-xs font-medium text-muted-foreground">Published</p>
                                            <p className="mt-2 text-sm font-semibold text-foreground">{formatDate(selectedModule.publishedAt)}</p>
                                        </Card>
                                        <Card className="rounded-xl border border-border bg-card p-5">
                                            <p className="text-xs font-medium text-muted-foreground">Checksum</p>
                                            <p className="mt-2 break-all font-mono text-xs text-foreground">{selectedModule.sourceChecksum || 'Unavailable'}</p>
                                        </Card>
                                        <Button variant="default" size="default"
                                            type="button"
                                            onClick={() => openInstallPicker(selectedModule.id)}
                                            className="inline-flex w-full items-center justify-center transition-colors"
                                        >
                                            Select Server To Install
                                        </Button>
                                    </aside>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {installPickerModule && (
                    <Dialog open onOpenChange={(next) => { if (!next) closeInstallPicker(); }}><DialogContent aria-describedby={undefined} className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
                            <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-5">
                                <div>
                                    <p className="text-xs font-medium text-foreground">Install Module</p>
                                    <DialogTitle className="mt-2 text-2xl">{installPickerModule.name}</DialogTitle>
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                        Click a server to install. Right-click a server to start multi-select.
                                    </p>
                                </div>
                                <Button variant="outline" size="default"
                                    type="button"
                                    onClick={closeInstallPicker}
                                    className="inline-flex shrink-0 items-center justify-center transition-colors disabled:opacity-50"
                                    aria-label="Close install picker"
                                    disabled={installing}
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </Button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-170px)] overflow-y-auto px-5 py-5">
                                {installError && (
                                    <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
                                        {installError}
                                    </div>
                                )}
                                {installMessage && (
                                    <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                        {installMessage}
                                    </div>
                                )}

                                {installTargets.length === 0 ? (
                                    <Card className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                                        No servers are available for module installs.
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {installTargets.map((server) => {
                                            const selected = selectedServerIds.includes(server.id);
                                            const full = server.installedModuleCount >= server.moduleLimit;

                                            return (
                                                <Button variant="outline" size="default"
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
                                                    className={`flex min-h-20 items-center     text-left transition-colors disabled:opacity-50 ${selected ? ' ' : '  '}`}
                                                >
                                                    {server.icon ? (
                                                        <img
                                                            src={getDiscordGuildIconProxyUrl(server.id, server.icon)}
                                                            alt=""
                                                            className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
                                                        />
                                                    ) : (
                                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-medium text-foreground">
                                                            {server.name.substring(0, 1)}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0">
                                                        <span className="block break-words text-sm font-medium text-foreground">{server.name}</span>
                                                        <span className="mt-1 block font-mono text-xs font-medium text-muted-foreground">
                                                            {full ? `${server.installedModuleCount}/${server.moduleLimit} installed` : selected ? 'Selected' : `${server.installedModuleCount}/${server.moduleLimit} installed`}
                                                        </span>
                                                    </span>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {multiSelectInstall && installTargets.length > 0 && (
                                <div className="flex flex-col gap-3 border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        {selectedServerIds.length} server{selectedServerIds.length === 1 ? '' : 's'} selected
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="default"
                                            type="button"
                                            onClick={() => {
                                                setMultiSelectInstall(false);
                                                setSelectedServerIds([]);
                                            }}
                                            disabled={installing}
                                            className="transition-colors disabled:opacity-50"
                                        >
                                            Cancel
                                        </Button>
                                        <Button variant="default" size="default"
                                            type="button"
                                            onClick={() => installModuleToServers(installPickerModule.id, selectedServerIds)}
                                            disabled={installing || selectedServerIds.length === 0}
                                            className="transition-colors disabled:opacity-50"
                                        >
                                            {installing ? 'Installing' : 'Install Selected'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </DialogContent></Dialog>
                )}
            </main>
        </div>
    );
}
