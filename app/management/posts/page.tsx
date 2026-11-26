"use client";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import { Plus as LucidePlus } from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";

import AutoLinkText from "@/components/AutoLinkText";
import type { UpdatePostRecord } from "@/lib/updatePosts";

function formatPostDate(value: string | null) {
  if (!value) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function ManagePostsPage() {
  const { confirm, notify } = useDashboardFeedback();
  const [posts, setPosts] = useState<UpdatePostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/management/posts")
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
    if (!(await confirm("Delete this update post? This cannot be undone."))) {
      return;
    }

    try {
      const response = await fetch(
        `/api/management/posts/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        notify("Failed to delete update post.");
        return;
      }

      setPosts((current) => current.filter((post) => post.id !== id));
    } catch {
      notify("Failed to delete update post.");
    }
  }

  async function publishPost(id: string) {
    if (
      !(await confirm(
        "Publish this update post? It will become visible on the public updates page.",
      ))
    ) {
      return;
    }

    setPublishingId(id);

    try {
      const response = await fetch(
        `/api/management/posts/${encodeURIComponent(id)}/publish`,
        {
          method: "PATCH",
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify(String(payload.error || "Failed to publish update post."));
        return;
      }

      setPosts((current) =>
        current.map((post) => (post.id === id ? payload : post)),
      );
    } catch {
      notify("Failed to publish update post.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl  tracking-tight text-foreground flex items-center gap-3 font-semibold">
            <PageIcon name="logs" compact /> Update Posts
          </h1>
          <p className="mt-1 text-muted-foreground">
            Draft release notes, then publish them when they are ready to go
            live.
          </p>
        </div>

        <Button asChild variant="default">
          <Link href="/management/posts/new">
            <LucidePlus className="h-4 w-4" />
            New Post
          </Link>
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center text-muted-foreground">
          <CardContent className="p-0">
            <p className="text-base font-medium text-muted-foreground">
              No update posts have been created yet.
            </p>
            <Link
              href="/management/posts/new"
              className="mt-3 text-sm font-semibold text-foreground hover:text-foreground"
            >
              Create the first draft
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {posts.map((post) => {
            const isPublished = post.status === "PUBLISHED";
            const sectionCount = [
              post.major_features.length > 0 ? 1 : 0,
              post.minor_updates.length > 0 ? 1 : 0,
              post.qol_updates.length > 0 ? 1 : 0,
              post.bug_fixes.length > 0 ? 1 : 0,
            ].reduce((sum, count) => sum + count, 0);

            return (
              <Card
                key={post.id}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-all hover:border-border"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {post.rolink_version && (
                        <Status render={<span />} variant="default">
                          Ro-Link {post.rolink_version}
                        </Status>
                      )}
                      {post.plugin_version && (
                        <Status render={<span />} variant="default">
                          Plugin {post.plugin_version}
                        </Status>
                      )}
                      <Status render={<span />} variant="default">
                        {isPublished && post.published_at
                          ? `Published ${formatPostDate(post.published_at)}`
                          : isPublished
                            ? "Published"
                            : "Draft"}
                      </Status>
                      <Status render={<span />} variant="default">
                        {sectionCount} section{sectionCount === 1 ? "" : "s"}
                      </Status>
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {post.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPublished && (
                      <Button asChild variant="outline">
                        <Link href={`/posts/${post.slug}`}>View</Link>
                      </Button>
                    )}
                    {!isPublished && (
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => publishPost(post.id)}
                        disabled={publishingId === post.id}
                        className="border text-xs transition-all disabled:opacity-50"
                      >
                        {publishingId === post.id ? "Publishing..." : "Publish"}
                      </Button>
                    )}
                    <Button asChild variant="default">
                      <Link href={`/management/posts/${post.id}/edit`}>
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => deletePost(post.id)}
                      className="border text-xs transition-all"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <AutoLinkText
                  as="p"
                  text={post.description}
                  className="mt-4 text-sm leading-relaxed text-muted-foreground"
                />

                <div className="mt-6 flex flex-wrap gap-2">
                  {post.major_features.length > 0 && (
                    <Status render={<span />} variant="default">
                      {post.major_features.length} major feature
                      {post.major_features.length === 1 ? "" : "s"}
                    </Status>
                  )}
                  {post.minor_updates.length > 0 && (
                    <Status render={<span />} variant="default">
                      {post.minor_updates.length} minor update
                      {post.minor_updates.length === 1 ? "" : "s"}
                    </Status>
                  )}
                  {post.qol_updates.length > 0 && (
                    <Status render={<span />} variant="default">
                      {post.qol_updates.length} QOL item
                      {post.qol_updates.length === 1 ? "" : "s"}
                    </Status>
                  )}
                  {post.bug_fixes.length > 0 && (
                    <Status render={<span />} variant="default">
                      {post.bug_fixes.length} bug fix
                      {post.bug_fixes.length === 1 ? "" : "es"}
                    </Status>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
