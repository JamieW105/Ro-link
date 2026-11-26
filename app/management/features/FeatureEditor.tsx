"use client";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useSuccessNotice } from "@/hooks/use-success-notice";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  EditorField,
  LoadingState,
  StatusMessage,
  Toggle,
} from "@/app/management/SiteContentFields";
import {
  defaultFeaturesContent,
  type FeatureSection,
  type FeaturesPageContent,
} from "@/lib/siteContent";

function blankFeature(): FeatureSection {
  return {
    id: `feature-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    description: "",
    items: [""],
    comingSoon: false,
    enabled: true,
  };
}

export default function FeatureEditor({ featureId }: { featureId?: string }) {
  const router = useRouter();
  const editing = Boolean(featureId);
  const [content, setContent] = useState<FeaturesPageContent>(
    defaultFeaturesContent,
  );
  const [feature, setFeature] = useState<FeatureSection>(blankFeature);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useSuccessNotice<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/management/site-content/features", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Could not load features content.");
        const loaded = body as FeaturesPageContent;
        setContent(loaded);
        if (featureId) {
          const existing = loaded.sections.find(
            (section) => section.id === featureId,
          );
          if (!existing) setNotFound(true);
          else setFeature(existing);
        }
      })
      .catch((error) =>
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Could not load features content.",
        }),
      )
      .finally(() => setLoading(false));
  }, [featureId, setMessage]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const sections = editing
      ? content.sections.map((section) =>
          section.id === featureId ? feature : section,
        )
      : [...content.sections, feature];
    try {
      const response = await fetch("/api/management/site-content/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...content, sections }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || `Could not ${editing ? "save" : "create"} feature.`,
        );
      router.push("/management/features");
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : `Could not ${editing ? "save" : "create"} feature.`,
      });
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (notFound) return <MissingFeature />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <Link
          href="/management/features"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Features
        </Link>
        <p className="text-xs font-semibold   text-foreground">
          Public content
        </p>
        <h1 className="mt-2 text-2xl  tracking-tight text-foreground flex items-center gap-3 font-semibold">
          <PageIcon name="settings" compact />{" "}
          {editing ? "Edit feature" : "Create feature"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {editing
            ? "Update this feature and its public display settings."
            : "Add a new feature to the public Features page."}
        </p>
      </header>

      <StatusMessage message={message} />

      <form onSubmit={submit} className="space-y-6">
        <Card className="rounded-xl border border-border bg-card p-5 md:p-7">
          <CardHeader className="mb-6 flex items-center gap-3 p-0 pb-4">
            <CardTitle className="font-semibold text-foreground">
              Feature details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid gap-5">
              <EditorField
                label="Feature title"
                value={feature.title}
                maxLength={100}
                placeholder="e.g. Live server visibility"
                onChange={(title) => setFeature({ ...feature, title })}
              />
              <EditorField
                label="Description"
                value={feature.description}
                maxLength={500}
                multiline
                placeholder="Explain how this feature helps a community or staff team."
                onChange={(description) =>
                  setFeature({ ...feature, description })
                }
              />
              <EditorField
                label="Bullet points (one per line)"
                value={feature.items.join("\n")}
                multiline
                placeholder="First capability"
                onChange={(value) =>
                  setFeature({ ...feature, items: value.split("\n") })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-2 md:p-7">
          <CardContent className="p-0">
            <Toggle
              label="Visible on features page"
              description="Turn this off to keep the feature saved but hidden."
              checked={feature.enabled}
              onChange={(enabled) => setFeature({ ...feature, enabled })}
            />
            <Toggle
              label="Show as coming soon"
              description="Adds a coming-soon status to the public card."
              checked={feature.comingSoon}
              onChange={(comingSoon) => setFeature({ ...feature, comingSoon })}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
          <Link
            href="/management/features"
            className="rounded-xl px-5 py-3 text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
          <Button
            variant="default"
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : editing ? "Save feature" : "Create feature"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MissingFeature() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-destructive/25 bg-destructive/10 px-8 py-10 text-center">
      <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3 font-semibold">
        <PageIcon name="settings" compact /> Feature not found
      </h1>
      <p className="mt-2 text-sm text-destructive">
        This feature may have been removed or its link is no longer valid.
      </p>
      <Button asChild variant="outline">
        <Link href="/management/features">Back to Features</Link>
      </Button>
    </div>
  );
}
