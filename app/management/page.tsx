"use client";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";

import {
  Stat,
  StatLabel,
  StatValue,
  StatIndicator,
} from "@/components/ui/stat";
import { useEffect, useState } from "react";
import {
  Ban,
  BriefcaseBusiness,
  ClipboardList,
  Server,
  type LucideIcon,
} from "lucide-react";

export default function ManagementOverview() {
  const [stats, setStats] = useState({
    totalServers: 0,
    activeApplications: 0,
    totalSubmissions: 0,
    blockedServers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/management/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <h1 className="text-2xl  tracking-tight text-foreground md:text-2xl flex items-center gap-3 font-semibold">
          <PageIcon name="overview" compact /> Management Overview
        </h1>
        <p className="text-muted-foreground mt-1">
          Global statistics and status for Ro-Link.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(
          [
            {
              label: "Total Servers",
              value: stats.totalServers,
              color: "text-foreground",
              icon: Server,
            },
            {
              label: "Active Jobs",
              value: stats.activeApplications,
              color: "text-foreground",
              icon: BriefcaseBusiness,
            },
            {
              label: "Job Submissions",
              value: stats.totalSubmissions,
              color: "text-foreground",
              icon: ClipboardList,
            },
            {
              label: "Blocked Servers",
              value: stats.blockedServers,
              color: "text-destructive",
              icon: Ban,
            },
          ] satisfies Array<{
            label: string;
            value: number;
            color: string;
            icon: LucideIcon;
          }>
        ).map((stat) => {
          const Icon = stat.icon;
          return (
            <Stat key={stat.label}>
              <StatLabel>{stat.label}</StatLabel>
              <StatValue>{stat.value}</StatValue>
              <StatIndicator>
                <Icon className="size-4" aria-hidden="true" />
              </StatIndicator>
            </Stat>
          );
        })}
      </div>

      <Card className="rounded-xl border border-border bg-card p-6 md:p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="mb-4 text-lg font-semibold text-foreground md:text-xl">
            Developer Note
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <p className="text-muted-foreground leading-relaxed">
            This dashboard is restricted to authorized personnel. You can manage
            servers, block abusive communities, and handle job applications for
            the Ro-Link team. Be careful with deletions as they are permanent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
