'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import PostEditor from '@/app/management/posts/PostEditor';
import type { UpdatePostRecord } from '@/lib/updatePosts';

export default function EditPostPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = use(paramsPromise);
    const [post, setPost] = useState<UpdatePostRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/management/posts/${encodeURIComponent(params.id)}`)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(String(data.error || 'Failed to load post.'));
                }

                setPost(data);
                setLoading(false);
            })
            .catch((loadError) => {
                setError(String(loadError instanceof Error ? loadError.message : loadError));
                setLoading(false);
            });
    }, [params.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/20 bg-red-500/10 px-8 py-10 text-center">
                <h1 className="text-2xl font-bold text-white">Unable to load post</h1>
                <p className="mt-3 text-sm text-red-200">{error || 'This update post does not exist.'}</p>
                <Link
                    href="/management/posts"
                    className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
                >
                    Back to Updates
                </Link>
            </div>
        );
    }

    return (
        <PostEditor
            initialPost={post}
            submitUrl={`/api/management/posts/${post.id}`}
            submitMethod="PATCH"
            heading="Edit Update Post"
            subheading="Adjust the release notes and section content before publishing changes live."
            submitLabel="Save Changes"
        />
    );
}
