'use client';

import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Code2,
    Download,
    LoaderCircle,
    LogOut as LucideLogOut,
    MessageSquareText,
    Package2,
    Reply,
    Settings2,
    ShieldAlert,
    Star,
    Store,
    Tag,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { getDiscordGuildIconProxyUrl, getDiscordMediaProxyUrl } from '@/lib/discordMedia';

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
    thumbnailUrls: string[];
    version: string;
    category: string;
    status: string;
    isOfficial: boolean;
    creatorIsVerified: boolean;
    sourceChecksum: string;
    configSchema: Record<string, ModuleConfigField>;
    authorDiscordId: string | null;
    creatorName: string;
    creatorAvatarUrl: string;
    moderationNote: string;
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
}

interface InstallTarget {
    id: string;
    name: string;
    icon: string | null;
    installedModuleCount: number;
    moduleLimit: number;
}

interface ModuleReview {
    id: string;
    reviewerName: string;
    reviewerAvatarUrl: string;
    rating: number;
    comment: string;
    ownerReply: string;
    ownerReplyAt: string | null;
    createdAt: string;
    updatedAt: string;
    isOwn: boolean;
    canDelete: boolean;
    verifiedInstall: boolean;
}

type SessionUserWithId = {
    id?: string;
};

function statusClassName(status: string) {
    if (status === 'PUBLISHED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    if (status === 'PENDING_REVIEW') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    if (status === 'REJECTED') return 'border-red-400/20 bg-red-400/10 text-red-300';
    return 'border-slate-700 bg-slate-950 text-slate-500';
}

function statusLabel(status: string) {
    if (status === 'PENDING_REVIEW') return 'Awaiting Moderation';
    return status.replace(/_/g, ' ');
}

function formatDate(value: string | null) {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return new Intl.DateTimeFormat('en-NZ', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

export default function ModuleMarketplaceDetail({ moduleSlug }: { moduleSlug: string }) {
    const { data: session, status } = useSession();
    const [modules, setModules] = useState<MarketplaceModule[]>([]);
    const [installTargets, setInstallTargets] = useState<InstallTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installPickerOpen, setInstallPickerOpen] = useState(false);
    const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
    const [multiSelectInstall, setMultiSelectInstall] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installMessage, setInstallMessage] = useState<string | null>(null);
    const [installError, setInstallError] = useState<string | null>(null);
    const [activeThumbnailIndex, setActiveThumbnailIndex] = useState(0);
    const [reviews, setReviews] = useState<ModuleReview[]>([]);
    const [reviewCount, setReviewCount] = useState(0);
    const [averageRating, setAverageRating] = useState(0);
    const [canReview, setCanReview] = useState(false);
    const [reviewIsCreator, setReviewIsCreator] = useState(false);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewMessage, setReviewMessage] = useState<string | null>(null);
    const [reviewContextMenu, setReviewContextMenu] = useState<{ reviewId: string; x: number; y: number } | null>(null);
    const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
    const [replyingToReviewId, setReplyingToReviewId] = useState<string | null>(null);
    const [replyDraft, setReplyDraft] = useState('');
    const [replySubmitting, setReplySubmitting] = useState(false);
    const [replyError, setReplyError] = useState<string | null>(null);
    const sessionUserId = (session?.user as SessionUserWithId | undefined)?.id;

    const addon = useMemo(() => {
        const normalizedSlug = moduleSlug.toLowerCase();
        return modules.find((candidate) => (
            candidate.slug.toLowerCase() === normalizedSlug
            || candidate.id.toLowerCase() === normalizedSlug
        )) || null;
    }, [moduleSlug, modules]);

    const isCurrentUserCreator = addon?.authorDiscordId === sessionUserId;
    const creatorName = addon?.creatorName
        || (isCurrentUserCreator
            ? session?.user?.name || 'You'
            : addon?.creatorIsVerified
                ? 'Verified creator'
                : 'Community creator');
    const thumbnailUrls = addon?.thumbnailUrls?.length ? addon.thumbnailUrls : addon?.thumbnailUrl ? [addon.thumbnailUrl] : [];
    const activeThumbnailUrl = thumbnailUrls[activeThumbnailIndex] || thumbnailUrls[0] || '';

    useEffect(() => {
        setActiveThumbnailIndex(0);
    }, [addon?.id]);

    useEffect(() => {
        if (!reviewContextMenu) return;

        const closeMenu = () => setReviewContextMenu(null);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu();
        };
        window.addEventListener('click', closeMenu);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [reviewContextMenu]);

    useEffect(() => {
        if (status !== 'authenticated') return;

        fetch('/api/dashboard/marketplace', { cache: 'no-store' })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(String(payload.error || 'Failed to load module.'));
                }
                setModules(Array.isArray(payload.modules) ? payload.modules : []);
                setInstallTargets(Array.isArray(payload.installTargets) ? payload.installTargets : []);
            })
            .catch((loadError) => {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load module.');
            })
            .finally(() => setLoading(false));
    }, [status]);

    useEffect(() => {
        if (status !== 'authenticated' || !addon?.id) return;

        const controller = new AbortController();
        setReviewsLoading(true);
        setReviewError(null);

        fetch(`/api/dashboard/marketplace/${encodeURIComponent(addon.id)}/reviews`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(String(payload.error || 'Failed to load reviews.'));

                const nextReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
                setReviews(nextReviews);
                setReviewCount(Number(payload.reviewCount || 0));
                setAverageRating(Number(payload.averageRating || 0));
                setCanReview(payload.canReview === true);
                setReviewIsCreator(payload.isCreator === true);

                if (payload.yourReview) {
                    setReviewRating(Number(payload.yourReview.rating || 0));
                    setReviewComment(String(payload.yourReview.comment || ''));
                }
            })
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
                setReviewError(loadError instanceof Error ? loadError.message : 'Failed to load reviews.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setReviewsLoading(false);
            });

        return () => controller.abort();
    }, [addon?.id, status]);

    function closeInstallPicker() {
        if (installing) return;
        setInstallPickerOpen(false);
        setSelectedServerIds([]);
        setMultiSelectInstall(false);
        setInstallMessage(null);
        setInstallError(null);
    }

    function toggleServerSelection(serverId: string) {
        const target = installTargets.find((server) => server.id === serverId);
        if (target && target.installedModuleCount >= target.moduleLimit && !selectedServerIds.includes(serverId)) return;

        setSelectedServerIds((current) => (
            current.includes(serverId)
                ? current.filter((id) => id !== serverId)
                : [...current, serverId]
        ));
    }

    async function installModuleToServers(serverIds: string[]) {
        if (!addon || serverIds.length === 0) return;

        setInstalling(true);
        setInstallError(null);
        setInstallMessage(null);

        try {
            const results = await Promise.all(serverIds.map(async (serverId) => {
                const response = await fetch('/api/dashboard/modules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serverId, moduleId: addon.id, action: 'install' }),
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

    async function submitReview(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!addon || reviewSubmitting) return;

        setReviewSubmitting(true);
        setReviewError(null);
        setReviewMessage(null);

        try {
            const response = await fetch(`/api/dashboard/marketplace/${encodeURIComponent(addon.id)}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(String(payload.error || 'Failed to save review.'));

            const savedReview = payload.review as ModuleReview;
            const existingReview = reviews.find((review) => review.isOwn);
            const nextReviewCount = reviewCount + (existingReview ? 0 : 1);
            const nextRatingTotal = (averageRating * reviewCount) - (existingReview?.rating || 0) + savedReview.rating;
            setReviews((current) => [savedReview, ...current.filter((review) => review.id !== savedReview.id)]);
            setReviewCount(nextReviewCount);
            setAverageRating(nextReviewCount ? nextRatingTotal / nextReviewCount : 0);
            setReviewMessage(existingReview ? 'Your review was updated.' : 'Your review was published.');
        } catch (submitError) {
            setReviewError(submitError instanceof Error ? submitError.message : 'Failed to save review.');
        } finally {
            setReviewSubmitting(false);
        }
    }

    function openReviewContextMenu(reviewId: string, x: number, y: number) {
        setReviewContextMenu({
            reviewId,
            x: Math.min(x, window.innerWidth - 180),
            y: Math.min(y, window.innerHeight - 64),
        });
    }

    async function deleteReview(reviewId: string) {
        if (!addon || deletingReviewId || !window.confirm('Delete this review? This cannot be undone.')) return;

        const review = reviews.find((candidate) => candidate.id === reviewId);
        if (!review) return;

        setReviewContextMenu(null);
        setDeletingReviewId(reviewId);
        setReviewError(null);
        setReviewMessage(null);

        try {
            const response = await fetch(`/api/dashboard/marketplace/${encodeURIComponent(addon.id)}/reviews`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewId }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(String(payload.error || 'Failed to delete the review.'));

            const nextCount = Math.max(0, reviewCount - 1);
            const nextTotal = Math.max(0, (averageRating * reviewCount) - review.rating);
            setReviews((current) => current.filter((candidate) => candidate.id !== reviewId));
            setReviewCount(nextCount);
            setAverageRating(nextCount ? nextTotal / nextCount : 0);
            if (review.isOwn) {
                setReviewRating(0);
                setReviewComment('');
            }
            if (replyingToReviewId === reviewId) setReplyingToReviewId(null);
            setReviewMessage('Review deleted.');
        } catch (deleteError) {
            setReviewError(deleteError instanceof Error ? deleteError.message : 'Failed to delete the review.');
        } finally {
            setDeletingReviewId(null);
        }
    }

    function beginReply(review: ModuleReview) {
        setReplyingToReviewId(review.id);
        setReplyDraft(review.ownerReply || '');
        setReplyError(null);
    }

    async function submitOwnerReply(event: FormEvent<HTMLFormElement>, reviewId: string) {
        event.preventDefault();
        if (!addon || replySubmitting) return;

        setReplySubmitting(true);
        setReplyError(null);
        try {
            const response = await fetch(`/api/dashboard/marketplace/${encodeURIComponent(addon.id)}/reviews`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewId, reply: replyDraft }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(String(payload.error || 'Failed to publish the reply.'));

            setReviews((current) => current.map((review) => review.id === reviewId ? {
                ...review,
                ownerReply: String(payload.reply || ''),
                ownerReplyAt: String(payload.ownerReplyAt || ''),
            } : review));
            setReplyingToReviewId(null);
            setReplyDraft('');
        } catch (submitError) {
            setReplyError(submitError instanceof Error ? submitError.message : 'Failed to publish the reply.');
        } finally {
            setReplySubmitting(false);
        }
    }

    if (status === 'loading' || (status === 'authenticated' && loading)) {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <div className="rl-dashboard-spinner" aria-label="Loading module" />
            </main>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <main className="rl-public-page rl-dashboard-page rl-dashboard-state">
                <section className="rl-dashboard-auth-card" aria-labelledby="module-access-title">
                    <span className="rl-dashboard-state-icon"><ShieldAlert aria-hidden="true" /></span>
                    <p className="rl-eyebrow">Module marketplace</p>
                    <h1 id="module-access-title">Sign in to view this module.</h1>
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
            <nav className="rl-dashboard-nav" aria-label="Module navigation">
                <div className="rl-dashboard-nav-inner rl-shell">
                    <Link href="/dashboard" className="rl-brand" aria-label="Back to Ro-Link dashboard">
                        <span className="rl-brand-mark"><img src="/Media/Ro-LinkIcon.png" alt="" /></span>
                        <span>Ro-Link</span>
                    </Link>

                    <div className="rl-dashboard-account">
                        {sessionUserId === '953414442060746854' && (
                            <Link href="/management" className="rl-button rl-dashboard-management">Management</Link>
                        )}
                        <div className="rl-dashboard-user-copy">
                            <strong>{session?.user?.name}</strong>
                            <button type="button" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
                                <LucideLogOut width="14" height="14" strokeWidth="2" />
                                Sign Out
                            </button>
                        </div>
                        <div className="rl-dashboard-avatar-wrap">
                            {session?.user?.image ? (
                                <img src={getDiscordMediaProxyUrl(session.user.image)} alt="" className="rl-dashboard-avatar" />
                            ) : (
                                <span className="rl-dashboard-avatar flex items-center justify-center bg-slate-900 text-slate-500"><UserRound size={16} aria-hidden="true" /></span>
                            )}
                            <button type="button" onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="rl-dashboard-mobile-signout" aria-label="Sign out">
                                <LucideLogOut width="14" height="14" strokeWidth="2" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="border-t border-slate-800/70">
                {error || !addon ? (
                    <section className="rl-dashboard-content rl-shell">
                        <div className="rl-dashboard-message" data-tone={error ? 'error' : undefined}>
                            <span className="rl-dashboard-state-icon"><Store aria-hidden="true" /></span>
                            <h2>{error ? 'Could not load module' : 'Module not found'}</h2>
                            <p>{error || 'This module is unavailable or you do not have access to it.'}</p>
                            <Link href="/dashboard/marketplace" className="rl-button">Back to Marketplace</Link>
                        </div>
                    </section>
                ) : (
                    <section className="rl-shell py-7 md:py-10" aria-label={`${addon.name} details`}>
                        <Link href="/dashboard/marketplace" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-sky-300">
                            <ArrowLeft size={15} aria-hidden="true" />
                            Back to Marketplace
                        </Link>

                        <header className="mt-8 md:mt-10" aria-labelledby="module-title">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">{addon.category}</span>
                                <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">v{addon.version}</span>
                                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(addon.status)}`}>{statusLabel(addon.status)}</span>
                                {addon.isOfficial && <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">Official</span>}
                                {addon.creatorIsVerified && <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">Verified Creator</span>}
                            </div>
                            <h1 id="module-title" className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">{addon.name}</h1>
                            <div className="mt-4 flex min-h-6 flex-wrap items-center gap-2 text-sm">
                                <div className="flex items-center gap-0.5 text-amber-400" aria-label={reviewCount ? `${averageRating.toFixed(1)} out of 5 stars` : 'No ratings yet'}>
                                    {Array.from({ length: 5 }, (_, index) => (
                                        <Star key={index} size={16} fill={index < Math.round(averageRating) ? 'currentColor' : 'none'} aria-hidden="true" />
                                    ))}
                                </div>
                                {reviewsLoading ? (
                                    <span className="flex items-center gap-1.5 text-xs text-slate-500"><LoaderCircle size={13} className="animate-spin" aria-hidden="true" />Loading reviews</span>
                                ) : reviewCount > 0 ? (
                                    <span className="font-semibold text-slate-300">{averageRating.toFixed(1)} <span className="font-normal text-slate-500">({reviewCount} review{reviewCount === 1 ? '' : 's'})</span></span>
                                ) : (
                                    <span className="text-slate-500">No reviews yet</span>
                                )}
                            </div>
                        </header>

                        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_310px] xl:grid-cols-[minmax(0,1fr)_340px]">
                            <div className="min-w-0 space-y-6">
                                <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#0d1116] p-2.5 shadow-2xl shadow-black/20" aria-label="Module preview">
                                    <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-800 bg-[#080b0f]">
                                        {activeThumbnailUrl ? (
                                            <img src={activeThumbnailUrl} alt={`${addon.name} preview ${activeThumbnailIndex + 1} of ${thumbnailUrls.length}`} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.14),transparent_58%)] text-sky-300/70">
                                                <Package2 size={64} strokeWidth={1.25} aria-hidden="true" />
                                            </div>
                                        )}
                                        {thumbnailUrls.length > 1 && <>
                                            <button type="button" aria-label="Previous thumbnail" onClick={() => setActiveThumbnailIndex((current) => (current - 1 + thumbnailUrls.length) % thumbnailUrls.length)} className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white transition-colors hover:bg-black/85"><ChevronLeft size={18} aria-hidden="true" /></button>
                                            <button type="button" aria-label="Next thumbnail" onClick={() => setActiveThumbnailIndex((current) => (current + 1) % thumbnailUrls.length)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white transition-colors hover:bg-black/85"><ChevronRight size={18} aria-hidden="true" /></button>
                                        </>}
                                    </div>
                                    {thumbnailUrls.length > 1 && <div className="mt-2 grid grid-cols-5 gap-2" aria-label="Module thumbnails">
                                        {thumbnailUrls.map((url, index) => <button key={url} type="button" aria-label={`Show thumbnail ${index + 1}`} aria-current={index === activeThumbnailIndex} onClick={() => setActiveThumbnailIndex(index)} className={`aspect-video overflow-hidden rounded-md border transition-colors ${index === activeThumbnailIndex ? 'border-sky-400 ring-1 ring-sky-400/40' : 'border-slate-800 hover:border-slate-600'}`}><img src={url} alt="" className="h-full w-full object-cover" /></button>)}
                                    </div>}
                                </section>

                                <section aria-labelledby="module-description-title">
                                    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        <Code2 size={14} aria-hidden="true" />
                                        <h2 id="module-description-title">About this module</h2>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-[#0d1116] p-5 md:p-7">
                                        <h3 className="text-sm font-bold text-white">Description</h3>
                                        <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-400 md:text-[15px]">{addon.description || 'No description provided.'}</p>
                                    </div>
                                </section>

                                <section aria-labelledby="module-configuration-title">
                                    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        <Settings2 size={14} aria-hidden="true" />
                                        <h2 id="module-configuration-title">Configuration</h2>
                                    </div>
                                    <div className="rounded-xl border border-slate-800 bg-[#0d1116] p-5 md:p-7">
                                {Object.values(addon.configSchema || {}).length === 0 ? (
                                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-500">This module does not expose configurable fields.</div>
                                ) : (
                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {Object.values(addon.configSchema || {}).map((field) => (
                                            <div key={field.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{field.label}</p>
                                                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{field.shortDescription || 'No field description provided.'}</p>
                                                    </div>
                                                    <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{field.type}</span>
                                                </div>
                                                {field.options.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {field.options.slice(0, 6).map((option) => <span key={option} className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-400">{option}</span>)}
                                                        {field.options.length > 6 && <span className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-500">+{field.options.length - 6} more</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                    </div>
                                </section>

                                <section aria-labelledby="module-reviews-title">
                                    <div className="mb-3 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                            <MessageSquareText size={14} aria-hidden="true" />
                                            <h2 id="module-reviews-title">Reviews</h2>
                                        </div>
                                        <span className="text-xs text-slate-500">{reviewCount} review{reviewCount === 1 ? '' : 's'}</span>
                                    </div>

                                    <div className="rounded-xl border border-slate-800 bg-[#0d1116] p-5 md:p-7">
                                        {reviewsLoading ? (
                                            <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-slate-500">
                                                <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                                                Loading reviews
                                            </div>
                                        ) : (
                                            <>
                                                {(canReview || reviews.some((review) => review.isOwn)) ? (
                                                    <form onSubmit={submitReview} className="rounded-lg border border-slate-800 bg-slate-950/55 p-4 md:p-5">
                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-bold text-white">{reviews.some((review) => review.isOwn) ? 'Update your review' : 'Review this module'}</h3>
                                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                                    {reviewIsCreator ? 'You are reviewing your own module.' : 'Your rating is linked to a verified module install.'}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1" role="group" aria-label="Choose a rating">
                                                                {Array.from({ length: 5 }, (_, index) => {
                                                                    const value = index + 1;
                                                                    return (
                                                                        <button
                                                                            key={value}
                                                                            type="button"
                                                                            onClick={() => setReviewRating(value)}
                                                                            className={`rounded p-1 transition-colors ${value <= reviewRating ? 'text-amber-400' : 'text-slate-700 hover:text-amber-300'}`}
                                                                            aria-label={`${value} star${value === 1 ? '' : 's'}`}
                                                                            aria-pressed={value === reviewRating}
                                                                        >
                                                                            <Star size={21} fill={value <= reviewRating ? 'currentColor' : 'none'} aria-hidden="true" />
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <label className="mt-4 block">
                                                            <span className="sr-only">Review comment</span>
                                                            <textarea
                                                                value={reviewComment}
                                                                onChange={(event) => setReviewComment(event.target.value.slice(0, 1000))}
                                                                rows={3}
                                                                maxLength={1000}
                                                                placeholder="Share what worked well or what could be improved..."
                                                                className="w-full resize-y rounded-lg border border-slate-800 bg-[#080b0f] px-3.5 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"
                                                            />
                                                        </label>
                                                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-h-5 text-xs">
                                                                {reviewError && <span className="text-red-300">{reviewError}</span>}
                                                                {reviewMessage && <span className="text-emerald-300">{reviewMessage}</span>}
                                                            </div>
                                                            <button
                                                                type="submit"
                                                                disabled={reviewSubmitting || reviewRating < 1}
                                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500 px-4 text-xs font-bold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {reviewSubmitting && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
                                                                {reviews.some((review) => review.isOwn) ? 'Update Review' : 'Publish Review'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-500">
                                                        {addon.status !== 'PUBLISHED'
                                                            ? 'Reviews will open when this module is published.'
                                                            : 'Install this module to one of your servers to leave a verified review.'}
                                                    </div>
                                                )}

                                                {reviewError && !canReview && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{reviewError}</div>}

                                                {reviews.length === 0 ? (
                                                    <div className="py-10 text-center">
                                                        <MessageSquareText size={24} className="mx-auto text-slate-700" aria-hidden="true" />
                                                        <p className="mt-3 text-sm font-semibold text-slate-400">No reviews yet</p>
                                                        <p className="mt-1 text-xs text-slate-600">Be the first verified installer to share feedback.</p>
                                                    </div>
                                                ) : (
                                                    <div className="mt-5 divide-y divide-slate-800">
                                                        {reviews.map((review) => (
                                                            <article
                                                                key={review.id}
                                                                className="py-5 first:pt-0 last:pb-0"
                                                                tabIndex={review.canDelete ? 0 : undefined}
                                                                onContextMenu={review.canDelete ? (event) => {
                                                                    event.preventDefault();
                                                                    openReviewContextMenu(review.id, event.clientX, event.clientY);
                                                                } : undefined}
                                                                onKeyDown={review.canDelete ? (event) => {
                                                                    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                                                                        event.preventDefault();
                                                                        const rect = event.currentTarget.getBoundingClientRect();
                                                                        openReviewContextMenu(review.id, rect.left + 24, rect.top + 24);
                                                                    }
                                                                } : undefined}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    {review.reviewerAvatarUrl ? (
                                                                        <img src={getDiscordMediaProxyUrl(review.reviewerAvatarUrl)} alt="" className="h-9 w-9 shrink-0 rounded-full border border-slate-700 object-cover" />
                                                                    ) : (
                                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-500"><UserRound size={16} aria-hidden="true" /></span>
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                                                <h3 className="truncate text-sm font-bold text-white">{review.reviewerName}</h3>
                                                                                <span className="rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">Verified install</span>
                                                                            </div>
                                                                            <time dateTime={review.updatedAt} className="text-[11px] text-slate-600">{formatDate(review.updatedAt)}</time>
                                                                        </div>
                                                                        <div className="mt-1.5 flex items-center gap-0.5 text-amber-400" aria-label={`${review.rating} out of 5 stars`}>
                                                                            {Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < review.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}
                                                                        </div>
                                                                        {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{review.comment}</p>}
                                                                        {review.ownerReply && (
                                                                            <div className="mt-4 rounded-lg border border-sky-500/15 bg-sky-500/[0.06] px-4 py-3">
                                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300"><Reply size={12} aria-hidden="true" />Reply from {creatorName}</p>
                                                                                    {review.ownerReplyAt && <time dateTime={review.ownerReplyAt} className="text-[10px] text-slate-600">{formatDate(review.ownerReplyAt)}</time>}
                                                                                </div>
                                                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{review.ownerReply}</p>
                                                                            </div>
                                                                        )}
                                                                        {reviewIsCreator && replyingToReviewId !== review.id && (
                                                                            <button type="button" onClick={() => beginReply(review)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 transition-colors hover:text-sky-300">
                                                                                <Reply size={13} aria-hidden="true" />
                                                                                {review.ownerReply ? 'Edit reply' : 'Reply'}
                                                                            </button>
                                                                        )}
                                                                        {reviewIsCreator && replyingToReviewId === review.id && (
                                                                            <form onSubmit={(event) => submitOwnerReply(event, review.id)} className="mt-4 rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                                                                                <label>
                                                                                    <span className="sr-only">Reply to {review.reviewerName}</span>
                                                                                    <textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value.slice(0, 1000))} rows={3} maxLength={1000} autoFocus placeholder={`Reply to ${review.reviewerName}...`} className="w-full resize-y rounded-lg border border-slate-800 bg-[#080b0f] px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10" />
                                                                                </label>
                                                                                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                                    <span className="text-xs text-red-300">{replyError}</span>
                                                                                    <div className="flex gap-2">
                                                                                        <button type="button" onClick={() => { setReplyingToReviewId(null); setReplyError(null); }} disabled={replySubmitting} className="h-8 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-300 hover:border-slate-500 disabled:opacity-50">Cancel</button>
                                                                                        <button type="submit" disabled={replySubmitting || !replyDraft.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500 px-3 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">{replySubmitting && <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />}{review.ownerReply ? 'Update reply' : 'Publish reply'}</button>
                                                                                    </div>
                                                                                </div>
                                                                            </form>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </article>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </section>
                            </div>

                            <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Module summary">
                                <button
                                    type="button"
                                    onClick={() => setInstallPickerOpen(true)}
                                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                                >
                                    <Download size={16} aria-hidden="true" />
                                    Install Module
                                </button>

                                <section className="rounded-xl border border-slate-800 bg-[#0d1116] p-5">
                                    <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
                                        {addon.creatorAvatarUrl ? (
                                            <img src={addon.creatorAvatarUrl} alt="" className="h-11 w-11 rounded-full border border-slate-700 object-cover" />
                                        ) : isCurrentUserCreator && session?.user?.image ? (
                                            <img src={getDiscordMediaProxyUrl(session.user.image)} alt="" className="h-11 w-11 rounded-full border border-slate-700 object-cover" />
                                        ) : (
                                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400"><UserRound size={19} aria-hidden="true" /></span>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-500">Created by</p>
                                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-bold text-white">
                                                {creatorName}
                                                {addon.isOfficial ? (
                                                    <span className="group/official relative shrink-0" aria-label="Official">
                                                        <img src="/Media/Ro-LinkIcon.png" alt="" className="h-4 w-4 rounded object-cover" />
                                                        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/official:opacity-100">Official</span>
                                                    </span>
                                                ) : addon.creatorIsVerified ? (
                                                    <span className="group/verified relative shrink-0 text-sky-400" aria-label="Verified creator">
                                                        <CheckCircle2 size={14} aria-hidden="true" />
                                                        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/verified:opacity-100">Verified creator</span>
                                                    </span>
                                                ) : null}
                                            </p>
                                        </div>
                                    </div>

                                    <dl className="mt-5 space-y-4 text-sm">
                                        <div className="flex items-center justify-between gap-4">
                                            <dt className="flex items-center gap-2 text-slate-500"><CalendarDays size={15} aria-hidden="true" />Published</dt>
                                            <dd className="text-right font-semibold text-slate-200">{formatDate(addon.publishedAt)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <dt className="flex items-center gap-2 text-slate-500"><CalendarDays size={15} aria-hidden="true" />Updated</dt>
                                            <dd className="text-right font-semibold text-slate-200">{formatDate(addon.updatedAt)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <dt className="flex items-center gap-2 text-slate-500"><Package2 size={15} aria-hidden="true" />Version</dt>
                                            <dd className="font-mono text-xs font-bold text-slate-200">v{addon.version}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <dt className="flex items-center gap-2 text-slate-500"><Settings2 size={15} aria-hidden="true" />Fields</dt>
                                            <dd className="font-semibold text-slate-200">{Object.keys(addon.configSchema || {}).length}</dd>
                                        </div>
                                    </dl>
                                </section>

                                <section className="rounded-xl border border-slate-800 bg-[#0d1116] p-5">
                                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        <Tag size={14} aria-hidden="true" />
                                        Details
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">{addon.category}</span>
                                        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">v{addon.version}</span>
                                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(addon.status)}`}>{statusLabel(addon.status)}</span>
                                        {addon.isOfficial && <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-200">Official</span>}
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </section>
                )}

                {addon && installPickerOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                        <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-slate-700 bg-[#070b12] shadow-2xl shadow-black/50">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 px-5 py-5">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-400">Install Module</p>
                                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{addon.name}</h2>
                                    <p className="mt-2 text-sm font-medium leading-6 text-slate-400">Click a server to install. Right-click a server to start multi-select.</p>
                                </div>
                                <button type="button" onClick={closeInstallPicker} disabled={installing} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/40 text-slate-400 transition-colors hover:border-sky-500/40 hover:text-white disabled:opacity-50" aria-label="Close install picker">
                                    <X size={16} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-170px)] overflow-y-auto px-5 py-5">
                                {installError && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">{installError}</div>}
                                {installMessage && <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">{installMessage}</div>}
                                {installTargets.length === 0 ? (
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">No servers are available for module installs.</div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {installTargets.map((server) => {
                                            const selected = selectedServerIds.includes(server.id);
                                            const full = server.installedModuleCount >= server.moduleLimit;
                                            return (
                                                <button
                                                    key={server.id}
                                                    type="button"
                                                    onClick={() => multiSelectInstall ? toggleServerSelection(server.id) : installModuleToServers([server.id])}
                                                    onContextMenu={(event) => {
                                                        event.preventDefault();
                                                        setMultiSelectInstall(true);
                                                        toggleServerSelection(server.id);
                                                    }}
                                                    disabled={installing || full}
                                                    className={`flex min-h-20 items-center gap-3 rounded-lg border p-4 text-left transition-all disabled:opacity-50 ${selected ? 'border-sky-400 bg-sky-500/15' : 'border-slate-800 bg-slate-950/45 hover:border-sky-500/40 hover:bg-slate-900/55'}`}
                                                >
                                                    {server.icon ? <img src={getDiscordGuildIconProxyUrl(server.id, server.icon)} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-white/5 object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-sky-300">{server.name.substring(0, 1)}</span>}
                                                    <span className="min-w-0">
                                                        <span className="block break-words text-sm font-bold text-white">{server.name}</span>
                                                        <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">{selected ? 'Selected' : `${server.installedModuleCount}/${server.moduleLimit} installed`}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {multiSelectInstall && installTargets.length > 0 && (
                                <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-semibold text-slate-400">{selectedServerIds.length} server{selectedServerIds.length === 1 ? '' : 's'} selected</p>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => { setMultiSelectInstall(false); setSelectedServerIds([]); }} disabled={installing} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-700 px-4 text-xs font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-50">Cancel</button>
                                        <button type="button" onClick={() => installModuleToServers(selectedServerIds)} disabled={installing || selectedServerIds.length === 0} className="inline-flex h-10 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 text-xs font-bold uppercase tracking-wider text-sky-200 transition-colors hover:bg-sky-500/15 hover:text-white disabled:opacity-50">{installing ? 'Installing' : 'Install Selected'}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {reviewContextMenu && (
                    <div role="menu" aria-label="Review actions" className="fixed z-[120] min-w-44 rounded-lg border border-slate-700 bg-slate-950 p-1.5 shadow-2xl shadow-black/60" style={{ left: reviewContextMenu.x, top: reviewContextMenu.y }} onClick={(event) => event.stopPropagation()}>
                        <button type="button" role="menuitem" onClick={() => deleteReview(reviewContextMenu.reviewId)} disabled={Boolean(deletingReviewId)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50">
                            {deletingReviewId === reviewContextMenu.reviewId ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                            Delete review
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
