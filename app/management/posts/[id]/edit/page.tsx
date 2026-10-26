"use client";
import { Button } from "@/components/ui/button";
import { PageIcon } from "@/components/dashboard/PageIcon";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import PostEditor from "@/app/management/posts/PostEditor";
import type { UpdatePostRecord } from "@/lib/updatePosts";

export default function EditPostPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const [post, setPost] = useState<UpdatePostRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/management/posts/${encodeURIComponent(params.id)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(data.error || "Failed to load post."));
        }

        setPost(data);
        setLoading(false);
      })
      .catch((loadError) => {
        setError(
          String(loadError instanceof Error ? loadError.message : loadError),
        );
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-destructive/25 bg-destructive/10 px-8 py-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3 font-semibold">
          <PageIcon name="logs" compact /> Unable to load post
        </h1>
        <p className="mt-3 text-sm text-destructive">
          {error || "This update post does not exist."}
        </p>
        <Button asChild variant="outline">
          <Link href="/management/posts">Back to Updates</Link>
        </Button>
      </div>
    );
  }

  return (
    <PostEditor
      initialPost={post}
      submitUrl={`/api/management/posts/${post.id}`}
      submitMethod="PATCH"
      heading="Edit Update Post"
      subheading="Adjust draft or published release notes and section content."
      submitLabel="Save Changes"
    />
  );
}
