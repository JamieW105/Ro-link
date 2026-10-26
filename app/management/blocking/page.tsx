"use client";
import { LoadingState } from "@/app/management/SiteContentFields";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

import { useEffect, useState } from "react";

interface BlockedServer {
  guild_id: string;
  reason: string;
  blocked_by: string;
  blocked_at: string;
}

export default function BlockServers() {
  const { confirm, notify } = useDashboardFeedback();
  const [blocked, setBlocked] = useState<BlockedServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [idToBlock, setIdToBlock] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch("/api/management/blocking")
      .then((res) => res.json())
      .then((data) => {
        setBlocked(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToBlock || !reason.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/management/blocking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: idToBlock, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        setBlocked((prev) => [data, ...prev]);
        setIdToBlock("");
        setReason("");
        notify("Server blocked and data deleted.");
      } else {
        notify("Failed to block server");
      }
    } catch {
      notify("Error blocking server");
    } finally {
      setProcessing(false);
    }
  };

  const handleUnblock = async (id: string) => {
    if (!(await confirm("Are you sure you want to unblock this server?")))
      return;
    try {
      const res = await fetch(`/api/management/blocking/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBlocked((prev) => prev.filter((b) => b.guild_id !== id));
      }
    } catch {
      notify("Error unblocking server");
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl  text-foreground tracking-tight flex items-center gap-3 font-semibold">
          <PageIcon name="reports" compact /> Blocked Servers
        </h1>
        <p className="text-muted-foreground mt-1">
          Prevent specific servers from using Ro-Link.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <form
            onSubmit={handleBlock}
            className="bg-muted/40 border border-border p-6 rounded-xl space-y-4"
          >
            <h3 className="text-lg font-semibold text-foreground">
              Block New Server
            </h3>
            <div>
              <label className="text-xs font-semibold text-muted-foreground   mb-2 block">
                Server ID
              </label>
              <Input
                aria-label="Server ID"
                type="text"
                className="w-full border text-sm"
                placeholder="Enter Discord Guild ID..."
                value={idToBlock}
                onChange={(e) => setIdToBlock(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground   mb-2 block">
                Reason
              </label>
              <Textarea
                aria-label="Reason"
                className="w-full border p-3 text-sm h-24 resize-none"
                placeholder="Reason for blocking..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            <Button
              variant="default"
              type="submit"
              disabled={processing || !idToBlock || !reason.trim()}
              className="w-full disabled:opacity-50 transition-all "
            >
              {processing ? "Blocking..." : "Block Server"}
            </Button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden rounded-xl border border-border bg-card">
            <CardContent className="p-0">
              <div className="table-responsive">
                <Table className="w-full min-w-[640px] text-left text-sm">
                  <TableHeader className="bg-muted/40 text-muted-foreground font-medium  text-[10px]  border-b border-border">
                    <TableRow>
                      <TableHead className="px-6 py-4">Guild ID</TableHead>
                      <TableHead className="px-6 py-4">Reason</TableHead>
                      <TableHead className="px-6 py-4">Blocked At</TableHead>
                      <TableHead className="px-6 py-4 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {blocked.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="px-6 py-10 text-center text-muted-foreground"
                        >
                          No blocked servers found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      blocked.map((b) => (
                        <TableRow
                          key={b.guild_id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="px-6 py-4 font-mono text-xs text-foreground">
                            {b.guild_id}
                          </TableCell>
                          <TableCell
                            className="px-6 py-4 text-muted-foreground max-w-xs truncate"
                            title={b.reason}
                          >
                            {b.reason}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-muted-foreground">
                            {new Date(b.blocked_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleUnblock(b.guild_id)}
                              className="text-xs"
                            >
                              Unblock
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
