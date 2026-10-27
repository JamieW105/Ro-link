"use client";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import {
  Card,
  CardContent,
  CardTitle,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import { useSuccessNotice } from "@/hooks/use-success-notice";

import { X as LucideX } from "lucide-react";

import { useEffect, useMemo, useState } from "react";

const TARGET_OPTIONS = [
  {
    value: "verified-linked-users",
    label: "Verified linked users",
    description: "Discord users with a saved Roblox account link.",
  },
  {
    value: "server-owners-all",
    label: "Server owners (all)",
    description: "Owners of current Discord servers where the bot is present.",
  },
  {
    value: "server-owners-setup",
    label: "Server owners with setup",
    description:
      "Owners of current bot servers that also have Ro-Link setup saved.",
  },
  {
    value: "server-owners-without-setup",
    label: "Server owners without setup",
    description: "Owners of current bot servers that have not completed setup.",
  },
] as const;

type TargetValue = (typeof TARGET_OPTIONS)[number]["value"];

type EmbedField = {
  name: string;
  value: string;
  inline: boolean;
};

type SendResult = {
  attempted: number;
  skippedOptedOut?: number;
  sent: number;
  failed: number;
  failures?: Array<{ userId: string; error: string }>;
  counts?: Record<TargetValue, number>;
  rawCounts?: Record<TargetValue, number>;
};

const DEFAULT_COLOR = "#38bdf8";
const RO_LINK_ICON = "/Media/Ro-LinkIcon.png";

function emptyField(): EmbedField {
  return {
    name: "",
    value: "",
    inline: false,
  };
}

function parseHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_COLOR;
}

export default function ManagementDmsPage() {
  const { confirm } = useDashboardFeedback();
  const [target, setTarget] = useState<TargetValue>("verified-linked-users");
  const [counts, setCounts] = useState<Record<TargetValue, number>>({
    "verified-linked-users": 0,
    "server-owners-all": 0,
    "server-owners-setup": 0,
    "server-owners-without-setup": 0,
  });
  const [plainText, setPlainText] = useState("");
  const [embedTitle, setEmbedTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [removeSetColor, setRemoveSetColor] = useState(false);
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<EmbedField[]>([emptyField()]);
  const [footerText, setFooterText] = useState("");
  const [footerIconUrl, setFooterIconUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useSuccessNotice<string>("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      setLoadingCounts(true);
      setError("");

      try {
        const response = await fetch("/api/management/dms", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load DM targets.");
        }

        if (!cancelled && data.counts) {
          setCounts(data.counts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load DM targets.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCounts(false);
        }
      }
    }

    loadCounts();
    setMounted(true);

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCount = counts[target] || 0;
  const cleanFields = useMemo(
    () => fields.filter((field) => field.name.trim() && field.value.trim()),
    [fields],
  );
  const hasEmbedContent = Boolean(
    embedTitle.trim() ||
    description.trim() ||
    cleanFields.length ||
    footerText.trim() ||
    imageUrl.trim() ||
    thumbnailUrl.trim(),
  );
  const activeFooterText = useMemo(() => {
    if (footerText.trim()) {
      return footerText;
    }

    const sendingTypes: Record<string, string> = {
      "verified-linked-users": "Verified Linked Users",
      "server-owners-all": "Server Owners (All)",
      "server-owners-setup": "Server Owners with Setup",
      "server-owners-without-setup": "Server Owners without Setup",
    };
    const sendingType = sendingTypes[target] || "Verified Linked Users";

    const date = mounted ? new Date() : new Date("2026-05-20T14:45:25+12:00");
    const timestamp = date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `Sent by Ro-Link Staff to all ${sendingType}. | ${timestamp}`;
  }, [footerText, target, mounted]);
  const canSend =
    Boolean(plainText.trim() || hasEmbedContent) &&
    selectedCount > 0 &&
    !sending;

  function updateField(index: number, patch: Partial<EmbedField>) {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  function removeField(index: number) {
    setFields((current) =>
      current.length <= 1
        ? [emptyField()]
        : current.filter((_, fieldIndex) => fieldIndex !== index),
    );
  }

  async function sendMessage() {
    if (!canSend) return;

    const confirmed = await confirm(
      `Send this DM to ${selectedCount} recipient${selectedCount === 1 ? "" : "s"}?`,
    );
    if (!confirmed) return;

    setSending(true);
    setNotice("");
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/management/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          plainText,
          embedTitle,
          color,
          removeSetColor,
          description,
          fields: cleanFields,
          footerText,
          footerIconUrl,
          imageUrl,
          thumbnailUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send DMs.");
      }

      setResult(data);
      if (data.counts) {
        setCounts(data.counts);
      }
      setNotice(`Sent ${data.sent} of ${data.attempted} DMs.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send DMs.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl  tracking-tight text-foreground flex items-center gap-3 font-semibold">
            <PageIcon name="commands" compact /> DM Builder
          </h1>
          <p className="mt-1 text-muted-foreground">
            Send Ro-Link direct messages to verified users or server-owner
            groups.
          </p>
        </div>
        <Card className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <CardContent className="p-0">
            <span className="text-muted-foreground">Selected recipients</span>
            <span className="ml-3 font-mono text-lg font-semibold text-foreground">
              {loadingCounts ? "..." : selectedCount}
            </span>
          </CardContent>
        </Card>
      </header>

      {(notice || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-border bg-muted text-foreground"}`}
        >
          {error || notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-semibold   text-foreground">
                Target
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {TARGET_OPTIONS.map((option) => {
                  const isSelected = option.value === target;
                  return (
                    <Button
                      variant={isSelected ? "secondary" : "outline"}
                      aria-pressed={isSelected}
                      key={option.value}
                      type="button"
                      onClick={() => setTarget(option.value)}
                      className="h-auto items-start whitespace-normal px-4 py-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {option.label}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                        <Status render={<span />} variant="default">
                          {loadingCounts ? "..." : counts[option.value] || 0}
                        </Status>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-semibold   text-foreground">
                Plaintext
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Textarea
                aria-label="Message content..."
                value={plainText}
                onChange={(event) => setPlainText(event.target.value)}
                maxLength={2000}
                placeholder="Message content..."
                className="mt-4 h-32 w-full resize-none border p-4 text-sm transition-all"
              />
              <p className="mt-2 text-right font-mono text-[11px] text-muted-foreground">
                {plainText.length}/2000
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-0 pb-4">
              <div>
                <CardTitle className="text-sm font-semibold   text-foreground">
                  Embed
                </CardTitle>
                <CardDescription className="mt-1 text-sm text-muted-foreground">
                  Author name and image are always set to Ro-Link.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold   text-foreground">
                  <Checkbox
                    checked={removeSetColor}
                    onCheckedChange={(checked) =>
                      setRemoveSetColor(checked === true)
                    }
                  />
                  Remove setColor()
                </label>
                <Input
                  type="color"
                  value={parseHexColor(color)}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-10 w-12 border"
                  aria-label="Embed color"
                  disabled={removeSetColor}
                />
                <Input
                  aria-label=" Remove setColor()"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  placeholder="#38bdf8"
                  className="w-28 border text-sm"
                  disabled={removeSetColor}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="mt-5 grid gap-4">
                <Input
                  aria-label="Embed title"
                  value={embedTitle}
                  onChange={(event) => setEmbedTitle(event.target.value)}
                  maxLength={256}
                  placeholder="Embed title"
                  className="border text-sm"
                />
                <Textarea
                  aria-label="Embed description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={4096}
                  placeholder="Embed description"
                  className="h-32 resize-none border p-4 text-sm"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    aria-label="Main image URL"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="Main image URL"
                    className="border text-sm"
                  />
                  <Input
                    aria-label="Thumbnail image URL"
                    value={thumbnailUrl}
                    onChange={(event) => setThumbnailUrl(event.target.value)}
                    placeholder="Thumbnail image URL"
                    className="border text-sm"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    aria-label="Footer text"
                    value={footerText}
                    onChange={(event) => setFooterText(event.target.value)}
                    maxLength={2048}
                    placeholder="Footer text"
                    className="border text-sm"
                  />
                  <Input
                    aria-label="Footer icon URL"
                    value={footerIconUrl}
                    onChange={(event) => setFooterIconUrl(event.target.value)}
                    placeholder="Footer icon URL"
                    className="border text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="flex items-center justify-between gap-3 p-0 pb-4">
              <CardTitle className="text-sm font-semibold   text-foreground">
                Fields
              </CardTitle>
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  setFields((current) =>
                    current.length >= 25 ? current : [...current, emptyField()],
                  )
                }
                disabled={fields.length >= 25}
                className="text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Field
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="mt-4 space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-border bg-background p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]"
                  >
                    <Input
                      aria-label="Field name"
                      value={field.name}
                      onChange={(event) =>
                        updateField(index, { name: event.target.value })
                      }
                      maxLength={256}
                      placeholder="Field name"
                      className="border text-sm"
                    />
                    <Input
                      aria-label="Field value"
                      value={field.value}
                      onChange={(event) =>
                        updateField(index, { value: event.target.value })
                      }
                      maxLength={1024}
                      placeholder="Field value"
                      className="border text-sm"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Checkbox
                          checked={field.inline}
                          onCheckedChange={(checked) =>
                            updateField(index, { inline: checked === true })
                          }
                        />
                        Inline
                      </label>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => removeField(index)}
                        className="transition-all"
                        title="Remove field"
                      >
                        <LucideX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-semibold   text-foreground">
                Preview
              </CardTitle>
            </CardHeader>

            <CardHeader className="mt-4 rounded-xl border border-border bg-background p-4 p-0 pb-4">
              {plainText.trim() && (
                <CardDescription className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {plainText}
                </CardDescription>
              )}
              {(plainText.trim() || hasEmbedContent) && (
                <div
                  className={`mt-3 bg-muted/40 p-4 ${removeSetColor ? "rounded-xl" : "rounded-r-xl border-l-4"}`}
                  style={
                    removeSetColor
                      ? undefined
                      : { borderColor: parseHexColor(color) }
                  }
                >
                  <div className="mb-3 flex items-center gap-2">
                    <img
                      src={RO_LINK_ICON}
                      alt=""
                      className="h-5 w-5 rounded"
                    />
                    <span className="text-xs font-semibold text-foreground">
                      Ro-Link
                    </span>
                  </div>
                  {embedTitle.trim() && (
                    <CardTitle className="break-words text-sm font-semibold text-foreground">
                      {embedTitle}
                    </CardTitle>
                  )}
                  {description.trim() && (
                    <CardDescription className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
                      {description}
                    </CardDescription>
                  )}
                  {thumbnailUrl.trim() && (
                    <CardDescription className="mt-3 truncate text-xs text-foreground">
                      Thumbnail: {thumbnailUrl}
                    </CardDescription>
                  )}
                  {imageUrl.trim() && (
                    <CardDescription className="mt-2 truncate text-xs text-foreground">
                      Image: {imageUrl}
                    </CardDescription>
                  )}
                  {cleanFields.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {cleanFields.map((field, index) => (
                        <div key={`${field.name}-${index}`}>
                          <CardDescription className="break-words text-xs font-semibold text-foreground">
                            {field.name}
                          </CardDescription>
                          <CardDescription className="break-words text-xs text-muted-foreground">
                            {field.value}
                          </CardDescription>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <img
                      src={footerIconUrl.trim() || RO_LINK_ICON}
                      alt=""
                      className="h-4 w-4 rounded"
                    />
                    <span className="break-words">{activeFooterText}</span>
                  </div>
                </div>
              )}
              {!plainText.trim() && !hasEmbedContent && (
                <CardDescription className="text-sm text-muted-foreground">
                  Build a plaintext message, embed, or both.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-0"></CardContent>
          </Card>

          <Button
            variant="outline"
            type="button"
            onClick={sendMessage}
            disabled={!canSend}
            className="w-full text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending
              ? "Sending..."
              : `Send to ${selectedCount} recipient${selectedCount === 1 ? "" : "s"}`}
          </Button>

          {result && (
            <Card className="rounded-xl border border-border bg-card p-5 text-sm">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-sm font-semibold   text-foreground">
                  Result
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-background p-3">
                    <p className="font-mono text-lg font-semibold text-foreground">
                      {result.attempted}
                    </p>
                    <p className="text-[10px]   text-muted-foreground">
                      Attempted
                    </p>
                  </div>
                  <div className="rounded-xl bg-background p-3">
                    <p className="font-mono text-lg font-semibold text-foreground">
                      {result.sent}
                    </p>
                    <p className="text-[10px]   text-muted-foreground">Sent</p>
                  </div>
                  <div className="rounded-xl bg-background p-3">
                    <p className="font-mono text-lg font-semibold text-destructive">
                      {result.failed}
                    </p>
                    <p className="text-[10px]   text-muted-foreground">
                      Failed
                    </p>
                  </div>
                </div>
                {Number(result.skippedOptedOut || 0) > 0 && (
                  <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                    Skipped {result.skippedOptedOut} opted-out recipient
                    {result.skippedOptedOut === 1 ? "" : "s"}.
                  </p>
                )}
                {result.failures && result.failures.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {result.failures.map((failure) => (
                      <p
                        key={failure.userId}
                        className="break-words rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
                      >
                        {failure.userId}: {failure.error}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
