"use client";
import { Stat, StatLabel, StatValue } from "@/components/ui/stat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import {
  ExternalLink as LucideExternalLink,
  LogOut as LucideLogOut,
  Trash2 as LucideTrash2,
} from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDiscordGuildIconProxyUrl } from "@/lib/discordMedia";

interface Server {
  id: string;
  name: string;
  icon: string;
  owner_id: string;
  created_at: string;
  is_setup: boolean;
  bot_present?: boolean;
}

interface CustomDashboard {
  id: string;
  server_id: string;
  subdomain: string;
  hostname: string;
  hostnames?: string[];
  created_at: string;
}

interface RuleIssue {
  rule: string;
  severity: "low" | "medium" | "high";
  location: "server_name" | "message";
  evidence: string;
  translatedEvidence?: string;
  channelName?: string;
  messageUrl?: string;
  authorId?: string;
  messageCreatedAt?: string;
}

interface ServerRuleCheck {
  id: string;
  name: string;
  status: "clear" | "flagged" | "limited" | "error";
  checkedMessages: number;
  translatedMessages: number;
  issues: RuleIssue[];
  errors: string[];
}

interface RuleCheckSummary {
  checkedAt: string;
  scannedServers: number;
  flaggedServers: number;
  checkedMessages: number;
  translatedMessages: number;
  translationProvider: string;
  capped?: boolean;
  maxServers?: number;
  results: ServerRuleCheck[];
}

export default function ManageServers() {
  const { notify } = useDashboardFeedback();
  const [servers, setServers] = useState<Server[]>([]);
  const [customDashboards, setCustomDashboards] = useState<CustomDashboard[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [removeModal, setRemoveModal] = useState<Server | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [dashboardServerId, setDashboardServerId] = useState("");
  const [dashboardSubdomain, setDashboardSubdomain] = useState("");
  const [dashboardNotice, setDashboardNotice] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const [ruleCheck, setRuleCheck] = useState<RuleCheckSummary | null>(null);
  const [checkingRules, setCheckingRules] = useState(false);
  const [ruleCheckError, setRuleCheckError] = useState("");
  const [currentRuleCheckServer, setCurrentRuleCheckServer] = useState<{
    id: string;
    name: string;
    index: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/management/servers").then((res) => res.json()),
      fetch("/api/management/custom-dashboards").then((res) => res.json()),
    ])
      .then(([serverData, dashboardData]) => {
        const nextServers = Array.isArray(serverData) ? serverData : [];
        setServers(nextServers);
        setCustomDashboards(Array.isArray(dashboardData) ? dashboardData : []);
        setDashboardServerId(
          nextServers.find((server) => server.is_setup)?.id || "",
        );
        setLoading(false);
      })
      .catch(() => {
        setServers([]);
        setCustomDashboards([]);
        setLoading(false);
      });
  }, []);

  const handleRemove = async () => {
    if (!removeModal || !reason.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/management/servers/${removeModal.id}/leave`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (res.ok) {
        setServers((prev) => prev.filter((s) => s.id !== removeModal.id));
        setRemoveModal(null);
        setReason("");
      } else {
        notify("Failed to remove bot");
      }
    } catch {
      notify("Error removing bot");
    } finally {
      setProcessing(false);
    }
  };

  const handleJoin = async (id: string) => {
    try {
      const res = await fetch(`/api/management/servers/${id}/invite`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } catch {
      notify("Error getting invite");
    }
  };

  const handleCreateDashboard = async () => {
    if (!dashboardServerId || !dashboardSubdomain.trim()) return;

    setCreatingDashboard(true);
    setDashboardNotice("");
    setDashboardError("");

    try {
      const res = await fetch("/api/management/custom-dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: dashboardServerId,
          subdomain: dashboardSubdomain,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDashboardError(data.error || "Failed to create test dashboard.");
        return;
      }

      setCustomDashboards((prev) => [data, ...prev]);
      setDashboardSubdomain("");
      setDashboardNotice(`Created ${data.hostname}`);
    } catch {
      setDashboardError("Error creating test dashboard.");
    } finally {
      setCreatingDashboard(false);
    }
  };

  const handleRuleCheck = async () => {
    setCheckingRules(true);
    setRuleCheckError("");

    try {
      const guildIds = servers
        .filter((server) => server.bot_present !== false)
        .map((server) => ({ id: server.id, name: server.name || server.id }));

      if (guildIds.length === 0) {
        setRuleCheckError(
          "No servers with the bot present are available to scan.",
        );
        return;
      }

      setRuleCheck({
        checkedAt: new Date().toISOString(),
        scannedServers: 0,
        flaggedServers: 0,
        checkedMessages: 0,
        translatedMessages: 0,
        translationProvider: "",
        capped: false,
        maxServers: guildIds.length,
        results: [],
      });

      for (const [index, guild] of guildIds.entries()) {
        setCurrentRuleCheckServer({
          id: guild.id,
          name: guild.name,
          index: index + 1,
          total: guildIds.length,
        });

        const res = await fetch("/api/management/servers/rule-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guildIds: [guild.id] }),
        });
        const data = await res.json();

        if (!res.ok) {
          setRuleCheckError(data.error || `Failed to scan ${guild.name}.`);
          return;
        }

        const result = Array.isArray(data.results) ? data.results[0] : null;
        if (!result) {
          setRuleCheckError(`No scan result was returned for ${guild.name}.`);
          return;
        }

        setRuleCheck((previous) => {
          const previousResults = previous?.results || [];
          const results = [
            ...previousResults.filter((item) => item.id !== result.id),
            result,
          ];

          return {
            checkedAt:
              data.checkedAt || previous?.checkedAt || new Date().toISOString(),
            scannedServers: results.length,
            flaggedServers: results.filter((item) => item.issues.length > 0)
              .length,
            checkedMessages: results.reduce(
              (sum, item) => sum + item.checkedMessages,
              0,
            ),
            translatedMessages: results.reduce(
              (sum, item) => sum + item.translatedMessages,
              0,
            ),
            translationProvider:
              data.translationProvider || previous?.translationProvider || "",
            capped: false,
            maxServers: guildIds.length,
            results,
          };
        });
      }
    } catch {
      setRuleCheckError("Error running server rule check.");
    } finally {
      setCheckingRules(false);
      setCurrentRuleCheckServer(null);
    }
  };

  const filtered = Array.isArray(servers)
    ? servers.filter((s) => {
        const name = (s.name || "").toLowerCase();
        const id = s.id || "";
        const query = (search || "").toLowerCase();
        return name.includes(query) || id.includes(search);
      })
    : [];
  const setupServers = servers.filter((server) => server.is_setup);
  const serverNames = new Map(
    servers.map((server) => [server.id, server.name || server.id]),
  );
  const ruleCheckByServer = new Map(
    (ruleCheck?.results || []).map((result) => [result.id, result]),
  );
  const flaggedResults = (ruleCheck?.results || []).filter(
    (result) => result.issues.length > 0,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl  text-foreground tracking-tight flex items-center gap-3 font-semibold">
            <PageIcon name="overview" compact /> Manage Servers
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all servers using Ro-Link.
          </p>
        </div>
        <div className="relative">
          <Input
            aria-label="Search by name or ID..."
            type="text"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border text-sm w-full md:w-64"
          />
        </div>
      </header>

      <Card className="rounded-xl border border-border bg-card p-5">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between p-0 pb-4">
          <div className="max-w-2xl">
            <CardTitle className="text-sm font-semibold   text-foreground">
              Test Custom Dashboards
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-muted-foreground">
              Create internal test mappings for wildcard dashboard URLs. The
              same subdomain works across the configured production and testing
              root domains.
            </CardDescription>
          </div>
          <div className="grid w-full gap-3 lg:w-auto lg:grid-cols-[minmax(220px,280px)_minmax(180px,220px)_auto]">
            <Select
              aria-label="Setup server"
              value={dashboardServerId}
              onValueChange={setDashboardServerId}
              options={[
                { value: "", label: "Select setup server..." },
                ...setupServers.map((server) => ({
                  value: server.id,
                  label: server.name || server.id,
                })),
              ]}
            />
            <div className="flex rounded-xl border border-border bg-background focus-within:border-border">
              <Input
                aria-label="subdomain"
                type="text"
                placeholder="subdomain"
                value={dashboardSubdomain}
                onChange={(e) => setDashboardSubdomain(e.target.value)}
                className="min-w-0 flex-1 text-sm"
              />
              <span className="hidden items-center border-l border-border px-3 font-mono text-xs text-muted-foreground sm:flex">
                subdomain only
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleCreateDashboard}
              disabled={
                creatingDashboard ||
                !dashboardServerId ||
                !dashboardSubdomain.trim()
              }
              className="text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingDashboard ? "Creating..." : "Create Test"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(dashboardNotice || dashboardError) && (
            <p
              className={`mt-4 text-sm font-medium ${dashboardError ? "text-destructive" : "text-foreground"}`}
            >
              {dashboardError || dashboardNotice}
            </p>
          )}

          {customDashboards.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-border">
              <Table className="w-full min-w-[640px] text-left text-sm">
                <TableHeader className="bg-muted/40 text-[10px] font-medium   text-muted-foreground">
                  <TableRow>
                    <TableHead className="px-4 py-3">Domain</TableHead>
                    <TableHead className="px-4 py-3">Server</TableHead>
                    <TableHead className="px-4 py-3">Created</TableHead>
                    <TableHead className="px-4 py-3 text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {customDashboards.map((dashboard) => (
                    <TableRow key={dashboard.id}>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {(dashboard.hostnames?.length
                            ? dashboard.hostnames
                            : [dashboard.hostname]
                          ).map((hostname) => (
                            <span
                              key={hostname}
                              className="font-mono text-foreground"
                            >
                              {hostname}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-foreground">
                        {serverNames.get(dashboard.server_id) ||
                          dashboard.server_id}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {new Date(dashboard.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <a
                          href={`https://${dashboard.hostname}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold   text-foreground hover:text-foreground"
                        >
                          Open
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card p-5">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between p-0 pb-4">
          <div className="max-w-2xl">
            <CardTitle className="text-sm font-semibold   text-foreground">
              Server Rule Check
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-muted-foreground">
              Scans the 30 most recent messages from each readable channel for
              common scam, raid, adult content, and exploit indicators. Likely
              non-English messages are translated to English before matching.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRuleCheck}
            disabled={checkingRules || loading || servers.length === 0}
            className="text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkingRules ? "Checking..." : "Run Rule Check"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {ruleCheckError && (
            <p className="mt-4 text-sm font-medium text-destructive">
              {ruleCheckError}
            </p>
          )}

          {checkingRules && currentRuleCheckServer && (
            <div className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Scanning {currentRuleCheckServer.name} (
              {currentRuleCheckServer.index} of {currentRuleCheckServer.total})
            </div>
          )}

          {ruleCheck && (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Servers scanned", value: ruleCheck.scannedServers },
                  { label: "Flagged", value: ruleCheck.flaggedServers },
                  { label: "Messages", value: ruleCheck.checkedMessages },
                  { label: "Translated", value: ruleCheck.translatedMessages },
                ].map((stat) => (
                  <Stat key={stat.label}>
                    <StatLabel>{stat.label}</StatLabel>
                    <StatValue>{stat.value}</StatValue>
                  </Stat>
                ))}
              </div>

              <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Checked {new Date(ruleCheck.checkedAt).toLocaleString()}
                  {ruleCheck.translationProvider
                    ? ` using ${ruleCheck.translationProvider}.`
                    : "."}
                </span>
                <span>
                  Review evidence before removing or blocking a server.
                </span>
              </div>

              {ruleCheck.capped && (
                <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
                  Scan capped at {ruleCheck.maxServers} servers to avoid Discord
                  and translation rate limits.
                </p>
              )}

              {flaggedResults.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm font-medium text-foreground">
                  No obvious rule violations found in the sampled messages.
                </div>
              ) : (
                <div className="space-y-3">
                  {flaggedResults.map((result) => (
                    <div
                      key={result.id}
                      className="rounded-xl border border-destructive/25 bg-destructive/10 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {result.name}
                          </h3>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {result.id}
                          </p>
                        </div>
                        <Status render={<span />} variant="error">
                          {result.issues.length} issue
                          {result.issues.length === 1 ? "" : "s"}
                        </Status>
                      </div>
                      <div className="mt-4 space-y-3">
                        {result.issues.map((issue, index) => (
                          <div
                            key={`${issue.rule}-${index}`}
                            className="rounded-lg border border-border bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Status
                                render={<span />}
                                variant={getSeverityClass(issue.severity)}
                              >
                                {issue.severity}
                              </Status>
                              <span className="text-xs font-semibold text-foreground">
                                {issue.rule}
                              </span>
                              <span className="text-[10px]   text-muted-foreground">
                                {formatIssueLocation(issue)}
                              </span>
                            </div>
                            <p className="mt-2 break-words text-sm text-foreground">
                              {issue.evidence}
                            </p>
                            {issue.translatedEvidence && (
                              <p className="mt-2 break-words border-l-2 border-indigo-400/40 pl-3 text-sm text-muted-foreground">
                                English: {issue.translatedEvidence}
                              </p>
                            )}
                            {issue.messageUrl && (
                              <a
                                href={issue.messageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-xs font-semibold   text-foreground hover:text-foreground"
                              >
                                Open Message
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-xl border border-border bg-card">
          <CardContent className="p-0">
            <div className="table-responsive">
              <Table className="w-full min-w-[860px] text-left text-sm">
                <TableHeader className="bg-muted/40 text-muted-foreground font-medium  text-[10px]  border-b border-border">
                  <TableRow>
                    <TableHead className="px-6 py-4">Server</TableHead>
                    <TableHead className="px-6 py-4">Status</TableHead>
                    <TableHead className="px-6 py-4">Rule Check</TableHead>
                    <TableHead className="px-6 py-4">ID</TableHead>
                    <TableHead className="px-6 py-4">Added At</TableHead>
                    <TableHead className="px-6 py-4 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filtered.map((server) => {
                    const serverCheck = ruleCheckByServer.get(server.id);

                    return (
                      <TableRow
                        key={server.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {server.icon ? (
                              <img
                                src={getDiscordGuildIconProxyUrl(
                                  server.id,
                                  server.icon,
                                )}
                                className="w-8 h-8 rounded-lg"
                                alt=""
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center text-foreground font-semibold">
                                {(server.name || "?")[0]}
                              </div>
                            )}
                            <span className="font-semibold text-foreground">
                              {server.name || "Unknown Server"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <Status
                              variant={
                                server.bot_present !== false
                                  ? "success"
                                  : "error"
                              }
                            >
                              {server.bot_present !== false
                                ? "Bot Present"
                                : "Bot Left"}
                            </Status>
                            {server.is_setup ? (
                              <Status render={<span />} variant="default">
                                Set Up
                              </Status>
                            ) : (
                              <Status render={<span />} variant="default">
                                Pending Setup
                              </Status>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          {checkingRules &&
                          currentRuleCheckServer?.id === server.id ? (
                            <div className="flex flex-col gap-1">
                              <Status render={<span />} variant="default">
                                Scanning
                              </Status>
                              <span className="text-[10px] text-muted-foreground">
                                {currentRuleCheckServer.index} of{" "}
                                {currentRuleCheckServer.total}
                              </span>
                            </div>
                          ) : serverCheck ? (
                            <div className="flex flex-col gap-1">
                              <Status
                                render={<span />}
                                variant={getRuleCheckStatusClass(
                                  serverCheck.status,
                                )}
                              >
                                {serverCheck.status}
                              </Status>
                              <span className="text-[10px] text-muted-foreground">
                                {serverCheck.issues.length} issue
                                {serverCheck.issues.length === 1
                                  ? ""
                                  : "s"} / {serverCheck.checkedMessages}{" "}
                                messages
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold   text-muted-foreground">
                              Not Checked
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground font-mono text-[11px]">
                          {server.id}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                          {new Date(server.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {server.is_setup && (
                              <Button asChild variant="default">
                                <Link
                                  href={`/dashboard/${server.id}`}

                                  title="Open Dashboard"
                                >
                                  <LucideExternalLink className="w-4 h-4" />
                                </Link>
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleJoin(server.id)}
                              className="transition-all"
                              title="Join Server"
                            >
                              <LucideLogOut className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setRemoveModal(server)}
                              className="transition-all"
                              title="Remove Ro-Link"
                            >
                              <LucideTrash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(removeModal)}
        onOpenChange={(open) => {
          if (!open && !processing) setRemoveModal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Ro-Link</DialogTitle>
            <DialogDescription>
              You are about to remove the bot from{" "}
              <span className="text-foreground font-semibold">
                {removeModal?.name}
              </span>
              . The owner will be notified with the reason below.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="w-full border p-3 text-sm h-32 resize-none mb-4"
            aria-label="Reason for removal"
            placeholder="Enter reason for removal..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveModal(null)}
              className=""
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              className="transition-all disabled:opacity-50"
              disabled={processing || !reason.trim()}
            >
              {processing ? "Processing..." : "Confirm Removal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getSeverityClass(severity: RuleIssue["severity"]) {
  if (severity === "high") return "error" as const;
  if (severity === "medium") return "warning" as const;
  return "info" as const;
}

function getRuleCheckStatusClass(status: ServerRuleCheck["status"]) {
  if (status === "flagged") return "error" as const;
  if (status === "limited") return "warning" as const;
  if (status === "error") return "error" as const;
  return "success" as const;
}

function formatIssueLocation(issue: RuleIssue) {
  if (issue.location === "server_name") return "Server name";
  return issue.channelName ? `#${issue.channelName}` : "Message";
}
