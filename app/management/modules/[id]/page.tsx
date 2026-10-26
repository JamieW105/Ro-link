"use client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Status } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardTitle,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import { useSuccessNotice } from "@/hooks/use-success-notice";

import { Check as LucideCheck, X as LucideX } from "lucide-react";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LuauCodeBlock,
  LuauCodeEditor,
} from "@/components/dashboard/LuauSyntax";
import { runModuleReviewChecks } from "@/lib/moduleReviewChecks";

type ModuleStatus =
  "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
type ModuleConfigFieldType =
  | "bool"
  | "dropdown"
  | "checkboxes"
  | "color"
  | "integer"
  | "string"
  | "group"
  | "player"
  | "server";

interface ModuleConfigField {
  key: string;
  label: string;
  shortDescription: string;
  type: ModuleConfigFieldType;
  options: string[];
  defaultValue: boolean | string | string[] | number | Record<string, unknown>;
}

interface AddonModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  category: string;
  status: ModuleStatus;
  isOfficial: boolean;
  sourceCode?: string;
  sourceChecksum: string;
  configSchema?: Record<string, ModuleConfigField>;
  authorDiscordId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByDiscordId: string | null;
  moderationNote: string;
  updatedAt: string | null;
  publishedAt: string | null;
  creatorHistory?: AddonModule[];
}

interface CreatorBlock {
  discord_id: string;
  reason: string;
  active: boolean;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function statusClassName(status: ModuleStatus) {
  if (status === "PUBLISHED") return "success" as const;
  if (status === "PENDING_REVIEW") return "warning" as const;
  if (status === "REJECTED") return "error" as const;
  return "default" as const;
}

function formatDefaultValue(value: ModuleConfigField["defaultValue"]) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "None";
  }

  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value || "None";
}

function fieldDescription(field: ModuleConfigField) {
  if (field.shortDescription) return field.shortDescription;
  if (field.type === "bool") return "Toggle this module setting on or off.";
  if (field.type === "dropdown") return "Choose one available option.";
  if (field.type === "checkboxes") return "Choose any available options.";
  if (field.type === "integer")
    return "Whole-number value saved for this module.";
  if (field.type === "string")
    return "Free-form text value saved for this module.";
  if (field.type === "group")
    return "Grouped inputs sent together for a module action.";
  if (field.type === "player") return "Searchable Roblox player selector.";
  if (field.type === "server") return "Searchable live server selector.";
  return "Pick a hex color value.";
}

function CheckIcon() {
  return <LucideCheck aria-hidden="true" className="h-4 w-4" />;
}

function XIcon() {
  return <LucideX aria-hidden="true" className="h-4 w-4" />;
}

function historyStatusTone(status: ModuleStatus) {
  if (status === "PUBLISHED") return "text-foreground";
  if (status === "REJECTED" || status === "ARCHIVED") return "text-destructive";
  if (status === "PENDING_REVIEW") return "text-foreground";
  return "text-muted-foreground";
}

function historyStatusIcon(status: ModuleStatus) {
  return status === "PUBLISHED" ? <CheckIcon /> : <XIcon />;
}

export default function ManagementModuleReviewPage() {
  const { confirm, prompt } = useDashboardFeedback();
  const params = useParams();
  const router = useRouter();
  const moduleId = Array.isArray(params.id)
    ? params.id[0]
    : String(params.id || "");
  const [module, setModule] = useState<AddonModule | null>(null);
  const [creatorBlocks, setCreatorBlocks] = useState<CreatorBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useSuccessNotice<string | null>(null);
  const [editingSource, setEditingSource] = useState(false);
  const [editedSourceCode, setEditedSourceCode] = useState("");
  const [codeEditReason, setCodeEditReason] = useState("");

  const history = useMemo(() => module?.creatorHistory || [], [module]);
  const configFields = useMemo(
    () => Object.values(module?.configSchema || {}),
    [module],
  );
  const reviewChecks = useMemo(() => {
    if (!module) return [];

    return runModuleReviewChecks({
      name: module.name,
      slug: module.slug,
      description: module.description,
      version: module.version,
      category: module.category,
      isOfficial: module.isOfficial,
      sourceCode: editingSource ? editedSourceCode : module.sourceCode || "",
      moderationNote: module.moderationNote,
      configSchema: module.configSchema,
    });
  }, [editedSourceCode, editingSource, module]);
  const failedReviewChecks = useMemo(
    () => reviewChecks.filter((check) => check.status === "fail"),
    [reviewChecks],
  );
  const creatorBlocked = useMemo(() => {
    if (!module?.authorDiscordId) return false;
    return creatorBlocks.some(
      (block) => block.active && block.discord_id === module.authorDiscordId,
    );
  }, [creatorBlocks, module?.authorDiscordId]);

  const loadModule = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    setError(null);

    try {
      const [moduleResponse, blocksResponse] = await Promise.all([
        fetch(`/api/management/modules/${moduleId}`, { cache: "no-store" }),
        fetch("/api/management/module-creator-blocks", { cache: "no-store" }),
      ]);
      const modulePayload = await moduleResponse.json().catch(() => ({}));
      if (!moduleResponse.ok) {
        throw new Error(
          String(modulePayload.error || "Failed to load module."),
        );
      }
      setModule(modulePayload as AddonModule);
      setEditedSourceCode(
        String((modulePayload as AddonModule).sourceCode || ""),
      );
      setCodeEditReason("");
      setEditingSource(false);

      const blocksPayload = await blocksResponse.json().catch(() => []);
      if (blocksResponse.ok) {
        setCreatorBlocks(Array.isArray(blocksPayload) ? blocksPayload : []);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load module.",
      );
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    loadModule();
  }, [loadModule]);

  async function getNextPendingModuleId(currentModuleId: string) {
    const response = await fetch("/api/management/modules", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(payload)) {
      return null;
    }

    const pendingModules = (payload as AddonModule[]).filter(
      (addon) => addon.status === "PENDING_REVIEW",
    );
    const currentIndex = pendingModules.findIndex(
      (addon) => addon.id === currentModuleId,
    );
    if (currentIndex >= 0) {
      return pendingModules[currentIndex + 1]?.id || null;
    }

    return (
      pendingModules.find((addon) => addon.id !== currentModuleId)?.id || null
    );
  }

  async function copySource() {
    if (!module) return;
    await navigator.clipboard.writeText(module.sourceCode || "");
    setSuccess(`Copied ${module.name} source code.`);
  }

  function startSourceEdit() {
    if (!module) return;
    setEditedSourceCode(module.sourceCode || "");
    setCodeEditReason("");
    setEditingSource(true);
    setError(null);
    setSuccess(null);
  }

  function cancelSourceEdit() {
    setEditedSourceCode(module?.sourceCode || "");
    setCodeEditReason("");
    setEditingSource(false);
    setError(null);
  }

  async function saveSourceEdit() {
    if (!module) return;

    const nextSourceCode = editedSourceCode.trim();
    const reason = codeEditReason.trim();

    if (!nextSourceCode) {
      setError("Module source code is required.");
      return;
    }

    if (nextSourceCode === (module.sourceCode || "").trim()) {
      setError("Change the source code before saving an edit.");
      return;
    }

    if (!reason) {
      setError("A code edit reason is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/management/modules/${module.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode: nextSourceCode,
          codeEditReason: reason,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "Failed to save source edit."));
      }

      setSuccess("Module source updated. The creator was notified.");
      await loadModule();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save source edit.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewModule(status: "PUBLISHED" | "REJECTED") {
    if (!module) return;
    const moderationNote =
      status === "REJECTED"
        ? await prompt(
            "Reason for denying this module?",
            "Denied by moderation.",
          )
        : "";
    if (moderationNote === null) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const nextPendingModuleId = await getNextPendingModuleId(module.id).catch(
        () => null,
      );
      const response = await fetch(`/api/management/modules/${module.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, moderationNote }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "Failed to review module."));
      }

      if (nextPendingModuleId) {
        router.replace(`/management/modules/${nextPendingModuleId}`);
        return;
      }

      setSuccess(
        status === "PUBLISHED"
          ? "Module accepted and published. No more modules are awaiting moderation."
          : "Module denied. No more modules are awaiting moderation.",
      );
      await loadModule();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Failed to review module.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function blockCreator() {
    if (!module?.authorDiscordId) {
      setError("This module does not have a creator Discord ID.");
      return;
    }

    const reason = await prompt(
      "Reason for blocking this creator from submitting modules?",
      "Repeated module terms violations.",
    );
    if (reason === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/management/module-creator-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: module.authorDiscordId,
          reason,
          active: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "Failed to block creator."));
      }

      setSuccess("Creator blocked from future module submissions.");
      await loadModule();
    } catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Failed to block creator.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteModule() {
    if (
      !module ||
      !(await confirm(
        `Delete ${module.name}? Installed copies will be removed from servers.`,
      ))
    )
      return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/management/modules/${module.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "Failed to delete module."));
      }

      router.push("/management/modules");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete module.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm font-medium text-destructive">
        {error || "Module not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-border pb-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Link
            href="/management/modules"
            className="text-xs font-semibold   text-foreground hover:text-foreground"
          >
            Back to modules
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Status render={<span />} variant={statusClassName(module.status)}>
              {module.status}
            </Status>
            {module.isOfficial && (
              <Status render={<span />} variant="default">
                Official
              </Status>
            )}
            {creatorBlocked && (
              <Status render={<span />} variant="error">
                Creator blocked
              </Status>
            )}
          </div>
          <h1 className="mt-3 text-2xl  tracking-tight text-foreground md:text-2xl flex items-center gap-3 font-semibold">
            <PageIcon name="modules" compact /> {module.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {module.description || "No description provided."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-semibold   text-muted-foreground">
            <span>{module.slug}</span>
            <span>{module.category}</span>
            <span>v{module.version}</span>
            <span>{module.sourceChecksum.slice(0, 12)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={copySource}
            className="border text-xs transition-colors"
          >
            Copy Code
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => reviewModule("PUBLISHED")}
            disabled={saving || module.status === "PUBLISHED"}
            className="border text-xs transition-colors disabled:opacity-50"
          >
            Accept
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => reviewModule("REJECTED")}
            disabled={saving || module.status === "REJECTED"}
            className="border text-xs transition-colors disabled:opacity-50"
          >
            Deny
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={blockCreator}
            disabled={saving || !module.authorDiscordId || creatorBlocked}
            className="border text-xs transition-colors disabled:opacity-50"
          >
            {creatorBlocked ? "Blocked" : "Block Creator"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={deleteModule}
            disabled={saving}
            className="border text-xs transition-colors disabled:opacity-50"
          >
            Delete
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm font-medium text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-border bg-muted px-5 py-4 text-sm font-medium text-foreground">
          {success}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card className="rounded-xl border border-border bg-card">
            <CardHeader className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between p-0 pb-4">
              <CardTitle className="text-sm font-semibold   text-foreground">
                Submitted Source
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {(editingSource
                    ? editedSourceCode
                    : module.sourceCode || ""
                  ).length.toLocaleString()}{" "}
                  chars
                </span>
                {editingSource ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelSourceEdit}
                      disabled={saving}
                      className="border text-xs transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={saveSourceEdit}
                      disabled={
                        saving ||
                        !editedSourceCode.trim() ||
                        !codeEditReason.trim() ||
                        editedSourceCode.trim() ===
                          (module.sourceCode || "").trim()
                      }
                      className="border text-xs transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving" : "Save Code"}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startSourceEdit}
                    disabled={saving}
                    className="border text-xs transition-colors disabled:opacity-50"
                  >
                    Edit Code
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {editingSource ? (
                <div className="space-y-4 p-5">
                  <LuauCodeEditor
                    value={editedSourceCode}
                    onChange={(event) =>
                      setEditedSourceCode(event.target.value)
                    }
                    minHeightClassName="min-h-[60vh]"
                  />
                  <div>
                    <label className="text-xs font-semibold   text-muted-foreground">
                      Edit Justification
                    </label>
                    <Textarea
                      aria-label="Edit Justification"
                      value={codeEditReason}
                      onChange={(event) =>
                        setCodeEditReason(event.target.value)
                      }
                      maxLength={1000}
                      placeholder="Explain why moderation changed this code."
                      className="mt-2 min-h-24 w-full resize-y border p-3 text-sm leading-relaxed transition-colors"
                    />
                  </div>
                </div>
              ) : (
                <LuauCodeBlock
                  code={module.sourceCode || ""}
                  emptyFallback="Source was cleared or is unavailable."
                  className="max-h-[70vh] p-5"
                />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between p-0 pb-4">
              <div>
                <CardTitle className="text-sm font-semibold   text-foreground">
                  Available Configs
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-muted-foreground">
                  Parsed from this submission&apos;s top-level CONFIG block.
                </CardDescription>
              </div>
              <div className="text-xs font-semibold   text-muted-foreground">
                {configFields.length}{" "}
                {configFields.length === 1 ? "field" : "fields"}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {configFields.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <Table aria-label="Module configuration preview">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead>Options</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configFields.map((field) => (
                        <TableRow key={field.key}>
                          <TableCell className="min-w-48">
                            <p className="font-medium">{field.label}</p>
                            <p className="break-all font-mono text-xs text-muted-foreground">
                              {field.key}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {fieldDescription(field)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Status>{field.type}</Status>
                          </TableCell>
                          <TableCell className="max-w-64 break-words">
                            {formatDefaultValue(field.defaultValue)}
                          </TableCell>
                          <TableCell className="min-w-40">
                            {field.options.length
                              ? field.options.join(", ")
                              : "No fixed options"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  This module does not declare configurable fields.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="flex items-end justify-between gap-3 p-0 pb-4">
              <div>
                <CardTitle className="text-sm font-semibold   text-foreground">
                  Automatic Checks
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-muted-foreground">
                  Runs against source, metadata, and config fields.
                </CardDescription>
              </div>
              <div
                className={
                  failedReviewChecks.length > 0
                    ? "text-2xl font-black text-destructive"
                    : "text-2xl font-black text-foreground"
                }
              >
                {failedReviewChecks.length}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="mt-4 space-y-2">
                {reviewChecks.map((check) => (
                  <li
                    key={check.id}
                    className="flex min-w-0 items-start gap-2 text-sm leading-5"
                  >
                    <span
                      className={`mt-0.5 shrink-0 ${check.status === "pass" ? "text-foreground" : "text-destructive"}`}
                    >
                      {check.status === "pass" ? <CheckIcon /> : <XIcon />}
                    </span>
                    <span className="min-w-0 text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {check.title}
                      </span>
                      <span className="text-muted-foreground"> - </span>
                      {check.status === "pass" ? (
                        <span className="text-foreground">Passed</span>
                      ) : (
                        <span className="text-destructive">
                          {check.details.length > 0
                            ? check.details.join("; ")
                            : "Failed without a reported reason."}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-semibold   text-foreground">
                Creator
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold   text-muted-foreground">
                    Discord ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-foreground">
                    {module.authorDiscordId || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold   text-muted-foreground">
                    Submitted
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {formatDate(module.submittedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold   text-muted-foreground">
                    Reviewed
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {formatDate(module.reviewedAt)}
                  </dd>
                </div>
                {module.reviewedByDiscordId && (
                  <div>
                    <dt className="text-xs font-semibold   text-muted-foreground">
                      Reviewed By
                    </dt>
                    <dd className="mt-1 break-all font-mono text-foreground">
                      {module.reviewedByDiscordId}
                    </dd>
                  </div>
                )}
                {module.moderationNote && (
                  <div>
                    <dt className="text-xs font-semibold   text-muted-foreground">
                      Moderation Note
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {module.moderationNote}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card p-5">
            <CardHeader className="flex items-end justify-between gap-3 p-0 pb-4">
              <div>
                <CardTitle className="text-sm font-semibold   text-foreground">
                  Upload History
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-muted-foreground">
                  Past reviewed submissions from this creator.
                </CardDescription>
              </div>
              <div className="text-2xl font-black text-foreground">
                {history.length}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="mt-4 space-y-2">
                {history.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/management/modules/${item.id}`}
                      className="flex min-w-0 items-start gap-2 text-sm leading-5 transition-colors hover:text-foreground"
                    >
                      <span
                        className={`mt-0.5 shrink-0 ${historyStatusTone(item.status)}`}
                      >
                        {historyStatusIcon(item.status)}
                      </span>
                      <span className="min-w-0 text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="text-muted-foreground"> - </span>
                        <span className={historyStatusTone(item.status)}>
                          {item.status.replaceAll("_", " ")}
                        </span>
                        <span className="text-muted-foreground"> - </span>
                        <span>v{item.version}</span>
                        <span className="text-muted-foreground"> - </span>
                        <span>Reviewed {formatDate(item.reviewedAt)}</span>
                        {item.moderationNote && (
                          <>
                            <span className="text-muted-foreground"> - </span>
                            <span>{item.moderationNote}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
                {history.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No past reviewed module uploads were found for this creator.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
