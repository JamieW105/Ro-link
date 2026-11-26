'use client';
import { PublicLoading } from '@/components/public/PublicLoading';

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays, PackageOpen } from 'lucide-react';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import AutoLinkText from '@/components/AutoLinkText';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
import type { UpdatePostRecord } from '@/lib/updatePosts';

function formatPostDate(value: string | null) {
    if (!value) {
        return 'Unpublished';
    }

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
        <section className="rl-post-section">
            <h2>{title}</h2>
            <ul className="rl-post-list">
                {items.map((item, index) => (
                    <li key={`${title}-${index}`}>
                        <AutoLinkText linkClassName="break-all font-medium text-primary underline underline-offset-4 hover:text-primary/80" text={item} preserveLineBreaks />
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
            <main className="rl-public-page rl-post-status" aria-label="Loading update">
                <PublicLoading />
            </main>
        );
    }

    if (error || !post) {
        return (
            <>
                <main className="rl-public-page">
                    <section className="rl-utility-main rl-shell">
                        <Card className="rl-empty-state rl-post-not-found">
                            <strong>Update not found</strong>
                            <span>{error || 'This update post could not be loaded.'}</span>
                            <Button asChild variant="outline"><Link href="/posts">Back to updates</Link></Button>
                        </Card>
                    </section>
                </main>
                <PublicFooter />
            </>
        );
    }

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="post-title">
                    <PublicHeroBackdrop />
                    <div className="rl-post-detail-hero-inner rl-shell">
                        <Link href="/posts" className="rl-back-link">
                            <ArrowLeft aria-hidden="true" />All updates
                        </Link>

                        <p className="rl-eyebrow">Product update</p>
                        <h1 className="rl-post-detail-title" id="post-title">{post.title}</h1>
                        <AutoLinkText linkClassName="break-all font-medium text-primary underline underline-offset-4 hover:text-primary/80" as="p" text={post.description} preserveLineBreaks className="rl-post-detail-intro" />

                        <div className="rl-post-detail-meta">
                            <span><CalendarDays aria-hidden="true" />Published {formatPostDate(post.published_at)}</span>
                            {post.rolink_version && <span><PackageOpen aria-hidden="true" />Ro-Link {post.rolink_version}</span>}
                            {post.plugin_version && <span>Plugin {post.plugin_version}</span>}
                            {post.major_features.length > 0 && (
                                <span>{post.major_features.length} major feature{post.major_features.length === 1 ? '' : 's'}</span>
                            )}
                        </div>
                    </div>
                </section>

                <section className="rl-post-detail-main rl-shell">
                    <div className="rl-post-sections">
                    {post.major_features.length > 0 && (
                        <section className="rl-post-section">
                            <h2>Major Features</h2>
                            <div className="rl-post-feature-list">
                                {post.major_features.map((feature, featureIndex) => (
                                    <Card key={`${feature.title}-${featureIndex}`} className="rl-post-feature">
                                        <h3>{feature.title}</h3>
                                        {feature.description && (
                                            <AutoLinkText linkClassName="break-all font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                                                as="p"
                                                text={feature.description}
                                                preserveLineBreaks
                                            />
                                        )}
                                        <ul className="rl-post-list">
                                            {feature.subFeatures.map((subFeature, subFeatureIndex) => (
                                                <li key={`${feature.title}-${subFeatureIndex}`}>
                                                    <AutoLinkText linkClassName="break-all font-medium text-primary underline underline-offset-4 hover:text-primary/80" text={subFeature} preserveLineBreaks />
                                                </li>
                                            ))}
                                        </ul>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}

                    <SectionList title="Minor Updates" items={post.minor_updates} />
                    <SectionList title="QOL Updates" items={post.qol_updates} />
                    <SectionList title="Bug Fixes" items={post.bug_fixes} />
                    </div>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
