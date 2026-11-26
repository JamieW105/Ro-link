"use client";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import { ArrowLeft, Info, X, FileText } from "lucide-react";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  type:
    "short_answer" | "long_answer" | "multi_choice" | "checkbox" | "section";
  label: string;
  description?: string;
  required: boolean;
  options?: string[]; // for multi_choice
}

export default function EditJobApplication({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const { notify } = useDashboardFeedback();
  const params = use(paramsPromise);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch(`/api/management/jobs/${params.id}/details`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          notify(data.error);
          router.push("/management/jobs");
        } else {
          setTitle(data.title);
          setDescription(data.description);
          setRequirements(data.requirements);
          setTags(data.tags || []);
          setQuestions(data.questions || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.push("/management/jobs");
      });
  }, [params.id, router, notify]);

  const addQuestion = (type: Question["type"]) => {
    const newQ: Question = {
      id: Math.random().toString(36).substring(7),
      type,
      label: "",
      required: true,
      options: type === "multi_choice" ? ["Option 1"] : undefined,
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const addOption = (qId: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId) {
          return {
            ...q,
            options: [
              ...(q.options || []),
              `Option ${(q.options?.length || 0) + 1}`,
            ],
          };
        }
        return q;
      }),
    );
  };

  const updateOption = (qId: string, index: number, val: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId) {
          const nextOptions = [...(q.options || [])];
          nextOptions[index] = val;
          return { ...q, options: nextOptions };
        }
        return q;
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/management/jobs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          requirements,
          tags,
          questions,
        }),
      });
      if (res.ok) {
        router.push("/management/jobs");
      } else {
        notify("Failed to update job");
      }
    } catch {
      notify("Error updating job");
    } finally {
      setProcessing(false);
    }
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-12">
        <Link
          href="/management/jobs"
          className="text-muted-foreground hover:text-foreground text-sm font-medium flex items-center gap-2 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>
        <h1 className="text-2xl  text-foreground tracking-tight flex items-center gap-3 font-semibold">
          <PageIcon name="creator" compact /> Edit Job Application
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Modify your recruitment form and requirements.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Basic Info */}
        <Card className="bg-card border border-border rounded-xl p-6 space-y-6">
          <CardHeader className="flex items-center gap-3 mb-2 p-0 pb-4">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-foreground">
              <Info className="w-4 h-4" />
            </div>
            <CardTitle className="text-xl font-semibold text-foreground">
              Application Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground   mb-2 block">
                  Position Title
                </label>
                <Input
                  aria-label="Position Title"
                  type="text"
                  className="w-full border text-lg"
                  placeholder="e.g. Senior Developer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground   mb-2 block">
                    Description
                  </label>
                  <Textarea
                    aria-label="Description"
                    className="w-full border p-4 text-sm h-32 resize-none"
                    placeholder="Describe the role..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground   mb-2 block">
                    Requirements
                  </label>
                  <Textarea
                    aria-label="Requirements"
                    className="w-full border p-4 text-sm h-32 resize-none"
                    placeholder="What are you looking for?"
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground   mb-3 block">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Developer", "Support", "Moderation", "Marketing"].map(
                    (tag) => (
                      <Button
                        variant={tags.includes(tag) ? "secondary" : "outline"}
                        aria-pressed={tags.includes(tag)}
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions Builder */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-3">
              Form Questions
            </h2>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-muted/40 border border-border rounded-xl p-6 relative group transition-all hover:border-border"
              >
                <Button
                  aria-label="Remove item"
                  variant="outline"
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="absolute -top-2 -right-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity "
                >
                  <X className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-2 mb-4">
                  <Status render={<span />} variant="default">
                    Q{idx + 1} - {q.type.replace(/_/g, " ")}
                  </Status>
                </div>

                <div className="space-y-4">
                  <Input
                    aria-label={
                      q.type === "section" ? "Section Title" : "Question Label"
                    }
                    type="text"
                    className="w-full border"
                    placeholder={
                      q.type === "section" ? "Section Title" : "Question Label"
                    }
                    value={q.label}
                    onChange={(e) =>
                      updateQuestion(q.id, { label: e.target.value })
                    }
                    required
                  />

                  {q.type !== "section" && (
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={q.required}
                          onCheckedChange={(checked) =>
                            updateQuestion(q.id, { required: checked === true })
                          }
                        />
                        <span className="text-xs font-semibold text-muted-foreground  ">
                          Required
                        </span>
                      </label>
                    </div>
                  )}

                  {q.type === "multi_choice" && (
                    <div className="space-y-2 mt-4 pl-4 border-l-2 border-border">
                      {q.options?.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full border border-border"></div>
                          <Input
                            aria-label="Value"
                            type="text"
                            className="flex-1 border-b border-transparent text-sm transition-all"
                            value={opt}
                            onChange={(e) =>
                              updateOption(q.id, oIdx, e.target.value)
                            }
                          />
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="text-xs hover:underline"
                      >
                        + Add Option
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-8">
              {[
                {
                  id: "short_answer",
                  label: "Short Text",
                  icon: "M4 6h16M4 12h10M4 18h7",
                },
                {
                  id: "long_answer",
                  label: "Long Text",
                  icon: "M4 12h16M4 6h16M4 18h16",
                },
                {
                  id: "multi_choice",
                  label: "Multiple Choice",
                  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
                },
                { id: "checkbox", label: "Checkbox", icon: "M5 13l4 4L19 7" },
                {
                  id: "section",
                  label: "Section Header",
                  icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
                },
              ].map((type) => (
                <Button
                  aria-label="Add item"
                  variant="outline"
                  key={type.id}
                  type="button"
                  onClick={() => addQuestion(type.id as any)}
                  className="border flex flex-col items-center gap-2 transition-all group"
                >
                  <FileText className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground   text-center">
                    {type.label}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </section>

        <div className="pt-8 border-t border-border flex items-center justify-end gap-4">
          <Link
            href="/management/jobs"
            className="px-6 py-3 text-muted-foreground font-semibold hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
          <Button
            variant="default"
            type="submit"
            disabled={processing || !title}
            className="disabled:opacity-50 transition-all "
          >
            {processing ? "Saving Changes..." : "Save Application"}
          </Button>
        </div>
      </form>
    </div>
  );
}
