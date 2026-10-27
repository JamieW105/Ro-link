"use client";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import { useSuccessNotice } from "@/hooks/use-success-notice";

import {
  CalendarClock,
  ExternalLink,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  SITE_BANNER_PLACEMENTS,
  SITE_BANNER_TONES,
  type SiteBanner,
  type SiteBannerPlacement,
  type SiteBannerTone,
} from "@/lib/siteBanners";

type BannerForm = {
  title: string;
  message: string;
  placement: SiteBannerPlacement;
  tone: SiteBannerTone;
  linkLabel: string;
  linkUrl: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

const emptyForm: BannerForm = {
  title: "",
  message: "",
  placement: "ALL",
  tone: "INFO",
  linkLabel: "",
  linkUrl: "",
  enabled: true,
  startsAt: "",
  endsAt: "",
};

const placementLabels: Record<SiteBannerPlacement, string> = {
  PUBLIC: "Public Pages",
  DASHBOARD: "Dashboard",
  ALL: "All Pages",
};

const placementHelp: Record<SiteBannerPlacement, string> = {
  PUBLIC: "Pages that do not require sign in",
  DASHBOARD: "Pages that require sign in",
  ALL: "Every page across the site",
};

const toneLabels: Record<SiteBannerTone, string> = {
  INFO: "Information",
  SUCCESS: "Success",
  WARNING: "Warning",
  CRITICAL: "Critical",
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function SiteBannersPage() {
  const { confirm } = useDashboardFeedback();
  const [banners, setBanners] = useState<SiteBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useSuccessNotice<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);

  const loadBanners = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/management/site-banners", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Failed to load site banners.");
      setBanners(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load site banners.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBanners();
  }, [loadBanners]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEdit(banner: SiteBanner) {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      message: banner.message,
      placement: banner.placement,
      tone: banner.tone,
      linkLabel: banner.linkLabel || "",
      linkUrl: banner.linkUrl || "",
      enabled: banner.enabled,
      startsAt: toLocalDateTime(banner.startsAt),
      endsAt: toLocalDateTime(banner.endsAt),
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  async function saveBanner(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        editingId
          ? `/api/management/site-banners/${editingId}`
          : "/api/management/site-banners",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            startsAt: form.startsAt
              ? new Date(form.startsAt).toISOString()
              : null,
            endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Failed to save site banner.");

      setFormOpen(false);
      setNotice(editingId ? "Site banner updated." : "Site banner created.");
      await loadBanners();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save site banner.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeBanner(banner: SiteBanner) {
    if (!(await confirm(`Delete "${banner.title}"? This cannot be undone.`)))
      return;
    setError("");
    setNotice("");

    const response = await fetch(`/api/management/site-banners/${banner.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Failed to delete site banner.");
      return;
    }

    setNotice("Site banner deleted.");
    await loadBanners();
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold   text-foreground">
            Site messaging
          </p>
          <h1 className="mt-2 text-2xl  tracking-tight text-foreground md:text-2xl flex items-center gap-3 font-semibold">
            <PageIcon name="settings" compact /> Site Banners
          </h1>
          <p className="mt-1 text-muted-foreground">
            Publish themed notices to public pages, signed-in pages, or the
            whole site.
          </p>
        </div>
        <Button
          variant="outline"
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New banner
        </Button>
      </header>

      {(error || notice) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-border bg-muted text-foreground"}`}
        >
          {error || notice}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent" />
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center">
          <Megaphone
            className="mx-auto h-9 w-9 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-4 font-semibold text-foreground">
            No site banners yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a banner when visitors need to see an important update.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {banners.map((banner) => (
            <Card
              key={banner.id}
              className="rounded-xl border border-border bg-card p-5 md:p-6"
            >
              <CardHeader className="flex flex-col gap-5 md:flex-row md:items-start p-0 pb-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Status render={<span />} variant="default">
                      {banner.enabled ? "Active" : "Disabled"}
                    </Status>
                    <Status render={<span />} variant="default">
                      {placementLabels[banner.placement]}
                    </Status>
                    <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold   text-muted-foreground">
                      {toneLabels[banner.tone]}
                    </span>
                  </div>
                  <CardTitle className="mt-4 text-lg font-semibold text-foreground">
                    {banner.title}
                  </CardTitle>
                  <CardDescription className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {banner.message}
                  </CardDescription>
                  {(banner.startsAt || banner.endsAt) && (
                    <CardDescription className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      {banner.startsAt
                        ? `Starts ${new Date(banner.startsAt).toLocaleString()}`
                        : "Starts immediately"}
                      {" · "}
                      {banner.endsAt
                        ? `Ends ${new Date(banner.endsAt).toLocaleString()}`
                        : "No end date"}
                    </CardDescription>
                  )}
                  {banner.linkLabel && banner.linkUrl && (
                    <a
                      href={banner.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-foreground"
                    >
                      {banner.linkLabel}
                      <ExternalLink
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => openEdit(banner)}
                    className="inline-flex items-center gap-2 border text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => void removeBanner(banner)}
                    className="inline-flex items-center gap-2 border text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0"></CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <form onSubmit={saveBanner} className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold   text-foreground">
                  {editingId ? "Edit notice" : "New notice"}
                </p>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Update site banner" : "Create site banner"}
                  </DialogTitle>
                  <DialogDescription>
                    Set the notice, audience, and schedule.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => setFormOpen(false)}
                className="border"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Title
                <Input
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  className="border"
                  placeholder="Scheduled maintenance"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Message
                <Textarea
                  required
                  maxLength={500}
                  rows={3}
                  value={form.message}
                  onChange={(event) =>
                    setForm({ ...form, message: event.target.value })
                  }
                  className="resize-none border px-4 py-3"
                  placeholder="Tell visitors what they need to know."
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-foreground">
                  Where it shows
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SITE_BANNER_PLACEMENTS.map((placement) => (
                    <Button
                      variant={
                        form.placement === placement ? "secondary" : "outline"
                      }
                      type="button"
                      aria-pressed={form.placement === placement}
                      key={placement}
                      onClick={() => setForm({ ...form, placement })}
                      className="h-auto flex-col items-start whitespace-normal px-3 py-3 text-left"
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {placementLabels[placement]}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                        {placementHelp[placement]}
                      </span>
                    </Button>
                  ))}
                </div>
              </fieldset>

              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Style
                <Select
                  aria-label="Banner tone"
                  value={form.tone}
                  onValueChange={(tone) =>
                    setForm({ ...form, tone: tone as SiteBannerTone })
                  }
                  options={SITE_BANNER_TONES.map((tone) => ({
                    value: tone,
                    label: toneLabels[tone],
                  }))}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Link label{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                  <Input
                    maxLength={40}
                    value={form.linkLabel}
                    onChange={(event) =>
                      setForm({ ...form, linkLabel: event.target.value })
                    }
                    className="border"
                    placeholder="View status"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Link URL{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                  <Input
                    value={form.linkUrl}
                    onChange={(event) =>
                      setForm({ ...form, linkUrl: event.target.value })
                    }
                    className="border"
                    placeholder="https://status.rolink.cloud"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Starts{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm({ ...form, startsAt: event.target.value })
                    }
                    className="border"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Ends{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) =>
                      setForm({ ...form, endsAt: event.target.value })
                    }
                    className="border"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <Checkbox
                  checked={form.enabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, enabled: checked === true })
                  }
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    Enabled
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Show this banner while it is within its schedule.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-7 flex justify-end gap-3 border-t border-border pt-5">
              <Button
                variant="outline"
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-sm"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                type="submit"
                disabled={saving}
                className="text-sm disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create banner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
