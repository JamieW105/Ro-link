'use client';

import {
    ArrowRight,
    Boxes,
    Check,
    ChevronDown,
    CircleUserRound,
    Clock3,
    Layers3,
    LogOut as LucideLogOut,
    Plus,
    Search,
    Shapes,
    SlidersHorizontal,
    ShieldAlert as LucideShieldAlert,
} from 'lucide-react';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { getDiscordMediaProxyUrl } from '@/lib/discordMedia';

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
    thumbnailUrl: string;
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
    creatorName: string;
    creatorAvatarUrl: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    moderationNote: string;
    publishedAt: string | null;
    updatedAt: string | null;
}

type SessionUserWithId = {
    id?: string;
};

type CreatorFilter = 'all' | 'official' | 'verified' | 'community' | 'yours';
type SortOption = 'latest' | 'oldest' | 'name';

interface MarketplaceSelectOption<T extends string> {
    value: T;
    label: string;
}

interface MarketplaceSelectProps<T extends string> {
    id: string;
    label: string;
    value: T;
    options: MarketplaceSelectOption<T>[];
    icon: ReactNode;
    onChange: (value: T) => void;
}

function MarketplaceSelect<T extends string>({ id, label, value, options, icon, onChange }: MarketplaceSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
    const rootRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const selectedOption = options.find((option) => option.value === value) || options[0];

    useEffect(() => {
        if (!open) return;

        function closeOnOutsidePointer(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        }

        document.addEventListener('pointerdown', closeOnOutsidePointer);
        return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        optionRefs.current[activeIndex]?.focus();
    }, [activeIndex, open]);

    function openMenu(index = Math.max(0, options.findIndex((option) => option.value === value))) {
        setActiveIndex(index);
        setOpen(true);
    }

    function selectOption(option: MarketplaceSelectOption<T>) {
        onChange(option.value);
        setOpen(false);
        window.requestAnimationFrame(() => document.getElementById(id)?.focus());
    }

    function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
            const offset = event.key === 'ArrowDown' ? 1 : -1;
            openMenu((selectedIndex + offset + options.length) % options.length);
        }
    }

    function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            window.requestAnimationFrame(() => document.getElementById(id)?.focus());
            return;
        }

        let nextIndex = index;
        if (event.key === 'ArrowDown') nextIndex = (index + 1) % options.length;
        else if (event.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = options.length - 1;
        else return;

        event.preventDefault();
        setActiveIndex(nextIndex);
    }

    return (
        <div ref={rootRef} className="relative min-w-0">
            <button
                id={id}
                type="button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={`${id}-options`}
                onClick={() => (open ? setOpen(false) : openMenu())}
                onKeyDown={handleButtonKeyDown}
                className={`flex h-10 w-full items-center gap-2 rounded-lg border bg-[#0d1116] px-2.5 text-sm font-semibold text-white outline-none transition-colors hover:border-slate-700 focus:ring-2 focus:ring-sky-500/10 ${open ? 'border-sky-500/60' : 'border-slate-800'}`}
            >
                <span className="shrink-0 text-slate-500" aria-hidden="true">{icon}</span>
                <span className="min-w-0 flex-1 truncate text-left">{selectedOption?.label}</span>
                <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    id={`${id}-options`}
                    role="listbox"
                    aria-label={label}
                    className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-lg border border-slate-700 bg-[#111820] p-1 shadow-2xl shadow-black/50"
                >
                    {options.map((option, index) => {
                        const selected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                ref={(node) => { optionRefs.current[index] = node; }}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                tabIndex={index === activeIndex ? 0 : -1}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => selectOption(option)}
                                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors ${selected ? 'bg-sky-500/15 font-semibold text-sky-200' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white'}`}
                            >
                                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                {selected && <Check size={14} className="shrink-0 text-sky-300" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const LogOutIcon = () => (
    <LucideLogOut width="14" height="14" strokeWidth="2" />
);

function formatDate(value: string | null) {
    if (!value) return 'Unpublished';
    return new Date(value).toLocaleDateString();
}

function creatorLabel(addon: MarketplaceModule, sessionUserId?: string, sessionUserName?: string | null) {
    if (addon.creatorName) return addon.creatorName;
    if (addon.authorDiscordId === sessionUserId) return sessionUserName || 'Your module';
    if (addon.creatorIsVerified) return 'Verified creator';
    return 'Community creator';
}

function moduleTimestamp(addon: MarketplaceModule) {
    const value = addon.updatedAt || addon.publishedAt || addon.reviewedAt || addon.submittedAt;
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

const MODULE_CATEGORIES = ['Moderation', 'Misc', 'Fun', 'Troll'];

export default function DashboardMarketplacePage() {
    const { data: session, status } = useSession();
    const [modules, setModules] = useState<MarketplaceModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortOption, setSortOption] = useState<SortOption>('latest');
    const sessionUserId = (session?.user as SessionUserWithId | undefined)?.id;

    const categories = useMemo(() => (
        Array.from(new Set([
            ...MODULE_CATEGORIES,
            ...modules.map((addon) => addon.category).filter(Boolean),
        ]))
            .sort((left, right) => left.localeCompare(right))
    ), [modules]);

    const filteredModules = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return modules
            .filter((addon) => {
                const matchesSearch = !normalizedQuery || [
                    addon.name,
                    addon.description,
                    addon.category,
                    addon.version,
                    creatorLabel(addon, sessionUserId, session?.user?.name),
                ].some((value) => value.toLowerCase().includes(normalizedQuery));
                const matchesCategory = categoryFilter === 'all' || addon.category === categoryFilter;
                const matchesCreator = creatorFilter === 'all'
                    || (creatorFilter === 'official' && addon.isOfficial)
                    || (creatorFilter === 'verified' && addon.creatorIsVerified)
                    || (creatorFilter === 'community' && !addon.isOfficial && !addon.creatorIsVerified)
                    || (creatorFilter === 'yours' && addon.authorDiscordId === sessionUserId);

                return matchesSearch && matchesCategory && matchesCreator;
            })
            .sort((left, right) => {
                if (sortOption === 'name') return left.name.localeCompare(right.name);
                const dateDifference = moduleTimestamp(right) - moduleTimestamp(left);
                return sortOption === 'oldest' ? -dateDifference : dateDifference;
            });
    }, [categoryFilter, creatorFilter, modules, searchQuery, session?.user?.name, sessionUserId, sortOption]);

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
            })
            .catch((loadError) => {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load marketplace.');
            })
            .finally(() => setLoading(false));
    }, [status]);

    function handleSignOut() {
        void signOut({ callbackUrl: '/auth/signin' });
    }

    if (status === 'loading') {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <div className="rl-dashboard-spinner" aria-label="Loading marketplace" />
            </main>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <section className="rl-dashboard-auth-card" aria-labelledby="marketplace-access-title">
                    <span className="rl-dashboard-state-icon"><LucideShieldAlert aria-hidden="true" /></span>
                    <p className="rl-eyebrow">Module marketplace</p>
                    <h1 id="marketplace-access-title">Sign in to browse modules.</h1>
                    <p>Authenticate with Discord to explore and install modules for your Ro-Link servers.</p>
                    <button onClick={() => signIn('discord')} className="rl-button rl-button-primary" type="button">
                        Sign in with Discord
                    </button>
                </section>
            </main>
        );
    }

    return (
        <div className="rl-public-page min-h-screen bg-[#080b0f] text-slate-200">
            <nav className="rl-dashboard-nav" aria-label="Marketplace navigation">
                <div className="rl-dashboard-nav-inner rl-shell">
                    <Link href="/dashboard" className="rl-brand" aria-label="Back to Ro-Link dashboard">
                        <span className="rl-brand-mark"><img src="/Media/Ro-LinkIcon.png" alt="" /></span>
                        <span>Ro-Link</span>
                    </Link>

                    <div className="rl-dashboard-account">
                        {sessionUserId === '953414442060746854' && (
                            <Link
                                href="/management"
                                className="rl-button rl-dashboard-management"
                            >
                                Management
                            </Link>
                        )}
                        <div className="rl-dashboard-user-copy">
                            <strong>{session?.user?.name}</strong>
                            <button type="button" onClick={handleSignOut}>
                                <LogOutIcon />
                                Sign Out
                            </button>
                        </div>
                        <div className="rl-dashboard-avatar-wrap">
                            {session?.user?.image ? (
                                <img src={getDiscordMediaProxyUrl(session.user.image)} alt="" className="rl-dashboard-avatar" />
                            ) : (
                                <span className="rl-dashboard-avatar flex items-center justify-center bg-slate-900 text-slate-500" aria-hidden="true">
                                    <CircleUserRound size={19} />
                                </span>
                            )}
                            <button type="button" onClick={handleSignOut} className="rl-dashboard-mobile-signout" aria-label="Sign out">
                                <LogOutIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main>
                <section className="rl-dashboard-hero" aria-labelledby="marketplace-title">
                    <div className="rl-dashboard-hero-inner rl-shell">
                        <div className="rl-dashboard-hero-copy">
                            <div>
                                <p className="rl-eyebrow">Module library</p>
                                <div className="rl-dashboard-hero-title-row">
                                    <h1 id="marketplace-title">Marketplace</h1>
                                    <p>{modules.length} module{modules.length === 1 ? '' : 's'} available.</p>
                                </div>
                            </div>
                        </div>
                        <div className="rl-dashboard-primary-actions">
                            <Link href="/dashboard/creator/modules" className="rl-button rl-button-primary"><Plus size={14} strokeWidth={2.5} aria-hidden="true" />Create</Link>
                        </div>
                    </div>
                </section>

                <section className="rl-shell pb-10 pt-4" aria-label="Available modules">
                    {loading ? (
                        <div className="rl-dashboard-state-inline">
                            <div className="rl-dashboard-spinner" />
                            <p>Loading marketplace...</p>
                        </div>
                    ) : error ? (
                        <div className="rl-dashboard-message" data-tone="error">
                            <span className="rl-dashboard-state-icon"><LucideShieldAlert aria-hidden="true" /></span>
                            <h2>Could not load modules</h2>
                            <p>{error}</p>
                        </div>
                    ) : modules.length === 0 ? (
                        <div className="rl-dashboard-message">
                            <span className="rl-dashboard-state-icon"><Boxes aria-hidden="true" /></span>
                            <h2>No modules available</h2>
                            <p>Published modules and your submissions will appear here.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <div className="grid gap-2 rounded-xl border border-slate-800 bg-[#0b0f13] p-2 md:grid-cols-[minmax(240px,1fr)_170px_160px_150px]" role="search" aria-label="Filter marketplace modules">
                                <label className="relative block min-w-0" htmlFor="marketplace-search">
                                    <span className="sr-only">Search marketplace modules</span>
                                    <Search
                                        size={15}
                                        aria-hidden="true"
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                                    />
                                    <input
                                        id="marketplace-search"
                                        type="search"
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Search by title, creator, or category..."
                                        className="h-10 w-full rounded-lg border border-slate-800 bg-[#0d1116] pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-slate-700 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"
                                    />
                                </label>

                                <MarketplaceSelect
                                    id="marketplace-creator-filter"
                                    label="Filter by creator"
                                    value={creatorFilter}
                                    onChange={setCreatorFilter}
                                    icon={<Shapes size={15} />}
                                    options={[
                                        { value: 'all', label: 'All modules' },
                                        { value: 'official', label: 'Official' },
                                        { value: 'verified', label: 'Verified creators' },
                                        { value: 'community', label: 'Community' },
                                        { value: 'yours', label: 'Your modules' },
                                    ]}
                                />

                                <MarketplaceSelect
                                    id="marketplace-category-filter"
                                    label="Filter by category"
                                    value={categoryFilter}
                                    onChange={setCategoryFilter}
                                    icon={<Layers3 size={15} />}
                                    options={[
                                        { value: 'all', label: 'All categories' },
                                        ...categories.map((category) => ({ value: category, label: category })),
                                    ]}
                                />

                                <MarketplaceSelect
                                    id="marketplace-sort"
                                    label="Sort modules"
                                    value={sortOption}
                                    onChange={setSortOption}
                                    icon={<Clock3 size={15} />}
                                    options={[
                                        { value: 'latest', label: 'Latest' },
                                        { value: 'oldest', label: 'Oldest' },
                                        { value: 'name', label: 'Name A–Z' },
                                    ]}
                                />
                            </div>

                            {filteredModules.length === 0 ? (
                                <div className="rl-dashboard-message">
                                    <span className="rl-dashboard-state-icon"><Search aria-hidden="true" /></span>
                                    <h2>No matching modules</h2>
                                    <p>Try changing your search or filters.</p>
                                </div>
                            ) : (
                                <div className="motion-list grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {filteredModules.map((addon) => (
                                        <Link
                                            key={addon.id}
                                            href={`/dashboard/marketplace/${encodeURIComponent(addon.slug)}`}
                                            className="interactive-lift group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700/90 bg-[#101418] transition-colors hover:border-sky-500/60 hover:bg-[#11171c] focus-visible:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                                            aria-label={`View ${addon.name}`}
                                        >
                                            <div className="relative aspect-video w-full overflow-hidden border-b border-slate-800 bg-[#090d11]">
                                                {addon.thumbnailUrl && (
                                                    <img
                                                        src={addon.thumbnailUrl}
                                                        alt=""
                                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                                    />
                                                )}
                                                {addon.authorDiscordId === sessionUserId && addon.status !== 'PUBLISHED' && (
                                                    <span className="absolute left-2 top-2 rounded border border-indigo-300/30 bg-[#0b0f14]/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-200 shadow-sm backdrop-blur-sm">Yours</span>
                                                )}
                                            </div>

                                            <div className="flex min-w-0 flex-1 flex-col px-3.5 pb-3 pt-3">
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <h2 className="min-w-0 truncate text-sm font-bold text-sky-400 transition-colors group-hover:text-sky-300">{addon.name}</h2>
                                                    {addon.isOfficial && (
                                                        <span className="group/official relative shrink-0" aria-label="Official">
                                                            <img src="/Media/Ro-LinkIcon.png" alt="" className="h-4 w-4 rounded object-cover" />
                                                            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/official:opacity-100">Official</span>
                                                        </span>
                                                    )}
                                                    {!addon.isOfficial && addon.creatorIsVerified && (
                                                        <span className="group/verified relative shrink-0 text-sky-400" aria-label="Verified creator">
                                                            <Check size={15} strokeWidth={3} aria-hidden="true" />
                                                            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/verified:opacity-100">Verified creator</span>
                                                        </span>
                                                    )}
                                                    <span className="shrink-0 text-[10px] font-medium text-slate-500">v{addon.version}</span>
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{addon.description || 'No description provided.'}</p>
                                                {addon.status === 'PENDING_REVIEW' && (
                                                    <p className="mt-2 text-[10px] font-medium text-slate-500">Submitted {formatDate(addon.submittedAt)}</p>
                                                )}
                                            </div>

                                            <div className="flex w-full items-center gap-2 border-t border-slate-800 px-3.5 py-3 text-[10px] font-semibold text-slate-300">
                                                {addon.creatorAvatarUrl ? (
                                                    <img src={addon.creatorAvatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                                                ) : addon.authorDiscordId === sessionUserId && session?.user?.image ? (
                                                    <img src={getDiscordMediaProxyUrl(session.user.image)} alt="" className="h-5 w-5 rounded-full object-cover" />
                                                ) : (
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                                                        <CircleUserRound size={13} aria-hidden="true" />
                                                    </span>
                                                )}
                                                <span className="min-w-0 truncate">{creatorLabel(addon, sessionUserId, session?.user?.name)}</span>
                                                <span className="ml-auto shrink-0 text-slate-500">{addon.category}</span>
                                                <span className="flex shrink-0 items-center gap-1 text-slate-500" title="Configuration fields">
                                                    <SlidersHorizontal size={13} aria-hidden="true" />
                                                    {Object.keys(addon.configSchema || {}).length}
                                                </span>
                                                <ArrowRight size={14} className="shrink-0 text-slate-500 transition-all group-hover:translate-x-0.5 group-hover:text-sky-300" aria-hidden="true" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                            <div className="mt-4 text-right">
                                <Link href="/terms/modules/use" className="text-xs font-semibold text-slate-500 transition-colors hover:text-sky-300">
                                    Module terms
                                </Link>
                            </div>
                        </div>
                    )}
                </section>

            </main>
        </div>
    );
}
