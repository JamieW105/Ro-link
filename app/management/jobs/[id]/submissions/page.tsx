"use client";
import { LoadingState } from "@/app/management/SiteContentFields";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import {
  ArrowLeft as LucideArrowLeft,
  FileText as LucideFileText,
} from "lucide-react";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface Submission {
  id: string;
  discord_id: string;
  answers: Record<string, any>;
  status: "PENDING" | "ACCEPTED" | "DENIED";
  review_reason?: string;
  submitted_at: string;
}

interface Question {
  id: string;
  label: string;
  type: string;
}

export default function JobSubmissions({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const { notify } = useDashboardFeedback();
  const params = use(paramsPromise);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/management/jobs/${params.id}/submissions`).then((res) =>
        res.json(),
      ),
      fetch(`/api/management/jobs/${params.id}/details`).then((res) =>
        res.json(),
      ),
    ])
      .then(([subs, job]) => {
        setSubmissions(subs || []);
        setQuestions(job?.questions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const handleReview = async (status: "ACCEPTED" | "DENIED") => {
    if (!selected || !reason.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/management/jobs/${params.id}/submissions/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: selected.id, status, reason }),
        },
      );
      if (res.ok) {
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === selected.id ? { ...s, status, review_reason: reason } : s,
          ),
        );
        setSelected(null);
        setReason("");
      }
    } catch {
      notify("Error reviewing application");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/management/jobs"
          className="text-muted-foreground hover:text-foreground text-sm font-medium flex items-center gap-2 mb-4 transition-colors"
        >
          <LucideArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>
        <h1 className="text-2xl  text-foreground tracking-tight flex items-center gap-3 font-semibold">
          <PageIcon name="creator" compact /> Review Submissions
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground   px-2">
            Submissions ({submissions.length})
          </h3>
          <div className="space-y-2">
            {submissions.length === 0 ? (
              <Card className="p-6 text-center bg-card border border-border rounded-xl text-muted-foreground text-sm">
                <CardContent className="p-0">No submissions yet.</CardContent>
              </Card>
            ) : (
              submissions.map((sub) => (
                <Button
                  type="button"
                  variant={selected?.id === sub.id ? "secondary" : "outline"}
                  aria-pressed={selected?.id === sub.id}
                  key={sub.id}
                  onClick={() => setSelected(sub)}
                  className="h-auto w-full flex-col items-stretch whitespace-normal py-4 text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground text-sm">
                      {sub.discord_id}
                    </span>
                    <Status
                      render={<span />}
                      variant={
                        sub.status === "ACCEPTED"
                          ? "success"
                          : sub.status === "DENIED"
                            ? "error"
                            : "warning"
                      }
                    >
                      {sub.status}
                    </Status>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(sub.submitted_at).toLocaleString()}
                  </span>
                </Button>
              ))
            )}
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card className="bg-card border border-border rounded-xl p-6 space-y-8">
              <CardHeader className="flex items-center justify-between border-b border-border pb-6 p-0 pb-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground mb-1">
                    {selected.discord_id}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Submitted on{" "}
                    {new Date(selected.submitted_at).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Status render={<span />} variant="error">
                    {selected.status}
                  </Status>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-8">
                  {questions.map((q) =>
                    q.type === "section" ? (
                      <h3
                        key={q.id}
                        className="text-lg font-semibold text-foreground pt-4 border-t border-border"
                      >
                        {q.label}
                      </h3>
                    ) : (
                      <div key={q.id}>
                        <h4 className="text-xs font-semibold text-muted-foreground   mb-2">
                          {q.label}
                        </h4>
                        <p className="text-foreground bg-background border border-border p-4 rounded-xl whitespace-pre-wrap">
                          {String(
                            selected.answers[q.id] || "No answer provided.",
                          )}
                        </p>
                      </div>
                    ),
                  )}
                </div>

                {selected.status === "PENDING" ? (
                  <div className="pt-8 border-t border-border space-y-6">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground   mb-2 block">
                        Review Feedback (Sent via DM)
                      </label>
                      <Textarea
                        aria-label="Review Feedback (Sent via DM)"
                        className="w-full border p-4 text-sm h-32 resize-none"
                        placeholder="Provide a reason for acceptance or denial..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleReview("DENIED")}
                        disabled={processing || !reason.trim()}
                        className="flex-1 border transition-all disabled:opacity-50"
                      >
                        Deny Application
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleReview("ACCEPTED")}
                        disabled={processing || !reason.trim()}
                        className="flex-1 border transition-all disabled:opacity-50"
                      >
                        Accept Application
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-8 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground   mb-2">
                      Previous Feedback
                    </h4>
                    <p className="text-muted-foreground italic font-medium">
                      {selected.review_reason || "No feedback provided."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col items-center justify-center text-muted-foreground py-32 bg-card border border-dashed border-border rounded-xl">
              <CardContent className="p-0">
                <LucideFileText className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a submission to review details.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
