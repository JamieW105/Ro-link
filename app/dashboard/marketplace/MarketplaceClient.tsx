'use client';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { useRouter } from 'next/navigation';
import { DashboardHeader, DashboardBrand } from "@/components/dashboard/DashboardHeader";
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Loader2, Plus, Search, X } from 'lucide-react';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Status, StatusLabel } from '@/components/ui/status';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Image from 'next/image';


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

function formatDate(value: string | null) {
    if (!value) return 'Unpublished';
    return new Date(value).toLocaleDateString();
}

function statusVariant(status: string) {
    if (status === 'PUBLISHED') return 'success';
    if (status === 'PENDING_REVIEW') return 'warning';
    if (status === 'REJECTED') return 'error';
    return 'default';
}

function ModuleBadges({ addon }: { addon: MarketplaceModule }) {
    return <div className="flex flex-wrap items-center gap-2">
        <Status><StatusLabel>{addon.category}</StatusLabel></Status>
        <Status variant={statusVariant(addon.status)}><StatusLabel>{statusLabel(addon.status)}</StatusLabel></Status>
        {addon.isOfficial && <Status><StatusLabel>Official</StatusLabel></Status>}
        {addon.creatorIsVerified && <Status variant="info"><StatusLabel>Verified creator</StatusLabel></Status>}
    </div>;
}

function ServerIdentity({ server }: { server: InstallTarget }) {
    const [failed, setFailed] = useState(false);
    return <>
        {server.icon && !failed
            ? <Image unoptimized width={32} height={32} src={getDiscordGuildIconProxyUrl(server.id, server.icon)} alt="" onError={() => setFailed(true)} className="size-8 shrink-0 rounded-md object-cover" />
            : <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">{server.name.slice(0, 1)}</span>}
        <span className="min-w-0 flex-1 space-y-1 text-left">
            <span className="block break-words text-sm font-medium">{server.name}</span>
            <span className="block text-xs text-muted-foreground">{server.installedModuleCount}/{server.moduleLimit} installed{server.installedModuleCount >= server.moduleLimit ? ' · Limit reached' : ''}</span>
        </span>
    </>;
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
    const { status } = useSession();
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
        return <div role="status" className="flex min-h-dvh items-center justify-center gap-2 bg-background text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading marketplace…</div>;
    }

    if (status === 'unauthenticated') {
        return <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <LucideShieldAlert className="mb-2 size-5 text-muted-foreground" aria-hidden="true" />
                    <CardTitle>Sign in to the marketplace</CardTitle>
                    <CardDescription>Authenticate with Discord to browse community modules.</CardDescription>
                </CardHeader>
                <CardFooter><Button type="button" onClick={() => signIn('discord', { callbackUrl: '/dashboard/marketplace' })}>Sign In with Discord</Button></CardFooter>
            </Card>
        </main>;
    }

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <DashboardHeader contained>
                <DashboardBrand label="Marketplace" />
                <div className="flex shrink-0 items-center gap-2">
                    <ThemeToggle />
                    <Button asChild variant="outline" size="sm"><Link href="/dashboard"><ArrowLeft className="size-3.5" aria-hidden="true" />All servers</Link></Button>
                </div>
            </DashboardHeader>

            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
                {!productView && <>
                    <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                        <div>
                            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><PageIcon name="marketplace" />Module marketplace</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Extend your workspace with tools built for your community.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" size="sm"><Link href="/dashboard/creator/modules">My modules</Link></Button>
                            <Button asChild size="sm"><Link href="/dashboard/marketplace/create"><Plus className="size-4" aria-hidden="true" />Create module</Link></Button>
                        </div>
                    </header>
                    <Card aria-label="Filter modules" className="mb-4">
                        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1 space-y-2">
                                <label htmlFor="marketplace-search" className="text-sm font-medium">Search modules</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                    <Input id="marketplace-search" aria-label="Search modules" placeholder="Search modules…" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" />
                                </div>
                            </div>
                            <div className="space-y-2 sm:w-56">
                                <label htmlFor="marketplace-category" className="text-sm font-medium">Category</label>
                                <Select id="marketplace-category" aria-label="Module category" value={category} onValueChange={setCategory} options={[{ value: 'all', label: 'All categories' }, ...categories.map(value => ({ value, label: value }))]} />
                            </div>
                        </CardContent>
                    </Card>

                    {loading ? (
                        <Card><CardContent role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading modules…</CardContent></Card>
                    ) : error ? (
                        <Card role="alert"><CardHeader><CardTitle>Marketplace unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card>
                    ) : filteredModules.length === 0 ? (
                        <Card><CardHeader>
                            <CardTitle>No modules found</CardTitle>
                            <CardDescription>{modules.length ? 'Try another search or category.' : 'There are no modules available to browse yet.'}</CardDescription>
                        </CardHeader>{modules.length > 0 && <CardFooter><Button type="button" variant="outline" size="sm" onClick={() => { setSearch(''); setCategory('all'); }}>Reset filters</Button></CardFooter>}</Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {filteredModules.map(addon => <Card key={addon.id} aria-label={addon.name} className="flex min-w-0 flex-col">
                                <CardHeader className="gap-3 p-4">
                                    <ModuleBadges addon={addon} />
                                    <CardTitle className="break-words leading-snug">{addon.name}</CardTitle>
                                    <CardDescription className="line-clamp-3 leading-relaxed">{addon.description || 'No description provided.'}</CardDescription>
                                </CardHeader>
                                <CardFooter className="mt-auto justify-between border-t border-border p-4">
                                    <span className="text-xs text-muted-foreground">v{addon.version}</span>
                                    <Button asChild variant="outline" size="sm"><Link href={`/dashboard/marketplace/${encodeURIComponent(addon.slug)}`} aria-label={`View ${addon.name}`}>View module<ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
                                </CardFooter>
                            </Card>)}
                        </div>
                    )}
                    <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                        <p role="status">{filteredModules.length} module{filteredModules.length === 1 ? '' : 's'}</p>
                        <Button asChild variant="link" className="h-auto p-0 text-xs"><Link href="/terms/modules/use">Module terms</Link></Button>
                    </div>
                </>}
                {productView && <Button type="button" variant="ghost" size="sm" onClick={closeModulePreview} className="mb-6"><ArrowLeft className="size-4" aria-hidden="true" />Back to marketplace</Button>}
                {moduleSlug && loading && <Card><CardContent role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading module…</CardContent></Card>}
                {moduleSlug && !loading && !selectedModule && <Card><CardHeader><CardTitle>{error ? 'Module unavailable' : 'Module not found'}</CardTitle><CardDescription>{error || 'This module is unavailable or you do not have access to it.'}</CardDescription></CardHeader></Card>}

                {selectedModule && <>
                    <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                        <div className="min-w-0 space-y-3">
                            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><PageIcon name="modules" /><span className="min-w-0 break-words">{selectedModule.name}</span></h1>
                            <ModuleBadges addon={selectedModule} />
                            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{selectedModule.description || 'No description provided.'}</p>
                        </div>
                        <Button type="button" onClick={() => openInstallPicker(selectedModule.id)} className="shrink-0"><Plus className="size-4" aria-hidden="true" />Select Server To Install</Button>
                    </header>
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <Card className="min-w-0">
                            <CardHeader className="p-4"><CardTitle>Configuration fields</CardTitle><CardDescription>Settings available after installing this module.</CardDescription></CardHeader>
                            {Object.values(selectedModule.configSchema || {}).length === 0 ? (
                                <CardContent className="px-4 pb-4 text-sm text-muted-foreground">This module does not expose configurable fields.</CardContent>
                            ) : (
                                <Table className="table-fixed">
                                    <caption className="sr-only">Module configuration fields</caption>
                                    <TableHeader><TableRow><TableHead className="pl-4">Field</TableHead><TableHead className="w-28 pr-4">Type</TableHead></TableRow></TableHeader>
                                    <TableBody>{Object.values(selectedModule.configSchema || {}).map(field => <TableRow key={field.key}>
                                        <TableCell className="space-y-2 py-4 pl-4 align-top">
                                            <p className="break-words font-medium">{field.label}</p>
                                            <p className="break-words text-sm leading-relaxed text-muted-foreground">{field.shortDescription || 'No field description provided.'}</p>
                                            {field.options.length > 0 && <div className="flex flex-wrap gap-1.5">
                                                {field.options.slice(0, 6).map(option => <Status key={option} className="max-w-full"><StatusLabel className="whitespace-normal break-words leading-relaxed">{option}</StatusLabel></Status>)}
                                                {field.options.length > 6 && <Status><StatusLabel>+{field.options.length - 6} more</StatusLabel></Status>}
                                            </div>}
                                        </TableCell>
                                        <TableCell className="py-4 pr-4 align-top"><Status><StatusLabel>{field.type}</StatusLabel></Status></TableCell>
                                    </TableRow>)}</TableBody>
                                </Table>
                            )}
                        </Card>
                        <Card className="min-w-0">
                            <CardHeader className="p-4"><CardTitle>Module details</CardTitle><CardDescription>Version and publication information.</CardDescription></CardHeader>
                            <CardContent className="px-4 pb-4">
                                <dl className="space-y-4 text-sm">
                                    <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Version</dt><dd>v{selectedModule.version}</dd></div>
                                    <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Review status</dt><dd><Status variant={statusVariant(selectedModule.status)}><StatusLabel>{statusLabel(selectedModule.status)}</StatusLabel></Status></dd></div>
                                    <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Published</dt><dd>{formatDate(selectedModule.publishedAt)}</dd></div>
                                    <div className="space-y-1"><dt className="text-muted-foreground">Slug</dt><dd className="break-all font-mono text-xs">{selectedModule.slug}</dd></div>
                                    <div className="space-y-1"><dt className="text-muted-foreground">Checksum</dt><dd className="break-all font-mono text-xs">{selectedModule.sourceChecksum || 'Unavailable'}</dd></div>
                                </dl>
                                {selectedModule.status === 'REJECTED' && selectedModule.moderationNote && <Status role="alert" variant="error" className="mt-4 w-full rounded-md"><StatusLabel className="whitespace-normal leading-relaxed">{selectedModule.moderationNote}</StatusLabel></Status>}
                            </CardContent>
                        </Card>
                    </div>
                </>}

                {installPickerModule && <Dialog open onOpenChange={open => { if (!open) closeInstallPicker(); }}>
                    <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden p-0" onEscapeKeyDown={event => { if (installing) event.preventDefault(); }} onInteractOutside={event => { if (installing) event.preventDefault(); }}>
                        <DialogHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b border-border p-4">
                            <div className="space-y-2">
                                <DialogTitle>{installPickerModule.name}</DialogTitle>
                                <DialogDescription>Choose a server to install immediately, or enable multi-server selection.</DialogDescription>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Close install picker" onClick={closeInstallPicker} disabled={installing}><X className="size-4" aria-hidden="true" /></Button>
                        </DialogHeader>
                        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                            {installError && <Status role="alert" variant="error" className="w-full rounded-md"><StatusLabel className="whitespace-normal leading-relaxed">{installError}</StatusLabel></Status>}
                            {installMessage && <Status role="status" variant="success" className="w-full rounded-md"><StatusLabel className="whitespace-normal leading-relaxed">{installMessage}</StatusLabel></Status>}
                            {installTargets.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">No servers are available for module installs.</p>
                            ) : <>
                                <label className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium">Multi-server selection<Switch checked={multiSelectInstall} disabled={installing} onCheckedChange={checked => { setMultiSelectInstall(checked); setSelectedServerIds([]); }} /></label>
                                <div className="space-y-2">
                                    {installTargets.map(server => {
                                        const selected = selectedServerIds.includes(server.id);
                                        const full = server.installedModuleCount >= server.moduleLimit;
                                        return multiSelectInstall ? (
                                            <label key={server.id} className="flex items-center gap-3 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-accent/50 has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50">
                                                <Checkbox aria-label={`Select ${server.name}`} checked={selected} disabled={installing || full} onCheckedChange={() => toggleServerSelection(server.id)} />
                                                <ServerIdentity server={server} />
                                            </label>
                                        ) : (
                                            <Button key={server.id} type="button" variant="outline" disabled={installing || full} onClick={() => installModuleToServers(installPickerModule.id, [server.id])} onContextMenu={event => { event.preventDefault(); if (!installing && !full) { setMultiSelectInstall(true); toggleServerSelection(server.id); } }} className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal p-3 text-left">
                                                <ServerIdentity server={server} />
                                            </Button>
                                        );
                                    })}
                                </div>
                            </>}
                        </div>
                        {multiSelectInstall && installTargets.length > 0 && <DialogFooter className="shrink-0 items-center justify-between border-t border-border p-4 sm:justify-between">
                            <p className="text-xs text-muted-foreground">{selectedServerIds.length} server{selectedServerIds.length === 1 ? '' : 's'} selected</p>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => { setMultiSelectInstall(false); setSelectedServerIds([]); }} disabled={installing}>Cancel</Button>
                                <Button type="button" onClick={() => installModuleToServers(installPickerModule.id, selectedServerIds)} disabled={installing || selectedServerIds.length === 0}>{installing ? 'Installing…' : 'Install Selected'}</Button>
                            </div>
                        </DialogFooter>}
                    </DialogContent>
                </Dialog>}
            </main>
        </div>
    );
}
