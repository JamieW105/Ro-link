'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ModuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

interface AddonModule {
    id: string;
    slug: string;
    name: string;
    description: string;
    version: string;
    category: string;
    status: ModuleStatus;
    isOfficial: boolean;
    sourceCode?: string;
    sourceChecksum: string;
    configSchema?: Record<string, unknown>;
    authorDiscordId: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewedByDiscordId: string | null;
    moderationNote: string;
    updatedAt: string | null;
    publishedAt: string | null;
    creatorHistory?: AddonModule[];
}

interface CreatorBlock {
    discord_id: string;
    reason: string;
    active: boolean;
}

function formatDate(value: string | null | undefined) {
    if (!value) return 'Never';
    return new Date(value).toLocaleString();
}

function statusClassName(status: ModuleStatus) {
    if (status === 'PUBLISHED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    if (status === 'PENDING_REVIEW') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    if (status === 'REJECTED') return 'border-red-400/20 bg-red-400/10 text-red-300';
    return 'border-slate-700 bg-slate-950 text-slate-500';
}

export default function ManagementModuleReviewPage() {
    const params = useParams();
    const router = useRouter();
    const moduleId = Array.isArray(params.id) ? params.id[0] : String(params.id || '');
    const [module, setModule] = useState<AddonModule | null>(null);
    const [creatorBlocks, setCreatorBlocks] = useState<CreatorBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const history = useMemo(() => module?.creatorHistory || [], [module]);
    const configFields = useMemo(() => Object.entries(module?.configSchema || {}), [module]);
    const creatorBlocked = useMemo(() => {
        if (!module?.authorDiscordId) return false;
        return creatorBlocks.some((block) => block.active && block.discord_id === module.authorDiscordId);
    }, [creatorBlocks, module?.authorDiscordId]);

    const loadModule = useCallback(async () => {
        if (!moduleId) return;
        setLoading(true);
        setError(null);

        try {
            const [moduleResponse, blocksResponse] = await Promise.all([
                fetch(`/api/management/modules/${moduleId}`, { cache: 'no-store' }),
                fetch('/api/management/module-creator-blocks', { cache: 'no-store' }),
            ]);
            const modulePayload = await moduleResponse.json().catch(() => ({}));
            if (!moduleResponse.ok) {
                throw new Error(String(modulePayload.error || 'Failed to load module.'));
            }
            setModule(modulePayload as AddonModule);

            const blocksPayload = await blocksResponse.json().catch(() => ([]));
            if (blocksResponse.ok) {
                setCreatorBlocks(Array.isArray(blocksPayload) ? blocksPayload : []);
            }
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load module.');
        } finally {
            setLoading(false);
        }
    }, [moduleId]);

    useEffect(() => {
        loadModule();
    }, [loadModule]);

    async function copySource() {
        if (!module) return;
        await navigator.clipboard.writeText(module.sourceCode || '');
        setSuccess(`Copied ${module.name} source code.`);
    }

    async function reviewModule(status: 'PUBLISHED' | 'REJECTED') {
        if (!module) return;
        const moderationNote = status === 'REJECTED'
            ? prompt('Reason for denying this module?') || 'Denied by moderation.'
            : '';

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/management/modules/${module.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, moderationNote }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to review module.'));
            }

            setSuccess(status === 'PUBLISHED' ? 'Module accepted and published.' : 'Module denied.');
            await loadModule();
        } catch (reviewError) {
            setError(reviewError instanceof Error ? reviewError.message : 'Failed to review module.');
        } finally {
            setSaving(false);
        }
    }

    async function blockCreator() {
        if (!module?.authorDiscordId) {
            setError('This module does not have a creator Discord ID.');
            return;
        }

        const reason = prompt('Reason for blocking this creator from submitting modules?') || 'Repeated module terms violations.';
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/management/module-creator-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId: module.authorDiscordId, reason, active: true }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to block creator.'));
            }

            setSuccess('Creator blocked from future module submissions.');
            await loadModule();
        } catch (blockError) {
            setError(blockError instanceof Error ? blockError.message : 'Failed to block creator.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteModule() {
        if (!module || !confirm(`Delete ${module.name}? Installed copies will be removed from servers.`)) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/management/modules/${module.id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to delete module.'));
            }

            router.push('/management/modules');
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete module.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!module) {
        return (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                {error || 'Module not found.'}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 border-b border-slate-800 pb-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <Link href="/management/modules" className="text-xs font-bold uppercase tracking-widest text-sky-300 hover:text-sky-200">
                        Back to modules
                    </Link>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(module.status)}`}>
                            {module.status}
                        </span>
                        {module.isOfficial && (
                            <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                Official
                            </span>
                        )}
                        {creatorBlocked && (
                            <span className="rounded-md border border-red-400/20 bg-red-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
                                Creator blocked
                            </span>
                        )}
                    </div>
                    <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-5xl">{module.name}</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{module.description || 'No description provided.'}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <span>{module.slug}</span>
                        <span>{module.category}</span>
                        <span>v{module.version}</span>
                        <span>{module.sourceChecksum.slice(0, 12)}</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                    <button
                        onClick={copySource}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                    >
                        Copy Code
                    </button>
                    <button
                        onClick={() => reviewModule('PUBLISHED')}
                        disabled={saving || module.status === 'PUBLISHED'}
                        className="rounded-lg border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                        Accept
                    </button>
                    <button
                        onClick={() => reviewModule('REJECTED')}
                        disabled={saving || module.status === 'REJECTED'}
                        className="rounded-lg border border-red-500/30 px-4 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                        Deny
                    </button>
                    <button
                        onClick={blockCreator}
                        disabled={saving || !module.authorDiscordId || creatorBlocked}
                        className="rounded-lg border border-red-500/30 px-4 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                        {creatorBlocked ? 'Blocked' : 'Block Creator'}
                    </button>
                    <button
                        onClick={deleteModule}
                        disabled={saving}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            </header>

            {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-300">
                    {success}
                </div>
            )}

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-6">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
                        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Submitted Source</h2>
                            <span className="font-mono text-xs text-slate-500">{(module.sourceCode || '').length.toLocaleString()} chars</span>
                        </div>
                        <pre className="max-h-[70vh] overflow-auto p-5 text-xs leading-relaxed text-slate-300">
                            <code>{module.sourceCode || 'Source was cleared or is unavailable.'}</code>
                        </pre>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-white">Config Schema</h2>
                        {configFields.length > 0 ? (
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {configFields.map(([key, field]) => {
                                    const record = field && typeof field === 'object' ? field as Record<string, unknown> : {};
                                    return (
                                        <div key={key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                                            <div className="font-semibold text-white">{String(record.label || key)}</div>
                                            <div className="mt-1 font-mono text-xs text-slate-500">{key}</div>
                                            <p className="mt-2 text-xs leading-relaxed text-slate-400">{String(record.shortDescription || 'No description provided.')}</p>
                                            <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">{String(record.type || 'unknown')}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-slate-500">This module does not declare configurable fields.</p>
                        )}
                    </div>
                </div>

                <aside className="space-y-6">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-white">Creator</h2>
                        <dl className="mt-4 space-y-4 text-sm">
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Discord ID</dt>
                                <dd className="mt-1 break-all font-mono text-slate-300">{module.authorDiscordId || 'Unknown'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Submitted</dt>
                                <dd className="mt-1 text-slate-300">{formatDate(module.submittedAt)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Reviewed</dt>
                                <dd className="mt-1 text-slate-300">{formatDate(module.reviewedAt)}</dd>
                            </div>
                            {module.reviewedByDiscordId && (
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Reviewed By</dt>
                                    <dd className="mt-1 break-all font-mono text-slate-300">{module.reviewedByDiscordId}</dd>
                                </div>
                            )}
                            {module.moderationNote && (
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">Moderation Note</dt>
                                    <dd className="mt-1 text-slate-300">{module.moderationNote}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Upload History</h2>
                                <p className="mt-1 text-xs text-slate-500">Past reviewed submissions from this creator.</p>
                            </div>
                            <div className="text-2xl font-black text-slate-300">{history.length}</div>
                        </div>
                        <div className="mt-4 space-y-3">
                            {history.map((item) => (
                                <Link
                                    key={item.id}
                                    href={`/management/modules/${item.id}`}
                                    className="block rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition-colors hover:border-sky-500/40"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-white">{item.name}</div>
                                            <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                                <span>{item.slug}</span>
                                                <span>v{item.version}</span>
                                            </div>
                                        </div>
                                        <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                    <div className="mt-3 text-xs text-slate-500">Reviewed {formatDate(item.reviewedAt)}</div>
                                    {item.moderationNote && (
                                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">{item.moderationNote}</p>
                                    )}
                                </Link>
                            ))}
                            {history.length === 0 && (
                                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                                    No past reviewed module uploads were found for this creator.
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </section>
        </div>
    );
}
