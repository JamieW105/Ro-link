"use client";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Status } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import { useSuccessNotice } from "@/hooks/use-success-notice";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  sourceCode: string;
  sourceChecksum: string;
  configSchema?: Record<string, ModuleConfigField>;
  authorDiscordId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  moderationNote: string;
  updatedAt: string | null;
  publishedAt: string | null;
}

interface CreatorBlock {
  discord_id: string;
  reason: string;
  active: boolean;
}

interface PendingModuleCardProps {
  addon: AddonModule;
  saving: boolean;
  activeBlockIds: Set<string>;
  onBlockCreator: (addon: AddonModule) => void;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function configSummary(addon: AddonModule) {
  return Object.values(addon.configSchema || {});
}

function PendingModuleCard({
  addon,
  saving,
  activeBlockIds,
  onBlockCreator,
}: PendingModuleCardProps) {
  const configs = configSummary(addon);

  return (
    <Card className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Status render={<span />} variant="default">
              Awaiting moderation
            </Status>
            {addon.authorDiscordId && (
              <Status render={<span />} variant="error">
                Creator {addon.authorDiscordId}
              </Status>
            )}
            {addon.isOfficial && (
              <Status render={<span />} variant="default">
                Offical
              </Status>
            )}
          </div>
          <h3 className="mt-3 text-base font-semibold text-foreground">
            {addon.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {addon.description || "No description provided."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold   text-muted-foreground">
            <span>{addon.slug}</span>
            <span>{addon.category}</span>
            <span>Submitted {formatDate(addon.submittedAt)}</span>
            <span>{addon.sourceChecksum.slice(0, 12)}</span>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-muted p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[10px] font-semibold   text-muted-foreground">
                Available configs
              </span>
              <span className="text-[10px] font-semibold   text-muted-foreground">
                {configs.length} {configs.length === 1 ? "field" : "fields"}
              </span>
            </div>
            {configs.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <Table aria-label="Pending module configuration preview">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((field) => (
                      <TableRow key={field.key}>
                        <TableCell>{field.label}</TableCell>
                        <TableCell>
                          <Status>{field.type}</Status>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                This submission does not declare configurable fields.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild variant="default">
            <Link href={`/management/modules/${addon.id}`}>Review Module</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onBlockCreator(addon)}
            disabled={
              saving ||
              !addon.authorDiscordId ||
              activeBlockIds.has(addon.authorDiscordId)
            }
            className="border text-xs transition-colors disabled:opacity-50"
          >
            {addon.authorDiscordId && activeBlockIds.has(addon.authorDiscordId)
              ? "Blocked"
              : "Block Creator"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function ManagementModulesPage() {
  const { confirm, prompt } = useDashboardFeedback();
  const [modules, setModules] = useState<AddonModule[]>([]);
  const [creatorBlocks, setCreatorBlocks] = useState<CreatorBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useSuccessNotice<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules;

    return modules.filter(
      (addon) =>
        addon.name.toLowerCase().includes(query) ||
        addon.slug.toLowerCase().includes(query) ||
        addon.category.toLowerCase().includes(query),
    );
  }, [modules, search]);

  const pendingModules = useMemo(
    () => modules.filter((addon) => addon.status === "PENDING_REVIEW"),
    [modules],
  );

  const activeBlockIds = useMemo(
    () =>
      new Set(
        creatorBlocks
          .filter((block) => block.active)
          .map((block) => block.discord_id),
      ),
    [creatorBlocks],
  );

  async function loadModules() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/management/modules", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "Failed to load modules."));
      }
      setModules(Array.isArray(payload) ? payload : []);
      const blocksResponse = await fetch(
        "/api/management/module-creator-blocks",
        { cache: "no-store" },
      );
      const blocksPayload = await blocksResponse.json().catch(() => []);
      if (blocksResponse.ok) {
        setCreatorBlocks(Array.isArray(blocksPayload) ? blocksPayload : []);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load modules.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadModules();
  }, []);

  async function deleteModule(addon: AddonModule) {
    if (
      !(await confirm(
        `Delete ${addon.name}? Installed copies will be removed from servers.`,
      ))
    )
      return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/management/modules/${addon.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "Failed to delete module."));
      }

      setSuccess("Module deleted.");
      await loadModules();
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

  async function copySource(addon: AddonModule) {
    await navigator.clipboard.writeText(addon.sourceCode || "");
    setSuccess(`Copied ${addon.name} source code.`);
  }

  async function blockCreator(addon: AddonModule) {
    if (!addon.authorDiscordId) {
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
          discordId: addon.authorDiscordId,
          reason,
          active: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "Failed to block creator."));
      }

      setSuccess("Creator blocked from future module submissions.");
      await loadModules();
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

  function statusClassName(status: ModuleStatus) {
    if (status === "PUBLISHED") return "success" as const;
    if (status === "PENDING_REVIEW") return "warning" as const;
    if (status === "REJECTED") return "error" as const;
    return "default" as const;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl  tracking-tight text-foreground flex items-center gap-3 font-semibold">
              <PageIcon name="modules" compact /> Module Marketplace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create and publish add-ons stored by Ro-Link for Roblox runtimes.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
            <Input
              aria-label="Search modules..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search modules..."
              className="w-full border text-sm transition-colors md:w-72"
            />
            <Button asChild variant="default">
              <Link href="/dashboard/marketplace/create">Create Module</Link>
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

        {pendingModules.length > 0 && (
          <div className="rounded-xl border border-border bg-muted p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Awaiting Moderation
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open a submitted module to inspect source, review creator
                  history, then accept or deny it.
                </p>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pendingModules.length}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {pendingModules.map((addon) => (
                <PendingModuleCard
                  key={addon.id}
                  addon={addon}
                  saving={saving}
                  activeBlockIds={activeBlockIds}
                  onBlockCreator={blockCreator}
                />
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
          </div>
        ) : (
          <Card className="overflow-hidden rounded-xl border border-border bg-card">
            <CardContent className="p-0">
              <div className="table-responsive">
                <Table className="w-full min-w-[780px] text-left text-sm">
                  <TableHeader className="border-b border-border bg-muted/40 text-[10px] font-semibold   text-muted-foreground">
                    <TableRow>
                      <TableHead className="px-6 py-4">Module</TableHead>
                      <TableHead className="px-6 py-4">Status</TableHead>
                      <TableHead className="px-6 py-4">Version</TableHead>
                      <TableHead className="px-6 py-4">Updated</TableHead>
                      <TableHead className="px-6 py-4 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {filteredModules.map((addon) => (
                      <TableRow
                        key={addon.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="px-6 py-4">
                          <div className="font-semibold text-foreground">
                            {addon.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold   text-muted-foreground">
                            <span>{addon.slug}</span>
                            <span>{addon.category}</span>
                            {addon.isOfficial && <span>Offical</span>}
                            <span>
                              {Object.keys(addon.configSchema || {}).length}{" "}
                              config fields
                            </span>
                            <span>{addon.sourceChecksum.slice(0, 12)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Status
                            render={<span />}
                            variant={statusClassName(addon.status)}
                          >
                            {addon.status}
                          </Status>
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          v{addon.version}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-xs text-muted-foreground">
                          {formatDate(addon.updatedAt)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => copySource(addon)}
                              className="border text-xs transition-colors"
                            >
                              Copy
                            </Button>
                            <Button asChild variant="default">
                              <Link href={`/management/modules/${addon.id}`}>
                                Open
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => deleteModule(addon)}
                              disabled={saving}
                              className="border text-xs transition-colors disabled:opacity-50"
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredModules.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="px-6 py-12 text-center text-muted-foreground"
                        >
                          No modules found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
