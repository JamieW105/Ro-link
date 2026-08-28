'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Boxes, LogOut, Pencil, Plus, Search, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getDiscordMediaProxyUrl } from '@/lib/discordMedia';

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
    const { data: session, status } = useSession();
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

    function handleSignOut() {
        void signOut({ callbackUrl: '/auth/signin' });
    }

    if (status === 'loading' || loading) {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <div className="rl-dashboard-spinner" aria-label="Loading creator modules" />
            </main>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <section className="rl-dashboard-auth-card" aria-labelledby="creator-access-title">
                    <span className="rl-dashboard-state-icon"><ShieldAlert aria-hidden="true" /></span>
                    <p className="rl-eyebrow">Module creator</p>
                    <h1 id="creator-access-title">Sign in to manage your modules.</h1>
                    <p>Authenticate with Discord to create modules and open your projects in the Module IDE.</p>
                    <button onClick={() => signIn('discord')} className="rl-button rl-button-primary" type="button">
                        Sign in with Discord
                    </button>
                </section>
            </main>
        );
    }

    return (
        <div className="rl-public-page min-h-screen bg-[#080b0f] text-slate-200">
            <nav className="rl-dashboard-nav" aria-label="Module creator navigation">
                <div className="rl-dashboard-nav-inner rl-shell">
                    <Link href="/dashboard" className="rl-brand" aria-label="Back to Ro-Link dashboard">
                        <span className="rl-brand-mark"><img src="/Media/Ro-LinkIcon.png" alt="" /></span>
                        <span>Ro-Link</span>
                    </Link>

                    <div className="rl-dashboard-account">
                        <div className="rl-dashboard-user-copy">
                            <strong>{session?.user?.name}</strong>
                            <button type="button" onClick={handleSignOut}>
                                <LogOut width="14" height="14" strokeWidth="2" aria-hidden="true" />
                                Sign Out
                            </button>
                        </div>
                        <div className="rl-dashboard-avatar-wrap">
                            <img src={getDiscordMediaProxyUrl(session?.user?.image)} alt="" className="rl-dashboard-avatar" />
                            <button type="button" onClick={handleSignOut} className="rl-dashboard-mobile-signout" aria-label="Sign out">
                                <LogOut width="14" height="14" strokeWidth="2" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main>
                <section className="rl-dashboard-hero" aria-labelledby="creator-modules-title">
                    <div className="rl-dashboard-hero-inner rl-shell">
                        <div className="rl-dashboard-hero-copy">
                            <div>
                                <p className="rl-eyebrow">Creator workspace</p>
                                <div className="rl-dashboard-hero-title-row">
                                    <h1 id="creator-modules-title">My Modules</h1>
                                    <p>{modules.length} module{modules.length === 1 ? '' : 's'} created.</p>
                                </div>
                            </div>
                        </div>
                        <div className="rl-dashboard-primary-actions">
                            <Link href="/dashboard/marketplace" className="rl-button">Marketplace</Link>
                            <Link href="/dashboard/modules/ide?new=1" className="rl-button rl-button-primary">
                                <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                                Create
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="rl-shell pb-24 pt-4" aria-label="Your modules">
                    {error ? (
                        <div className="rl-dashboard-message" data-tone="error">
                            <span className="rl-dashboard-state-icon"><ShieldAlert aria-hidden="true" /></span>
                            <h2>Could not load your modules</h2>
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <label className="relative block w-full" htmlFor="creator-module-search">
                                <span className="sr-only">Search your modules</span>
                                <Search
                                    size={16}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                                />
                                <input
                                    id="creator-module-search"
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search name, slug, category..."
                                    className="w-full rounded-lg border border-slate-800 bg-[#0d1116] py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-600 hover:border-slate-700 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"
                                />
                            </label>

                            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3" aria-label="Filter modules by status">
                                {moduleFilters.map((filter) => (
                                    <button
                                        key={filter.value}
                                        type="button"
                                        onClick={() => setStatusFilter(filter.value)}
                                        aria-pressed={statusFilter === filter.value}
                                        className={`rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${statusFilter === filter.value ? 'border-sky-500/50 bg-sky-500/10 text-sky-200' : 'border-slate-800 bg-[#0d1116] text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                    {filteredModules.length} of {modules.length} shown
                                </span>
                            </div>

                            {filteredModules.length > 0 ? (
                                <div className="motion-list grid gap-2">
                                    {filteredModules.map((addon) => (
                                        <article key={addon.id} className="interactive-lift group relative flex min-w-0 items-center gap-4 rounded-lg border border-slate-800 bg-[#0d1116] p-4 transition-colors hover:border-sky-500/40 hover:bg-[#10161d]">
                                            <div className="min-w-0 flex-1 pr-12">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <h2 className="mr-1 break-words text-base font-bold text-white">{addon.name}</h2>
                                                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusClassName(addon.status)}`}>
                                                        {statusLabel(addon.status)}
                                                    </span>
                                                    {addon.isOfficial && (
                                                        <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200">Official</span>
                                                    )}
                                                    {addon.creatorIsVerified && (
                                                        <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">Verified Creator</span>
                                                    )}
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">{addon.description || 'No description yet.'}</p>
                                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    <span>{addon.slug || 'auto-slug'}</span>
                                                    <span>v{addon.version}</span>
                                                    <span>{addon.category}</span>
                                                    <span>Updated {formatDate(addon.updatedAt)}</span>
                                                </div>
                                            </div>

                                            <Link
                                                href={`/dashboard/modules/ide?module=${encodeURIComponent(addon.id)}`}
                                                aria-label={`Edit ${addon.name} in the Module IDE`}
                                                title={`Edit ${addon.name}`}
                                                className="absolute right-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-700 bg-[#080b0f] text-slate-400 transition-colors hover:border-sky-500/60 hover:bg-sky-500/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                            </Link>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="rl-dashboard-message">
                                    <span className="rl-dashboard-state-icon">{modules.length > 0 ? <Search aria-hidden="true" /> : <Boxes aria-hidden="true" />}</span>
                                    <h2>{modules.length > 0 ? 'No matching modules' : 'No modules created'}</h2>
                                    <p>{modules.length > 0 ? 'Try another search or status filter.' : 'Create your first project and start building in the Module IDE.'}</p>
                                    {modules.length === 0 && (
                                        <Link href="/dashboard/modules/ide?new=1" className="rl-button rl-button-primary">
                                            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                                            Create module
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
