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
  defaultPricingContent,
  type PricingPageContent,
  type PricingPlan,
} from "@/lib/siteContent";

function blankPlan(): PricingPlan {
  return {
    id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    price: "",
    cadence: "",
    description: "",
    features: [""],
    ctaLabel: "Get started",
    ctaUrl: "/dashboard",
    featured: false,
    available: true,
    comingSoon: false,
    enabled: true,
  };
}

export default function PricingPlanEditor({ planId }: { planId?: string }) {
  const router = useRouter();
  const editing = Boolean(planId);
  const [content, setContent] = useState<PricingPageContent>(
    defaultPricingContent,
  );
  const [plan, setPlan] = useState<PricingPlan>(blankPlan);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useSuccessNotice<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/management/site-content/pricing", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Could not load pricing content.");
        const loaded = body as PricingPageContent;
        setContent(loaded);
        if (planId) {
          const existing = loaded.plans.find((item) => item.id === planId);
          if (!existing) setNotFound(true);
          else setPlan(existing);
        }
      })
      .catch((error) =>
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Could not load pricing content.",
        }),
      )
      .finally(() => setLoading(false));
  }, [planId, setMessage]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const plans = editing
      ? content.plans.map((item) => (item.id === planId ? plan : item))
      : [...content.plans, plan];
    try {
      const response = await fetch("/api/management/site-content/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...content, plans }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error ||
            `Could not ${editing ? "save" : "create"} pricing plan.`,
        );
      router.push("/management/pricing");
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : `Could not ${editing ? "save" : "create"} pricing plan.`,
      });
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (notFound) return <MissingPlan />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <Link
          href="/management/pricing"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pricing
        </Link>
        <p className="text-xs font-semibold   text-foreground">
          Public content
        </p>
        <h1 className="mt-2 text-2xl  tracking-tight text-foreground flex items-center gap-3 font-semibold">
          <PageIcon name="settings" compact />{" "}
          {editing ? "Edit pricing plan" : "Create pricing plan"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {editing
            ? "Update this plan, its call to action, and public status."
            : "Add a new plan to the public Pricing page."}
        </p>
      </header>

      <StatusMessage message={message} />

      <form onSubmit={submit} className="space-y-6">
        <Card className="rounded-xl border border-border bg-card p-5 md:p-7">
          <CardHeader className="mb-6 flex items-center gap-3 p-0 pb-4">
            <CardTitle className="font-semibold text-foreground">
              Plan details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid gap-5 sm:grid-cols-2">
              <EditorField
                label="Plan name"
                value={plan.name}
                maxLength={80}
                placeholder="e.g. Community"
                onChange={(name) => setPlan({ ...plan, name })}
              />
              <EditorField
                label="Price"
                value={plan.price}
                maxLength={80}
                placeholder="$0 or Free"
                onChange={(price) => setPlan({ ...plan, price })}
              />
              <EditorField
                label="Price suffix"
                value={plan.cadence}
                maxLength={60}
                placeholder="/ month"
                required={false}
                onChange={(cadence) => setPlan({ ...plan, cadence })}
              />
              <EditorField
                label="Button label"
                value={plan.ctaLabel}
                maxLength={60}
                onChange={(ctaLabel) => setPlan({ ...plan, ctaLabel })}
              />
              <div className="sm:col-span-2">
                <EditorField
                  label="Description"
                  value={plan.description}
                  maxLength={300}
                  multiline
                  placeholder="Describe who this plan is for."
                  onChange={(description) => setPlan({ ...plan, description })}
                />
              </div>
              <div className="sm:col-span-2">
                <EditorField
                  label="Included features (one per line)"
                  value={plan.features.join("\n")}
                  multiline
                  placeholder="First included feature"
                  onChange={(value) =>
                    setPlan({ ...plan, features: value.split("\n") })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <EditorField
                  label="Button URL"
                  value={plan.ctaUrl}
                  maxLength={500}
                  placeholder="/dashboard or https://…"
                  onChange={(ctaUrl) => setPlan({ ...plan, ctaUrl })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-2 md:p-7">
          <CardContent className="p-0">
            <Toggle
              label="Visible on pricing page"
              description="Turn this off to keep the plan saved but hidden."
              checked={plan.enabled}
              onChange={(enabled) => setPlan({ ...plan, enabled })}
            />
            <Toggle
              label="Available for selection"
              description="Unavailable plans stay visible with a disabled button."
              checked={plan.available}
              onChange={(available) => setPlan({ ...plan, available })}
            />
            <Toggle
              label="Coming soon"
              description="Shows a coming-soon state and disables selection."
              checked={plan.comingSoon}
              onChange={(comingSoon) => setPlan({ ...plan, comingSoon })}
            />
            <Toggle
              label="Show as recommended"
              description="Visually highlights this plan on the public page."
              checked={plan.featured}
              onChange={(featured) => setPlan({ ...plan, featured })}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
          <Link
            href="/management/pricing"
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
            {saving ? "Saving…" : editing ? "Save plan" : "Create plan"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MissingPlan() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-destructive/25 bg-destructive/10 px-8 py-10 text-center">
      <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3 font-semibold">
        <PageIcon name="settings" compact /> Pricing plan not found
      </h1>
      <p className="mt-2 text-sm text-destructive">
        This plan may have been removed or its link is no longer valid.
      </p>
      <Button asChild variant="outline">
        <Link href="/management/pricing">Back to Pricing</Link>
      </Button>
    </div>
  );
}
