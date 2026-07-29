'use client';

import { ArrowRight, CalendarDays, Newspaper, PackageOpen, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PublicFooter } from '@/components/public/PublicFooter';
import type { UpdatePostRecord } from '@/lib/updatePosts';

function formatPostDate(value: string | null) {
    if (!value) return 'Unpublished';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

export default function PostsPage() {
    const [posts, setPosts] = useState<UpdatePostRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/posts')
            .then((response) => response.json())
            .then((data) => setPosts(Array.isArray(data) ? data : []))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
    }, []);

    const query = search.trim().toLowerCase();
    const filtered = posts.filter((post) => (
        !query
        || post.title.toLowerCase().includes(query)
        || post.description.toLowerCase().includes(query)
        || post.rolink_version?.toLowerCase().includes(query)
        || post.plugin_version?.toLowerCase().includes(query)
    ));

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="posts-title">
                    <div className="rl-utility-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">Product updates</p>
                            <h1 className="rl-utility-title" id="posts-title">Release notes without <span>the noise.</span></h1>
                        </div>
                        <p className="rl-utility-intro">
                            Published Ro-Link and Studio plugin changes, including major features, minor updates, quality-of-life improvements, and bug fixes.
                        </p>
                    </div>
                </section>

                <section className="rl-utility-main rl-shell">
                    <div className="rl-toolbar">
                        <div className="rl-search-wrap">
                            <Search aria-hidden="true" />
                            <label className="rl-sr-only" htmlFor="post-search">Search updates</label>
                            <input
                                className="rl-search-field"
                                id="post-search"
                                type="search"
                                placeholder="Search updates…"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="rl-loading-line" aria-label="Loading current posts" />
                    ) : filtered.length === 0 ? (
                        <div className="rl-empty-state">
                            <Newspaper aria-hidden="true" />
                            <strong>No matching updates</strong>
                            <span>Try another search or check back after the next release.</span>
                        </div>
                    ) : (
                        <div className="rl-data-list">
                            {filtered.map((post) => (
                                <Link className="rl-data-row" href={`/posts/${post.slug}`} key={post.id}>
                                    <div>
                                        <div className="rl-data-row-meta">
                                            <span><CalendarDays aria-hidden="true" />{formatPostDate(post.published_at)}</span>
                                            {post.rolink_version && <span><PackageOpen aria-hidden="true" />Ro-Link {post.rolink_version}</span>}
                                            {post.plugin_version && <span>Plugin {post.plugin_version}</span>}
                                        </div>
                                        <h2>{post.title}</h2>
                                        <p>{post.description}</p>
                                    </div>
                                    <span className="rl-data-row-action"><ArrowRight aria-hidden="true" /></span>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
