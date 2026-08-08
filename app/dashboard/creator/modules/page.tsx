'use client';

import Image from 'next/image';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ModuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
type CreatorFilter = 'ALL' | ModuleStatus;

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
    updatedAt: string | null;
}

const moduleFilters: { value: CreatorFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'PENDING_REVIEW', label: 'Review' },
    { value: 'DRAFT', label: 'Drafts' },
    { value: 'REJECTED', label: 'Needs Work' },
];

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

export default function CreatorModulesPage() {
    const { status } = useSession();
    const [modules, setModules] = useState<CreatorModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<CreatorFilter>('ALL');

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

    useEffect(() => {
        if (status !== 'authenticated') {
            if (status === 'unauthenticated') setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        fetch('/api/dashboard/creator/modules', { cache: 'no-store' })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(String(payload.error || 'Failed to load creator modules.'));
                }

                setModules(Array.isArray(payload.modules) ? payload.modules : []);
            })
            .catch((loadError) => {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load creator modules.');
            })
            .finally(() => setLoading(false));
    }, [status]);

    if (status === 'loading' || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
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
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">Authenticate with Discord before viewing your modules.</p>
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
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-20 md:py-0">
                    <Link href="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80 md:gap-3">
                        <Image src="/Media/Ro-LinkIcon.png" alt="Ro-Link" width={36} height={36} className="h-8 w-8 rounded-lg border border-white/5 object-contain shadow-lg md:h-9 md:w-9" />
                        <span className="text-base font-bold text-white md:text-xl">Ro-Link</span>
                    </Link>
                    <Link
                        href="/dashboard/marketplace"
                        className="rounded-lg border border-slate-700/80 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                    >
                        Marketplace
                    </Link>
                </div>
            </nav>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 md:py-10">
                <header className="mb-8 border-b border-slate-800 pb-7">
                    <Link href="/dashboard" className="text-xs font-bold uppercase tracking-widest text-sky-300 hover:text-sky-200">
                        Back to Dashboard
                    </Link>
                    <h1 className="mt-4 text-3xl font-black text-white md:text-5xl">My Modules</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
                        View the modules you have created and open any project in the Module IDE.
                    </p>
                </header>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                        {error}
                    </div>
                )}

                <section>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-black text-white">Your Modules</h2>
                            <p className="mt-1 text-xs text-slate-500">{filteredModules.length} of {modules.length} shown</p>
                        </div>
                        <Link
                            href="/dashboard/modules/ide?new=1"
                            aria-label="Create a new module in the Module IDE"
                            title="Create new module"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-200 transition-colors hover:border-sky-400 hover:bg-sky-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                            <Plus className="h-5 w-5" aria-hidden="true" />
                        </Link>
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-900/25 p-4">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search name, slug, category..."
                            aria-label="Search your modules"
                            className="w-full rounded-lg border border-slate-800 bg-[#020617]/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
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

                    {filteredModules.length > 0 ? (
                        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {filteredModules.map((addon) => (
                                <article key={addon.id} className="relative flex min-h-64 flex-col rounded-xl border border-slate-800 bg-slate-900/35 p-5 transition-colors hover:border-sky-500/35 hover:bg-slate-900/50">
                                    <Link
                                        href={`/dashboard/modules/ide?module=${encodeURIComponent(addon.id)}`}
                                        aria-label={`Edit ${addon.name} in the Module IDE`}
                                        title={`Edit ${addon.name}`}
                                        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-[#020617]/80 text-slate-400 transition-colors hover:border-sky-500/60 hover:bg-sky-500/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                    >
                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                    </Link>

                                    <div className="flex flex-wrap items-center gap-2 pr-12">
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
                                    <h3 className="mt-5 break-words text-xl font-black text-white">{addon.name}</h3>
                                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">
                                        {addon.description || 'No description yet.'}
                                    </p>
                                    <div className="mt-auto pt-5">
                                        <div className="flex flex-wrap gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            <span>{addon.slug || 'auto-slug'}</span>
                                            <span>v{addon.version}</span>
                                            <span>{addon.category}</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-600">Updated {formatDate(addon.updatedAt)}</p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/35 p-10 text-center text-sm text-slate-500">
                            {modules.length > 0 ? 'No modules match this view.' : 'You have not created any modules yet.'}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
