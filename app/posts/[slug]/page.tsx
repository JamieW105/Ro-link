'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import type { UpdatePostRecord } from '@/lib/updatePosts';

function formatPostDate(value: string) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

function SectionList({
    title,
    items,
}: {
    title: string;
    items: string[];
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-7">
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <ul className="mt-5 space-y-3">
                {items.map((item, index) => (
                    <li key={`${title}-${index}`} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function PostDetailPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
    const params = use(paramsPromise);
    const [post, setPost] = useState<UpdatePostRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/posts/${encodeURIComponent(params.slug)}`)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(String(data.error || 'Failed to load update.'));
                }

                setPost(data);
                setLoading(false);
            })
            .catch((loadError) => {
                setError(String(loadError instanceof Error ? loadError.message : loadError));
                setLoading(false);
            });
    }, [params.slug]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617] text-slate-200">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="min-h-screen bg-[#020617] px-6 py-20 text-slate-200">
                <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 px-8 py-12 text-center">
                    <h1 className="text-3xl font-bold text-white">Update not found</h1>
                    <p className="mt-4 text-sm leading-relaxed text-red-100">{error || 'This update post could not be loaded.'}</p>
                    <Link
                        href="/posts"
                        className="mt-8 inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
                    >
                        Back to Updates
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200">
            <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8">
                <header className="max-w-4xl">
                    <Link href="/posts" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-sky-400 transition-colors hover:text-sky-300">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Updates
                    </Link>

                    <div className="mt-10 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300">
                            Published {formatPostDate(post.published_at)}
                        </span>
                        {post.major_features.length > 0 && (
                            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300">
                                {post.major_features.length} major feature{post.major_features.length === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>

                    <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">{post.title}</h1>
                    <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">{post.description}</p>
                </header>

                <div className="mt-14 space-y-8">
                    {post.major_features.length > 0 && (
                        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-7">
                            <h2 className="text-2xl font-bold text-white">Major Features</h2>
                            <div className="mt-6 space-y-6">
                                {post.major_features.map((feature, featureIndex) => (
                                    <article key={`${feature.title}-${featureIndex}`} className="rounded-3xl border border-slate-800 bg-slate-950/40 p-6">
                                        <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                                        {feature.description && (
                                            <p className="mt-3 text-sm leading-relaxed text-slate-400">{feature.description}</p>
                                        )}
                                        <ul className="mt-5 space-y-3">
                                            {feature.subFeatures.map((subFeature, subFeatureIndex) => (
                                                <li key={`${feature.title}-${subFeatureIndex}`} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                                                    <span>{subFeature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    <SectionList title="Minor Updates" items={post.minor_updates} />
                    <SectionList title="QOL Updates" items={post.qol_updates} />
                    <SectionList title="Bug Fixes" items={post.bug_fixes} />
                </div>
            </div>
        </div>
    );
}
