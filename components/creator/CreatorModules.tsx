'use client';
import { useSuccessNotice } from '@/hooks/use-success-notice';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { DashboardHeader, DashboardBrand } from "@/components/dashboard/DashboardHeader";
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Stat, StatLabel, StatValue } from '@/components/ui/stat';
import { Status } from '@/components/ui/status';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';

import { Checkbox } from '@/components/ui/checkbox';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import { LuauCodeEditor } from '@/components/dashboard/LuauSyntax';

type ModuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
type CreatorFilter = 'ALL' | ModuleStatus;
type ModuleConfigFieldType = 'bool' | 'dropdown' | 'checkboxes' | 'color' | 'integer' | 'string' | 'group' | 'player' | 'server';

interface ModuleConfigField {
    key: string;
    label: string;
    shortDescription: string;
    type: ModuleConfigFieldType;
    options: string[];
    defaultValue: boolean | string | string[] | number | Record<string, unknown>;
}

interface CreatorModule {
    id: string;
    slug: string;
    name: string;
    description: string;
    version: string;
    category: string;
    status: ModuleStatus;
    isOfficial: boolean;
    creatorIsVerified: boolean;
    creatorApprovedModuleCount: number;
    creatorMaxModuleInstallCount: number;
    sourceCode?: string;
    sourceChecksum: string;
    configSchema: Record<string, ModuleConfigField>;
    submittedAt: string | null;
    reviewedAt: string | null;
    moderationNote: string;
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
}

interface ModuleForm {
    name: string;
    slug: string;
    description: string;
    version: string;
    category: string;
    sourceCode: string;
}

const emptyForm: ModuleForm = {
    name: '',
    slug: '',
    description: '',
    version: '1.0.0',
    category: 'General',
    sourceCode: '',
};

const moduleFilters: { value: CreatorFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'PENDING_REVIEW', label: 'Review' },
    { value: 'DRAFT', label: 'Drafts' },
    { value: 'REJECTED', label: 'Needs Work' },
];

function moduleToForm(addon: CreatorModule): ModuleForm {
    return {
        name: addon.name,
        slug: addon.slug,
        description: addon.description,
        version: addon.version,
        category: addon.category,
        sourceCode: addon.sourceCode || '',
    };
}

function statusLabel(status: ModuleStatus) {
    if (status === 'PENDING_REVIEW') return 'Awaiting Moderation';
    return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

function statusVariant(status: ModuleStatus) {
    if (status === 'PUBLISHED') return 'success';
    if (status === 'PENDING_REVIEW') return 'warning';
    if (status === 'REJECTED') return 'error';
    return 'default';
}

function formatDate(value: string | null) {
    if (!value) return 'Never';
    return new Date(value).toLocaleString();
}

function buildPayload(form: ModuleForm, status: 'DRAFT' | 'PENDING_REVIEW') {
    return {
        name: form.name,
        ...(form.slug.trim() ? { slug: form.slug } : {}),
        description: form.description,
        version: form.version,
        category: form.category,
        sourceCode: form.sourceCode,
        status,
    };
}

export default function CreatorModules({ moduleId }: { moduleId?: string }) {
    const router = useRouter();
    const isEditor = moduleId !== undefined;
    const isNew = moduleId === 'new';
    const { status } = useSession();
    const [modules, setModules] = useState<CreatorModule[]>([]);
    const [form, setForm] = useState<ModuleForm>(emptyForm);
    const [acceptedCreatorTerms, setAcceptedCreatorTerms] = useState(false);
    const [acceptedUseTerms, setAcceptedUseTerms] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmation, setConfirmation] = useState<'archive' | 'delete' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useSuccessNotice<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<CreatorFilter>('ALL');

    const selectedModule = useMemo(
        () => modules.find((addon) => addon.id === moduleId) || null,
        [modules, moduleId],
    );

    const filteredModules = useMemo(() => {
        const query = search.trim().toLowerCase();

        return modules.filter((addon) => {
            const matchesStatus = statusFilter === 'ALL' || addon.status === statusFilter;
            const matchesQuery = !query
                || addon.name.toLowerCase().includes(query)
                || addon.slug.toLowerCase().includes(query)
                || addon.category.toLowerCase().includes(query)
                || addon.status.toLowerCase().includes(query);

            return matchesStatus && matchesQuery;
        });
    }, [modules, search, statusFilter]);

    const stats = useMemo(() => ({
        total: modules.length,
        pending: modules.filter((addon) => addon.status === 'PENDING_REVIEW').length,
        published: modules.filter((addon) => addon.status === 'PUBLISHED').length,
        drafts: modules.filter((addon) => addon.status === 'DRAFT').length,
        rejected: modules.filter((addon) => addon.status === 'REJECTED').length,
    }), [modules]);

    const configFields = useMemo(
        () => Object.values(selectedModule?.configSchema || {}),
        [selectedModule],
    );

    useEffect(() => {
        if (status !== 'authenticated') {
            if (status === 'unauthenticated') setLoading(false);
            return;
        }

        loadModules();
    }, [status]);

    useEffect(() => {
        if (selectedModule) {
            setForm(moduleToForm(selectedModule));
        } else {
            setForm(emptyForm);
        }
        setAcceptedCreatorTerms(false);
        setAcceptedUseTerms(false);
        setError(null);
        setSuccess(null);
    }, [selectedModule, moduleId, setSuccess]);

    async function loadModules() {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/dashboard/creator/modules', { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to load creator modules.'));
            }

            const nextModules = Array.isArray(payload.modules) ? payload.modules : [];
            setModules(nextModules);

        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load creator modules.');
        } finally {
            setLoading(false);
        }
    }

    function updateForm<K extends keyof ModuleForm>(key: K, value: ModuleForm[K]) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        setForm((current) => ({
            ...current,
            name: current.name || file.name.replace(/\.(lua|luau|txt)$/i, ''),
            sourceCode: text,
        }));
    }

    async function saveModule(nextStatus: 'DRAFT' | 'PENDING_REVIEW') {
        if (nextStatus === 'PENDING_REVIEW' && (!acceptedCreatorTerms || !acceptedUseTerms)) {
            setError('You must accept both module terms before submitting for moderation.');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const endpoint = selectedModule
                ? `/api/dashboard/creator/modules/${selectedModule.id}`
                : '/api/dashboard/creator/modules';
            const response = await fetch(endpoint, {
                method: selectedModule ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(form, nextStatus)),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to save module.'));
            }

            const savedModule = payload.module as CreatorModule;
            setModules((current) => {
                const exists = current.some((addon) => addon.id === savedModule.id);
                const nextModules = exists
                    ? current.map((addon) => addon.id === savedModule.id ? savedModule : addon)
                    : [savedModule, ...current];

                return nextModules.sort((first, second) => (
                    new Date(second.updatedAt || 0).getTime() - new Date(first.updatedAt || 0).getTime()
                ));
            });
            if (isNew) router.replace(`/dashboard/creator/modules/${encodeURIComponent(savedModule.id)}/edit`);
            setSuccess(nextStatus === 'PENDING_REVIEW' ? 'Module submitted for moderation.' : 'Draft saved.');
            setAcceptedCreatorTerms(false);
            setAcceptedUseTerms(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save module.');
        } finally {
            setSaving(false);
        }
    }

    async function archiveModule() {
        if (!selectedModule) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/dashboard/creator/modules/${selectedModule.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'ARCHIVED' }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to archive module.'));
            }

            const archivedModule = payload.module as CreatorModule;
            setModules((current) => current.map((addon) => addon.id === archivedModule.id ? archivedModule : addon));
            setSuccess('Module archived.');
        } catch (archiveError) {
            setError(archiveError instanceof Error ? archiveError.message : 'Failed to archive module.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteModule() {
        if (!selectedModule) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/dashboard/creator/modules/${selectedModule.id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to delete module.'));
            }

            const remainingModules = modules.filter((addon) => addon.id !== selectedModule.id);
            setModules(remainingModules);
            router.push('/dashboard/creator/modules');
            setSuccess('Module deleted.');
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete module.');
        } finally {
            setSaving(false);
        }
    }

    async function submitModule(event: FormEvent) {
        event.preventDefault();
        await saveModule('PENDING_REVIEW');
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Status role="status">Loading creator modules…</Status>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <Image src="/Media/Ro-LinkIcon.png" alt="" width={48} height={48} className="mx-auto mb-3 h-12 w-12 object-contain" />
                        <CardTitle>Sign in required</CardTitle>
                        <CardDescription>Authenticate with Discord before managing creator modules and marketplace submissions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button type="button" onClick={() => signIn('discord')}>Sign In with Discord</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <DashboardHeader contained>
                <DashboardBrand label="My modules" />
                <div className="flex shrink-0 items-center gap-2">
                    <ThemeToggle />
                    <Button asChild variant="outline" size="sm"><Link href="/dashboard/marketplace">Marketplace</Link></Button>
                    <Button asChild size="sm"><Link href="/dashboard/creator/modules/new">New Module</Link></Button>
                </div>
            </DashboardHeader>

            <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 md:py-10">
                <header className="mb-6 border-b border-border pb-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="min-w-0">
                            <Link href={isEditor ? "/dashboard/creator/modules" : "/dashboard"} className="text-xs font-medium text-foreground hover:text-foreground">
                                {isEditor ? "Back to My Modules" : "Back to Dashboard"}
                            </Link>
                            <h1 className="mt-4 text-2xl font-semibold text-foreground md:text-3xl flex items-center gap-3"><PageIcon name="creator" />{isEditor ? (isNew ? "New Module" : "Edit Module") : "Creator Dashboard"}</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                                {isEditor ? "Update module details and source, save a draft, or submit for review." : "Browse all your modules, track review progress, and choose a module to edit."}
                            </p>
                        </div>
                        {!isEditor && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                            {[
                                ['Total', stats.total, 'text-foreground'],
                                ['Published', stats.published, 'text-emerald-700 dark:text-emerald-400'],
                                ['In Review', stats.pending, 'text-amber-700 dark:text-amber-400'],
                                ['Needs Work', stats.rejected, 'text-red-700 dark:text-red-400'],
                            ].map(([label, value, color]) => (
                                <Stat key={label}><StatLabel>{label}</StatLabel><StatValue className={String(color)}>{value}</StatValue></Stat>
                            ))}
                        </div>}
                    </div>
                </header>

                {error && (
                    <Status role="alert" variant="error" className="mb-6 max-w-full whitespace-normal">
                        {error}
                    </Status>
                )}
                {success && (
                    <Status role="status" variant="success" className="mb-6 max-w-full whitespace-normal">
                        {success}
                    </Status>
                )}

                <div className="space-y-6">
                    {!isEditor && <div className="space-y-4">
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Module Library</CardTitle>
                                    <CardDescription>{filteredModules.length} of {modules.length} shown</CardDescription>
                                </div>
                                <Status>{stats.drafts} drafts</Status>
                            </CardHeader>
                            <CardContent>
                            <Input
                                aria-label="Search creator modules"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search name, slug, category..."
                                className="mt-4 w-full transition-colors"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                                {moduleFilters.map((filter) => (
                                    <Button variant={statusFilter === filter.value ? "secondary" : "outline"} size="sm"
                                        key={filter.value}
                                        type="button"
                                        onClick={() => setStatusFilter(filter.value)}
                                        aria-pressed={statusFilter === filter.value}
                                    >
                                        {filter.label}
                                    </Button>
                                ))}
                            </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-4" aria-label="Your modules">
                            {filteredModules.map((addon) => (
                                <Card key={addon.id} className="relative bg-muted/40 transition-colors hover:bg-accent/60 focus-within:ring-2 focus-within:ring-ring">
                                    <CardHeader className="gap-6">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Status variant={statusVariant(addon.status)}>{statusLabel(addon.status)}</Status>
                                            {addon.isOfficial && <Status>Official</Status>}
                                            {addon.creatorIsVerified && <Status variant="success">Verified Creator</Status>}
                                        </div>
                                        <CardTitle className="break-words leading-relaxed">
                                            <Link href={`/dashboard/creator/modules/${encodeURIComponent(addon.id)}/edit`} aria-label={`Edit ${addon.name}`} className="outline-none after:absolute after:inset-0 after:rounded-xl">{addon.name}</Link>
                                        </CardTitle>
                                        <CardDescription className="break-words">{addon.description || 'No description yet.'}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-wrap gap-2 font-mono text-xs text-muted-foreground">
                                        <span className="break-all">{addon.slug || 'auto-slug'}</span><span>v{addon.version}</span>
                                    </CardContent>
                                </Card>
                            ))}

                            {filteredModules.length === 0 && (
                                <Card className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                                    {modules.length > 0 ? 'No modules match this view.' : 'No modules yet.'}
                                </Card>
                            )}
                        </div>
                    </div>}

                    {isEditor && !isNew && !selectedModule && !error && <Card>
                        <CardHeader><CardTitle>Module not found</CardTitle><CardDescription>This module is unavailable or you do not have permission to edit it.</CardDescription></CardHeader>
                        <CardContent><Button asChild variant="outline"><Link href="/dashboard/creator/modules">Back to My Modules</Link></Button></CardContent>
                    </Card>}
                    {isEditor && (isNew || selectedModule) && <form onSubmit={submitModule} className="min-w-0 space-y-5">
                        <Card className="min-w-0">
                            <CardHeader className="gap-5 border-b border-border lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {selectedModule ? (
                                            <Status variant={statusVariant(selectedModule.status)}>
                                                {statusLabel(selectedModule.status)}
                                            </Status>
                                        ) : (
                                            <Status>New Draft</Status>
                                        )}
                                        {selectedModule?.sourceChecksum && (
                                            <Status className="font-mono">
                                                checksum {selectedModule.sourceChecksum.slice(0, 12)}
                                            </Status>
                                        )}
                                        {selectedModule?.creatorIsVerified && (
                                            <Status variant="success">Verified Creator</Status>
                                        )}
                                    </div>
                                    <CardTitle className="mt-3 break-words text-xl">
                                        {selectedModule ? selectedModule.name : 'New Module'}
                                    </CardTitle>
                                    <CardDescription className="mt-2">
                                        {selectedModule
                                            ? `Updated ${formatDate(selectedModule.updatedAt)}. Submitted ${formatDate(selectedModule.submittedAt)}.`
                                            : 'Fill out the details, add source, then save or submit when it is ready.'}
                                    </CardDescription>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-md lg:justify-end">
                                    <Button variant="outline" size="default"
                                        type="button"
                                        onClick={() => saveModule('DRAFT')}
                                        disabled={saving}
                                        className="transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Saving' : 'Save Draft'}
                                    </Button>
                                    <Button variant="default" size="default"
                                        type="submit"
                                        disabled={saving}
                                        className="transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Submitting' : 'Submit Review'}
                                    </Button>
                                    {selectedModule && selectedModule.status !== 'ARCHIVED' && (
                                        <Button variant="outline" size="default"
                                            type="button"
                                            onClick={() => setConfirmation('archive')}
                                            disabled={saving}
                                            className="transition-colors disabled:opacity-50"
                                        >
                                            Archive
                                        </Button>
                                    )}
                                    {selectedModule && (
                                        <Button variant="destructive" size="default"
                                            type="button"
                                            onClick={() => setConfirmation('delete')}
                                            disabled={saving}
                                            className="transition-colors disabled:opacity-50"
                                        >
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>

                            {selectedModule?.status === 'REJECTED' && selectedModule.moderationNote && (
                                <Status variant="error" className="mx-6 mt-5 whitespace-normal">
                                    {selectedModule.moderationNote}
                                </Status>
                            )}

                            <CardContent className="pt-6">
                                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-foreground">Module Details</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">Metadata shown in the marketplace and review queue.</p>
                                    </div>
                                    <span className="font-mono text-xs text-muted-foreground">{form.sourceCode.length.toLocaleString()} source chars</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div>
                                    <label htmlFor="module-name" className="mb-2 block text-xs font-medium text-muted-foreground">Name</label>
                                    <Input
                                        id="module-name"
                                        value={form.name}
                                        onChange={(event) => updateForm('name', event.target.value)}
                                        required
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="module-slug" className="mb-2 block text-xs font-medium text-muted-foreground">Slug</label>
                                    <Input
                                        id="module-slug"
                                        value={form.slug}
                                        onChange={(event) => updateForm('slug', event.target.value)}
                                        placeholder="Auto from name"
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="module-version" className="mb-2 block text-xs font-medium text-muted-foreground">Version</label>
                                    <Input
                                        id="module-version"
                                        value={form.version}
                                        onChange={(event) => updateForm('version', event.target.value)}
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="module-category" className="mb-2 block text-xs font-medium text-muted-foreground">Category</label>
                                    <Input
                                        id="module-category"
                                        value={form.category}
                                        onChange={(event) => updateForm('category', event.target.value)}
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label htmlFor="module-description" className="mb-2 block text-xs font-medium text-muted-foreground">Description</label>
                                    <Textarea
                                        id="module-description"
                                        value={form.description}
                                        onChange={(event) => updateForm('description', event.target.value)}
                                        required
                                        className="min-h-28 w-full resize-y leading-relaxed transition-colors"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label htmlFor="module-upload" className="mb-2 block text-xs font-medium text-muted-foreground">Upload Source</label>
                                    <Input
                                        id="module-upload"
                                        type="file"
                                        accept=".lua,.luau,.txt"
                                        onChange={handleFileUpload}
                                        className="w-full file:mr-4"
                                    />
                                </div>
                                </div>
                            </CardContent>
                        </Card>

                        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                            <Card className="min-w-0 overflow-hidden">
                                <CardHeader className="flex-row items-center justify-between border-b border-border">
                                    <div>
                                        <CardTitle>Source Code</CardTitle>
                                        <CardDescription>Paste Luau source or upload a .lua, .luau, or .txt file.</CardDescription>
                                    </div>
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{form.sourceCode.length.toLocaleString()} chars</span>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <LuauCodeEditor
                                        value={form.sourceCode}
                                        onChange={(event) => updateForm('sourceCode', event.target.value)}
                                        required
                                        ariaLabel="Module source code"
                                        minHeightClassName="min-h-[400px]"
                                    />
                                </CardContent>
                            </Card>

                            <aside className="space-y-4">
                                <Card>
                                    <CardHeader><CardTitle>Review State</CardTitle><CardDescription>Publication and review history.</CardDescription></CardHeader><CardContent>
                                    <dl className="mt-4 divide-y divide-border text-sm">
                                        <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                                            <dt className="text-xs font-medium text-muted-foreground">Published</dt>
                                            <dd className="text-right text-foreground">{formatDate(selectedModule?.publishedAt || null)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 py-3">
                                            <dt className="text-xs font-medium text-muted-foreground">Reviewed</dt>
                                            <dd className="text-right text-foreground">{formatDate(selectedModule?.reviewedAt || null)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                                            <dt className="text-xs font-medium text-muted-foreground">Config Fields</dt>
                                            <dd className="text-right text-foreground">{configFields.length}</dd>
                                        </div>
                                    </dl></CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex-row items-center justify-between">
                                        <CardTitle>Submit Terms</CardTitle>
                                        <Status variant={acceptedCreatorTerms && acceptedUseTerms ? "success" : "default"}>{acceptedCreatorTerms && acceptedUseTerms ? "Ready" : "Required"}</Status>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground">
                                            <Checkbox
                                                checked={acceptedCreatorTerms}
                                                onCheckedChange={(checked) => setAcceptedCreatorTerms(checked === true)}
                                                className="mt-1"
                                            />
                                            <span>I agree to the <Link href="/terms/modules/create" className="text-foreground hover:text-foreground">module creator terms</Link>.</span>
                                        </label>
                                        <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground">
                                            <Checkbox
                                                checked={acceptedUseTerms}
                                                onCheckedChange={(checked) => setAcceptedUseTerms(checked === true)}
                                                className="mt-1"
                                            />
                                            <span>I understand the <Link href="/terms/modules/use" className="text-foreground hover:text-foreground">module use and UGC terms</Link>.</span>
                                        </label>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex-row items-center justify-between">
                                        <CardTitle>Parsed Config</CardTitle>
                                        <Status>{configFields.length}</Status>
                                    </CardHeader>
                                    <CardContent>
                                    {configFields.length > 0 ? (
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Field</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                                            <TableBody>{configFields.map((field) => (
                                                <TableRow key={field.key}>
                                                    <TableCell className="whitespace-normal"><p className="break-words font-medium">{field.label}</p><p className="break-all font-mono text-xs text-muted-foreground">{field.key}</p></TableCell>
                                                    <TableCell><Status>{field.type}</Status></TableCell>
                                                </TableRow>
                                            ))}</TableBody>
                                        </Table>
                                    ) : <p className="text-sm text-muted-foreground">No CONFIG fields are stored for this module yet.</p>}
                                    </CardContent>
                                </Card>
                            </aside>
                        </section>
                    </form>}
                </div>
            </main>
            <Dialog open={confirmation !== null} onOpenChange={(open) => { if (!open && !saving) setConfirmation(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmation === 'delete' ? 'Delete' : 'Archive'} {selectedModule?.name}?</DialogTitle>
                        <DialogDescription>{confirmation === 'delete' ? 'This permanently deletes the module and cannot be undone.' : 'This removes the module from marketplace installs.'}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmation(null)}>Cancel</Button>
                        <Button type="button" variant="destructive" disabled={saving} onClick={async () => {
                            if (confirmation === 'delete') await deleteModule(); else await archiveModule();
                            setConfirmation(null);
                        }}>{saving ? 'Saving…' : confirmation === 'delete' ? 'Delete module' : 'Archive module'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
