'use client';

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
    if (status === 'PUBLISHED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    if (status === 'PENDING_REVIEW') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    if (status === 'REJECTED') return 'border-red-400/20 bg-red-400/10 text-red-300';
    if (status === 'ARCHIVED') return 'border-slate-700 bg-slate-950 text-slate-500';
    return 'border-sky-400/20 bg-sky-400/10 text-sky-300';
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
    const [success, setSuccess] = useState<string | null>(null);
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
    }, [selectedModule]);

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
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-center text-white">
                <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/35 p-8 shadow-2xl shadow-slate-950/40">
                    <Image src="/Media/Ro-LinkIcon.png" alt="" width={48} height={48} className="mx-auto mb-5 h-12 w-12 rounded-xl border border-white/5 object-contain shadow-lg" />
                    <h1 className="text-2xl font-bold">Sign in required</h1>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">Authenticate with Discord before managing creator modules and marketplace submissions.</p>
                <button
                    onClick={() => signIn('discord')}
                        className="mt-8 rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold transition-colors hover:bg-sky-500"
                >
                    Sign In with Discord
                </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200">
            <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#020617]/90 backdrop-blur-md">
                <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-20 md:py-0">
                    <Link href="/dashboard" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
                        <Image src="/Media/Ro-LinkIcon.png" alt="Ro-Link" width={36} height={36} className="h-8 w-8 rounded-lg border border-white/5 object-contain shadow-lg md:h-9 md:w-9" />
                        <span className="text-base md:text-xl font-bold text-white">Ro-Link</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/marketplace"
                            className="rounded-lg border border-slate-700/80 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                        >
                            Marketplace
                        </Link>
                        <button
                            type="button"
                            onClick={startNewModule}
                            className="rounded-lg bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500"
                        >
                            New Module
                        </button>
                    </div>
                </div>
            </nav>

            <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 md:py-10">
                <header className="mb-6 border-b border-slate-800 pb-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="min-w-0">
                            <Link href="/dashboard" className="text-xs font-bold uppercase tracking-widest text-sky-300 hover:text-sky-200">
                                Back to Dashboard
                            </Link>
                            <h1 className="mt-4 text-3xl font-black text-white md:text-5xl">Creator Dashboard</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                                Build modules, track review progress, and manage published work from one focused workspace.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                            {[
                                ['Total', stats.total, 'text-white'],
                                ['Published', stats.published, 'text-emerald-300'],
                                ['In Review', stats.pending, 'text-amber-300'],
                                ['Needs Work', stats.rejected, 'text-red-300'],
                            ].map(([label, value, color]) => (
                                <div key={label} className="rounded-lg border border-slate-800 bg-[#020617]/55 px-4 py-4">
                                    <div className={`text-2xl font-black ${color}`}>{value}</div>
                                    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-300">
                        {success}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                    <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/35 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-bold text-white">Module Library</h2>
                                    <p className="mt-1 text-xs text-slate-500">{filteredModules.length} of {modules.length} shown</p>
                                </div>
                                <span className="rounded-md border border-slate-700 bg-[#020617]/70 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    {stats.drafts} drafts
                                </span>
                            </div>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search name, slug, category..."
                                className="mt-4 w-full rounded-lg border border-slate-800 bg-[#020617]/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                                {moduleFilters.map((filter) => (
                                    <button
                                        key={filter.value}
                                        type="button"
                                        onClick={() => setStatusFilter(filter.value)}
                                        className={`rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${statusFilter === filter.value ? 'border-sky-500/50 bg-sky-500/10 text-sky-200' : 'border-slate-800 bg-slate-950/50 text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                            <button
                                type="button"
                                onClick={startNewModule}
                                className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedModule ? 'border-dashed border-slate-700 bg-slate-900/25 hover:border-sky-500/40' : 'border-sky-500/40 bg-sky-500/10'}`}
                            >
                                <span className="text-sm font-bold text-white">Create a new module</span>
                                <span className="mt-1 block text-xs leading-relaxed text-slate-500">Start a draft with fresh metadata and source.</span>
                            </button>

                            {filteredModules.map((addon) => (
                                <button
                                    key={addon.id}
                                    type="button"
                                    onClick={() => setSelectedModuleId(addon.id)}
                                    className={`group w-full rounded-xl border p-4 text-left transition-colors ${selectedModuleId === addon.id ? 'border-sky-500/50 bg-sky-500/10 shadow-lg shadow-sky-950/20' : 'border-slate-800 bg-slate-900/35 hover:border-sky-500/40 hover:bg-slate-900/55'}`}
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(addon.status)}`}>
                                            {statusLabel(addon.status)}
                                        </span>
                                        {addon.isOfficial && (
                                            <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                                Official
                                            </span>
                                        )}
                                        {addon.creatorIsVerified && (
                                            <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                                                Verified Creator
                                            </span>
                                        )}
                                    </div>
                                    <span className="mt-3 block break-words text-sm font-bold text-white group-hover:text-sky-100">{addon.name}</span>
                                    <span className="mt-2 block line-clamp-2 text-xs leading-relaxed text-slate-500">
                                        {addon.description || 'No description yet.'}
                                    </span>
                                    <span className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                        <span>{addon.slug || 'auto-slug'}</span>
                                        <span>v{addon.version}</span>
                                    </span>
                                </button>
                            ))}

                            {filteredModules.length === 0 && (
                                <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-6 text-center text-sm text-slate-500">
                                    {modules.length > 0 ? 'No modules match this view.' : 'No modules yet.'}
                                </div>
                            )}
                        </div>
                    </aside>

                    <form onSubmit={submitModule} className="min-w-0 space-y-5">
                        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/35">
                            <div className="flex flex-col gap-5 border-b border-slate-800 bg-[#020617]/35 p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {selectedModule ? (
                                            <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(selectedModule.status)}`}>
                                                {statusLabel(selectedModule.status)}
                                            </span>
                                        ) : (
                                            <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                                                New Draft
                                            </span>
                                        )}
                                        {selectedModule?.sourceChecksum && (
                                            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                checksum {selectedModule.sourceChecksum.slice(0, 12)}
                                            </span>
                                        )}
                                        {selectedModule?.creatorIsVerified && (
                                            <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                                                Verified Creator
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="mt-3 break-words text-2xl font-black text-white md:text-3xl">
                                        {selectedModule ? selectedModule.name : 'New Module'}
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                                        {selectedModule
                                            ? `Updated ${formatDate(selectedModule.updatedAt)}. Submitted ${formatDate(selectedModule.submittedAt)}.`
                                            : 'Fill out the details, add source, then save or submit when it is ready.'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-md lg:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => saveModule('DRAFT')}
                                        disabled={saving}
                                        className="rounded-lg border border-slate-700 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-sky-500 hover:text-white disabled:opacity-50"
                                    >
                                        {saving ? 'Saving' : 'Save Draft'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="rounded-lg bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                                    >
                                        {saving ? 'Submitting' : 'Submit Review'}
                                    </button>
                                    {selectedModule && selectedModule.status !== 'ARCHIVED' && (
                                        <button
                                            type="button"
                                            onClick={archiveModule}
                                            disabled={saving}
                                            className="rounded-lg border border-amber-500/30 px-4 py-3 text-xs font-bold uppercase tracking-widest text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                                        >
                                            Archive
                                        </button>
                                    )}
                                    {selectedModule && (
                                        <button
                                            type="button"
                                            onClick={deleteModule}
                                            disabled={saving}
                                            className="rounded-lg border border-red-500/30 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>

                            {selectedModule?.status === 'REJECTED' && selectedModule.moderationNote && (
                                <div className="mx-5 mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200 md:mx-6">
                                    {selectedModule.moderationNote}
                                </div>
                            )}

                            <div className="p-5 md:p-6">
                                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Module Details</h3>
                                        <p className="mt-1 text-xs text-slate-500">Metadata shown in the marketplace and review queue.</p>
                                    </div>
                                    <span className="font-mono text-xs text-slate-500">{form.sourceCode.length.toLocaleString()} source chars</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Name</label>
                                    <input
                                        value={form.name}
                                        onChange={(event) => updateForm('name', event.target.value)}
                                        required
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</label>
                                    <input
                                        value={form.slug}
                                        onChange={(event) => updateForm('slug', event.target.value)}
                                        placeholder="Auto from name"
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Version</label>
                                    <input
                                        value={form.version}
                                        onChange={(event) => updateForm('version', event.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</label>
                                    <input
                                        value={form.category}
                                        onChange={(event) => updateForm('category', event.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</label>
                                    <textarea
                                        value={form.description}
                                        onChange={(event) => updateForm('description', event.target.value)}
                                        required
                                        className="min-h-28 w-full resize-y rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-white outline-none transition-colors focus:border-sky-500"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Upload Source</label>
                                    <input
                                        type="file"
                                        accept=".lua,.luau,.txt"
                                        onChange={handleFileUpload}
                                        className="w-full rounded-lg border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:border-sky-500"
                                    />
                                </div>
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/35">
                                <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#020617]/35 px-5 py-4">
                                    <div>
                                        <label className="block text-sm font-bold text-white">Source Code</label>
                                        <p className="mt-1 text-xs text-slate-500">Paste Luau source or upload a `.lua`, `.luau`, or `.txt` file.</p>
                                    </div>
                                    <span className="shrink-0 font-mono text-xs text-slate-500">{form.sourceCode.length.toLocaleString()} chars</span>
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
                                <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-5">
                                    <h3 className="text-sm font-bold text-white">Review State</h3>
                                    <dl className="mt-4 divide-y divide-slate-800 text-sm">
                                        <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                                            <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Published</dt>
                                            <dd className="text-right text-slate-300">{formatDate(selectedModule?.publishedAt || null)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 py-3">
                                            <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Reviewed</dt>
                                            <dd className="text-right text-slate-300">{formatDate(selectedModule?.reviewedAt || null)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                                            <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Config Fields</dt>
                                            <dd className="text-right text-slate-300">{configFields.length}</dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold text-white">Submit Terms</h3>
                                        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${acceptedCreatorTerms && acceptedUseTerms ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-slate-700 bg-slate-950 text-slate-500'}`}>
                                            {acceptedCreatorTerms && acceptedUseTerms ? 'Ready' : 'Required'}
                                        </span>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={acceptedCreatorTerms}
                                                onChange={(event) => setAcceptedCreatorTerms(event.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                                            />
                                            <span>I agree to the <Link href="/terms/modules/create" className="text-sky-300 hover:text-sky-200">module creator terms</Link>.</span>
                                        </label>
                                        <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={acceptedUseTerms}
                                                onChange={(event) => setAcceptedUseTerms(event.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                                            />
                                            <span>I understand the <Link href="/terms/modules/use" className="text-sky-300 hover:text-sky-200">module use and UGC terms</Link>.</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold text-white">Parsed Config</h3>
                                        <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            {configFields.length}
                                        </span>
                                    </div>
                                    {configFields.length > 0 ? (
                                        <div className="mt-4 space-y-3">
                                            {configFields.map((field) => (
                                                <div key={field.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="break-words text-sm font-semibold text-white">{field.label}</p>
                                                            <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{field.key}</p>
                                                        </div>
                                                        <span className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                            {field.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-slate-500">No CONFIG fields are stored for this module yet.</p>
                                    )}
                                </div>
                            </aside>
                        </section>
                    </form>
                </div>
            </main>
        </div>
    );
}
