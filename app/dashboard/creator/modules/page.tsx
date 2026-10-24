'use client';
import { useSuccessNotice } from '@/hooks/use-success-notice';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { DashboardHeader, DashboardBrand } from "@/components/dashboard/DashboardHeader";
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

import { Card } from '@/components/ui/card';

import { Checkbox } from '@/components/ui/checkbox';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


import Link from 'next/link';
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
    return status.replace(/_/g, ' ');
}

function statusClassName(status: ModuleStatus) {
    if (status === 'PUBLISHED') return 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400';
    if (status === 'PENDING_REVIEW') return 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
    if (status === 'REJECTED') return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400';
    if (status === 'ARCHIVED') return 'border-border bg-card text-muted-foreground';
    return 'border-border bg-accent text-foreground';
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

export default function CreatorModulesPage() {
    const { status } = useSession();
    const [modules, setModules] = useState<CreatorModule[]>([]);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [form, setForm] = useState<ModuleForm>(emptyForm);
    const [acceptedCreatorTerms, setAcceptedCreatorTerms] = useState(false);
    const [acceptedUseTerms, setAcceptedUseTerms] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useSuccessNotice<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<CreatorFilter>('ALL');

    const selectedModule = useMemo(
        () => modules.find((addon) => addon.id === selectedModuleId) || null,
        [modules, selectedModuleId],
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
    }, [selectedModule, setSuccess]);

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
            setSelectedModuleId((current) => (
                current && nextModules.some((addon: CreatorModule) => addon.id === current)
                    ? current
                    : nextModules[0]?.id || null
            ));
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

    function startNewModule() {
        setSelectedModuleId(null);
        setForm(emptyForm);
        setAcceptedCreatorTerms(false);
        setAcceptedUseTerms(false);
        setError(null);
        setSuccess(null);
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
            setSelectedModuleId(savedModule.id);
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
        if (!selectedModule || !confirm(`Archive ${selectedModule.name}? It will be removed from marketplace installs.`)) return;

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
        if (!selectedModule || !confirm(`Delete ${selectedModule.name}? This cannot be undone.`)) return;

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
            setSelectedModuleId(remainingModules[0]?.id || null);
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
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
                <Card className="w-full max-w-md rounded-xl border border-border bg-card p-8">
                    <Image src="/Media/Ro-LinkIcon.png" alt="" width={48} height={48} className="mx-auto mb-5 h-12 w-12 object-contain" />
                    <h1 className="text-2xl font-medium">Sign in required</h1>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">Authenticate with Discord before managing creator modules and marketplace submissions.</p>
                <Button variant="default" size="default"
                    onClick={() => signIn('discord')}
                        className="mt-8 transition-colors"
                >
                    Sign In with Discord
                </Button>
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
                    <Button size="sm" type="button" onClick={startNewModule}>New Module</Button>
                </div>
            </DashboardHeader>

            <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 md:py-10">
                <header className="mb-6 border-b border-border pb-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="min-w-0">
                            <Link href="/dashboard" className="text-xs font-medium text-foreground hover:text-foreground">
                                Back to Dashboard
                            </Link>
                            <h1 className="mt-4 text-3xl font-semibold text-foreground md:text-5xl flex items-center gap-3"><PageIcon name="creator" />Creator Dashboard</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                                Build modules, track review progress, and manage published work from one focused workspace.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                            {[
                                ['Total', stats.total, 'text-foreground'],
                                ['Published', stats.published, 'text-emerald-700 dark:text-emerald-400'],
                                ['In Review', stats.pending, 'text-amber-700 dark:text-amber-400'],
                                ['Needs Work', stats.rejected, 'text-red-700 dark:text-red-400'],
                            ].map(([label, value, color]) => (
                                <div key={label} className="rounded-lg border border-border bg-background px-4 py-4">
                                    <div className={`text-2xl font-semibold ${color}`}>{value}</div>
                                    <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {success}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                    <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                        <Card className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-medium text-foreground">Module Library</h2>
                                    <p className="mt-1 text-xs text-muted-foreground">{filteredModules.length} of {modules.length} shown</p>
                                </div>
                                <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                                    {stats.drafts} drafts
                                </span>
                            </div>
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search name, slug, category..."
                                className="mt-4 w-full transition-colors"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                                {moduleFilters.map((filter) => (
                                    <Button variant="outline" size="default"
                                        key={filter.value}
                                        type="button"
                                        onClick={() => setStatusFilter(filter.value)}
                                        className={`        transition-colors ${statusFilter === filter.value ? '  ' : '    '}`}
                                    >
                                        {filter.label}
                                    </Button>
                                ))}
                            </div>
                        </Card>

                        <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                            <Button variant="outline" size="default"
                                type="button"
                                onClick={startNewModule}
                                className={`w-full    text-left transition-colors ${selectedModule ? '   ' : ' '}`}
                            >
                                <span className="text-sm font-medium text-foreground">Create a new module</span>
                                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Start a draft with fresh metadata and source.</span>
                            </Button>

                            {filteredModules.map((addon) => (
                                <Button variant="outline" size="default"
                                    key={addon.id}
                                    type="button"
                                    onClick={() => setSelectedModuleId(addon.id)}
                                    className={`h-auto min-h-9 justify-start whitespace-normal py-3 group w-full    text-left transition-colors ${selectedModuleId === addon.id ? '   ' : '   '}`}
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${statusClassName(addon.status)}`}>
                                            {statusLabel(addon.status)}
                                        </span>
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
                                    <span className="mt-3 block break-words text-sm font-medium text-foreground group-hover:text-foreground">{addon.name}</span>
                                    <span className="mt-2 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                        {addon.description || 'No description yet.'}
                                    </span>
                                    <span className="mt-3 flex flex-wrap gap-2 font-mono text-xs font-medium text-muted-foreground">
                                        <span>{addon.slug || 'auto-slug'}</span>
                                        <span>v{addon.version}</span>
                                    </span>
                                </Button>
                            ))}

                            {filteredModules.length === 0 && (
                                <Card className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                                    {modules.length > 0 ? 'No modules match this view.' : 'No modules yet.'}
                                </Card>
                            )}
                        </div>
                    </aside>

                    <form onSubmit={submitModule} className="min-w-0 space-y-5">
                        <section className="overflow-hidden rounded-xl border border-border bg-card">
                            <div className="flex flex-col gap-5 border-b border-border bg-background p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {selectedModule ? (
                                            <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${statusClassName(selectedModule.status)}`}>
                                                {statusLabel(selectedModule.status)}
                                            </span>
                                        ) : (
                                            <span className="rounded-md border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground">
                                                New Draft
                                            </span>
                                        )}
                                        {selectedModule?.sourceChecksum && (
                                            <span className="rounded-md border border-border bg-card px-2 py-1 font-mono text-xs font-medium text-muted-foreground">
                                                checksum {selectedModule.sourceChecksum.slice(0, 12)}
                                            </span>
                                        )}
                                        {selectedModule?.creatorIsVerified && (
                                            <span className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                Verified Creator
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="mt-3 break-words text-2xl font-semibold text-foreground md:text-3xl">
                                        {selectedModule ? selectedModule.name : 'New Module'}
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                        {selectedModule
                                            ? `Updated ${formatDate(selectedModule.updatedAt)}. Submitted ${formatDate(selectedModule.submittedAt)}.`
                                            : 'Fill out the details, add source, then save or submit when it is ready.'}
                                    </p>
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
                                            onClick={archiveModule}
                                            disabled={saving}
                                            className="transition-colors disabled:opacity-50"
                                        >
                                            Archive
                                        </Button>
                                    )}
                                    {selectedModule && (
                                        <Button variant="outline" size="default"
                                            type="button"
                                            onClick={deleteModule}
                                            disabled={saving}
                                            className="transition-colors disabled:opacity-50"
                                        >
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {selectedModule?.status === 'REJECTED' && selectedModule.moderationNote && (
                                <div className="mx-5 mt-5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm leading-relaxed text-red-700 dark:text-red-400 md:mx-6">
                                    {selectedModule.moderationNote}
                                </div>
                            )}

                            <div className="p-5 md:p-6">
                                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-foreground">Module Details</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">Metadata shown in the marketplace and review queue.</p>
                                    </div>
                                    <span className="font-mono text-xs text-muted-foreground">{form.sourceCode.length.toLocaleString()} source chars</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Name</label>
                                    <Input
                                        value={form.name}
                                        onChange={(event) => updateForm('name', event.target.value)}
                                        required
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Slug</label>
                                    <Input
                                        value={form.slug}
                                        onChange={(event) => updateForm('slug', event.target.value)}
                                        placeholder="Auto from name"
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Version</label>
                                    <Input
                                        value={form.version}
                                        onChange={(event) => updateForm('version', event.target.value)}
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Category</label>
                                    <Input
                                        value={form.category}
                                        onChange={(event) => updateForm('category', event.target.value)}
                                        className="w-full transition-colors"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Description</label>
                                    <Textarea
                                        value={form.description}
                                        onChange={(event) => updateForm('description', event.target.value)}
                                        required
                                        className="min-h-28 w-full resize-y leading-relaxed transition-colors"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Upload Source</label>
                                    <Input
                                        type="file"
                                        accept=".lua,.luau,.txt"
                                        onChange={handleFileUpload}
                                        className="w-full file:mr-4"
                                    />
                                </div>
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                                <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-5 py-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground">Source Code</label>
                                        <p className="mt-1 text-xs text-muted-foreground">Paste Luau source or upload a `.lua`, `.luau`, or `.txt` file.</p>
                                    </div>
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{form.sourceCode.length.toLocaleString()} chars</span>
                                </div>
                                <div className="p-4 md:p-5">
                                    <LuauCodeEditor
                                        value={form.sourceCode}
                                        onChange={(event) => updateForm('sourceCode', event.target.value)}
                                        required
                                        minHeightClassName="min-h-[620px]"
                                    />
                                </div>
                            </div>

                            <aside className="space-y-4">
                                <Card className="rounded-xl border border-border bg-card p-5">
                                    <h3 className="text-sm font-medium text-foreground">Review State</h3>
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
                                    </dl>
                                </Card>

                                <Card className="rounded-xl border border-border bg-card p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-medium text-foreground">Submit Terms</h3>
                                        <span className={`rounded-md border px-2 py-1 text-xs font-medium   ${acceptedCreatorTerms && acceptedUseTerms ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'border-border bg-card text-muted-foreground'}`}>
                                            {acceptedCreatorTerms && acceptedUseTerms ? 'Ready' : 'Required'}
                                        </span>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground">
                                            <Checkbox
                                                checked={acceptedCreatorTerms}
                                                onCheckedChange={(checked) => setAcceptedCreatorTerms(checked === true)}
                                                className="mt-1 w-4 accent-muted-foreground"
                                            />
                                            <span>I agree to the <Link href="/terms/modules/create" className="text-foreground hover:text-foreground">module creator terms</Link>.</span>
                                        </label>
                                        <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground">
                                            <Checkbox
                                                checked={acceptedUseTerms}
                                                onCheckedChange={(checked) => setAcceptedUseTerms(checked === true)}
                                                className="mt-1 w-4 accent-muted-foreground"
                                            />
                                            <span>I understand the <Link href="/terms/modules/use" className="text-foreground hover:text-foreground">module use and UGC terms</Link>.</span>
                                        </label>
                                    </div>
                                </Card>

                                <Card className="rounded-xl border border-border bg-card p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-medium text-foreground">Parsed Config</h3>
                                        <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
                                            {configFields.length}
                                        </span>
                                    </div>
                                    {configFields.length > 0 ? (
                                        <div className="mt-4 space-y-3">
                                            {configFields.map((field) => (
                                                <div key={field.key} className="rounded-lg border border-border bg-card p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="break-words text-sm font-semibold text-foreground">{field.label}</p>
                                                            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{field.key}</p>
                                                        </div>
                                                        <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
                                                            {field.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-muted-foreground">No CONFIG fields are stored for this module yet.</p>
                                    )}
                                </Card>
                            </aside>
                        </section>
                    </form>
                </div>
            </main>
        </div>
    );
}
