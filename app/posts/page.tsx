'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { UpdatePostRecord } from '@/lib/updatePosts';

function formatPostDate(value: string) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

export default function PostsPage() {
    const [posts, setPosts] = useState<UpdatePostRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/posts')
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

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200">
            <div className="mx-auto max-w-6xl px-6 py-20 sm:px-8">
                <header className="max-w-3xl">
                    <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-sky-400 transition-colors hover:text-sky-300">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Home
                    </Link>
                    <p className="mt-10 text-xs font-bold uppercase tracking-[0.35em] text-sky-400">Ro-Link Updates</p>
                    <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">Release notes, rollout logs, and product changes.</h1>
                    <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
                        Every major feature, minor change, quality-of-life tweak, and bug fix we choose to publish lives here.
                    </p>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="mt-16 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 px-8 py-16 text-center">
                        <h2 className="text-2xl font-bold text-white">No updates published yet</h2>
                        <p className="mt-3 text-sm text-slate-400">Check back after the next release.</p>
                    </div>
                ) : (
                    <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {posts.map((post) => {
                            const totalSubFeatures = post.major_features.reduce((total, feature) => total + feature.subFeatures.length, 0);

                            return (
                                <article key={post.id} className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-7 transition-all hover:border-slate-700">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300">
                                            {formatPostDate(post.published_at)}
                                        </span>
                                        {post.major_features.length > 0 && (
                                            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300">
                                                {post.major_features.length} major feature{post.major_features.length === 1 ? '' : 's'}
                                            </span>
                                        )}
                                    </div>

                                    <h2 className="mt-5 text-2xl font-bold tracking-tight text-white">{post.title}</h2>
                                    <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{post.description}</p>

                                    <div className="mt-6 flex flex-wrap gap-2">
                                        {totalSubFeatures > 0 && (
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                                                {totalSubFeatures} sub-feature{totalSubFeatures === 1 ? '' : 's'}
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

                                    <div className="mt-8">
                                        <Link
                                            href={`/posts/${post.slug}`}
                                            className="inline-flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-5 py-3 text-sm font-bold text-sky-300 transition-all hover:bg-sky-500/20"
                                        >
                                            Read Update
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
