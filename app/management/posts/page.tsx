'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { UpdatePostRecord } from '@/lib/updatePosts';

function formatPostDate(value: string) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

export default function ManagePostsPage() {
    const [posts, setPosts] = useState<UpdatePostRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/management/posts')
            .then((res) => res.json())
            .then((data) => {
                setPosts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setPosts([]);
                setLoading(false);
            });
    }, []);

    async function deletePost(id: string) {
        if (!confirm('Delete this update post? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/management/posts/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                alert('Failed to delete update post.');
                return;
            }

            setPosts((current) => current.filter((post) => post.id !== id));
        } catch {
            alert('Failed to delete update post.');
        }
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Update Posts</h1>
                    <p className="mt-1 text-slate-400">Publish release notes, feature breakdowns, and smaller rollout changes.</p>
                </div>

                <Link
                    href="/management/posts/new"
                    className="inline-flex w-fit items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-sky-900/20 transition-all hover:bg-sky-500"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    New Post
                </Link>
            </header>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                </div>
            ) : posts.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 px-6 text-center text-slate-500">
                    <p className="text-base font-medium text-slate-400">No update posts have been published yet.</p>
                    <Link href="/management/posts/new" className="mt-3 text-sm font-bold text-sky-400 hover:text-sky-300">
                        Publish the first update
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {posts.map((post) => {
                        const sectionCount = [
                            post.major_features.length > 0 ? 1 : 0,
                            post.minor_updates.length > 0 ? 1 : 0,
                            post.qol_updates.length > 0 ? 1 : 0,
                            post.bug_fixes.length > 0 ? 1 : 0,
                        ].reduce((sum, count) => sum + count, 0);

                        return (
                            <article
                                key={post.id}
                                className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-slate-700"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300">
                                                Published {formatPostDate(post.published_at)}
                                            </span>
                                            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300">
                                                {sectionCount} section{sectionCount === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight text-white">{post.title}</h2>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/posts/${post.slug}`}
                                            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 transition-all hover:border-slate-600 hover:text-white"
                                        >
                                            View
                                        </Link>
                                        <Link
                                            href={`/management/posts/${post.id}/edit`}
                                            className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-sky-300 transition-all hover:bg-sky-500/20"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => deletePost(post.id)}
                                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-300 transition-all hover:bg-red-500/20"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <p className="mt-4 text-sm leading-relaxed text-slate-400">{post.description}</p>

                                <div className="mt-6 flex flex-wrap gap-2">
                                    {post.major_features.length > 0 && (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                                            {post.major_features.length} major feature{post.major_features.length === 1 ? '' : 's'}
                                        </span>
                                    )}
                                    {post.minor_updates.length > 0 && (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                                            {post.minor_updates.length} minor update{post.minor_updates.length === 1 ? '' : 's'}
                                        </span>
                                    )}
                                    {post.qol_updates.length > 0 && (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                                            {post.qol_updates.length} QOL item{post.qol_updates.length === 1 ? '' : 's'}
                                        </span>
                                    )}
                                    {post.bug_fixes.length > 0 && (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                                            {post.bug_fixes.length} bug fix{post.bug_fixes.length === 1 ? '' : 'es'}
                                        </span>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
