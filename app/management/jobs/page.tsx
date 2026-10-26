"use client";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import {
  Pencil as LucidePencil,
  Plus as LucidePlus,
  Trash2 as LucideTrash2,
} from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";

interface JobApplication {
  id: string;
  title: string;
  description: string;
  requirements: string;
  tags: string[];
  status: "OPEN" | "CLOSED";
  created_at: string;
  _count?: {
    submissions: number;
  };
}

export default function ManageJobs() {
  const { confirm, notify } = useDashboardFeedback();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/management/jobs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setJobs(data);
        } else {
          setJobs([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setJobs([]);
        setLoading(false);
      });
  }, []);

  const toggleStatus = async (job: JobApplication) => {
    const newStatus = job.status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      const res = await fetch(`/api/management/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j)),
        );
      }
    } catch {
      notify("Error updating status");
    }
  };

  const deleteJob = async (id: string) => {
    if (
      !(await confirm(
        "Are you sure? This will delete all submissions as well.",
      ))
    )
      return;
    try {
      const res = await fetch(`/api/management/jobs/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== id));
      }
    } catch {
      notify("Error deleting job");
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl  text-foreground tracking-tight flex items-center gap-3 font-semibold">
            <PageIcon name="creator" compact /> Job Applications
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage recruitment for Ro-Link.
          </p>
        </div>
        <Button asChild variant="default">
          <Link href="/management/jobs/new">
            <LucidePlus className="w-4 h-4" />
            New Application
          </Link>
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {jobs.length === 0 ? (
            <Card className="col-span-full py-20 bg-card border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground">
              <CardContent className="p-0">
                <p>No job applications created yet.</p>
                <Link
                  href="/management/jobs/new"
                  className="text-foreground font-semibold mt-2 hover:underline"
                >
                  Create your first one
                </Link>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="bg-muted/40 border border-border rounded-xl p-6 flex flex-col group hover:border-border transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <Status render={<span />} variant="default">
                    {job.status}
                  </Status>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button asChild variant="outline">
                      <Link href={`/management/jobs/${job.id}/edit`}>
                        <LucidePencil className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button
                      aria-label="Remove item"
                      variant="outline"
                      type="button"
                      onClick={() => deleteJob(job.id)}
                      className="transition-colors"
                    >
                      <LucideTrash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-2 line-clamp-1">
                  {job.title}
                </h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-1">
                  {job.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {(job.tags || []).map((tag) => (
                    <Status render={<span />} variant="default" key={tag}>
                      {tag}
                    </Status>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-border mt-auto">
                  <Link
                    href={`/management/jobs/${job.id}/submissions`}
                    className="text-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1"
                  >
                    View Submissions
                    <Status render={<span />} variant="default">
                      {job._count?.submissions || 0}
                    </Status>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleStatus(job)}
                    className={`text-xs font-semibold ${job.status === "OPEN" ? "text-foreground hover:text-foreground" : "text-foreground hover:text-foreground"}`}
                  >
                    {job.status === "OPEN" ? "Close App" : "Open App"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
