"use client";
import { PageIcon } from "@/components/dashboard/PageIcon";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { ArrowLeft as LucideArrowLeft } from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DEFAULT_ROLINK_VERSION,
  type UpdatePostMajorFeature,
  type UpdatePostRecord,
} from "@/lib/updatePosts";

type PostEditorProps = {
  initialPost?: UpdatePostRecord | null;
  submitUrl: string;
  submitMethod: "POST" | "PATCH";
  heading: string;
  subheading: string;
  submitLabel: string;
};

function emptyFeature(): UpdatePostMajorFeature {
  return {
    title: "",
    description: "",
    subFeatures: [""],
  };
}

function normalizeListForEditor(values: string[] | undefined) {
  return Array.isArray(values) && values.length > 0 ? values : [""];
}

function TextListEditor({
  title,
  description,
  values,
  onChange,
}: {
  title: string;
  description: string;
  values: string[];
  onChange: (nextValues: string[]) => void;
}) {
  function updateValue(index: number, nextValue: string) {
    const nextValues = [...values];
    nextValues[index] = nextValue;
    onChange(nextValues);
  }

  function removeValue(index: number) {
    onChange(values.filter((_, valueIndex) => valueIndex !== index));
  }

  return (
    <Card className="rounded-xl border border-border bg-card p-6 space-y-4">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">
          {title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-1">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-3">
          {values.map((value, index) => (
            <div key={`${title}-${index}`} className="flex gap-3">
              <Input
                aria-label={`${title} item ${index + 1}`}
                type="text"
                value={value}
                onChange={(event) => updateValue(index, event.target.value)}
                placeholder={`${title} item ${index + 1}`}
                className="flex-1 border text-sm"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => removeValue(index)}
                className="border text-xs transition-all"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          type="button"
          onClick={() => onChange([...values, ""])}
          className="border text-xs transition-all"
        >
          Add Item
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PostEditor({
  initialPost,
  submitUrl,
  submitMethod,
  heading,
  subheading,
  submitLabel,
}: PostEditorProps) {
  const router = useRouter();
  const [rolinkVersion, setRolinkVersion] = useState(
    initialPost?.rolink_version ||
      initialPost?.version ||
      DEFAULT_ROLINK_VERSION,
  );
  const [pluginVersion, setPluginVersion] = useState(
    initialPost?.plugin_version || "",
  );
  const [title, setTitle] = useState(initialPost?.title || "");
  const [description, setDescription] = useState(
    initialPost?.description || "",
  );
  const [majorFeatures, setMajorFeatures] = useState<UpdatePostMajorFeature[]>(
    initialPost?.major_features && initialPost.major_features.length > 0
      ? initialPost.major_features.map((feature) => ({
          title: feature.title,
          description: feature.description || "",
          subFeatures: normalizeListForEditor(feature.subFeatures),
        }))
      : [],
  );
  const [minorUpdates, setMinorUpdates] = useState<string[]>(
    normalizeListForEditor(initialPost?.minor_updates),
  );
  const [qolUpdates, setQolUpdates] = useState<string[]>(
    normalizeListForEditor(initialPost?.qol_updates),
  );
  const [bugFixes, setBugFixes] = useState<string[]>(
    normalizeListForEditor(initialPost?.bug_fixes),
  );
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMajorFeature(
    index: number,
    updates: Partial<UpdatePostMajorFeature>,
  ) {
    setMajorFeatures((current) =>
      current.map((feature, featureIndex) => {
        if (featureIndex !== index) {
          return feature;
        }

        return {
          ...feature,
          ...updates,
        };
      }),
    );
  }

  function addMajorFeature() {
    setMajorFeatures((current) => [...current, emptyFeature()]);
  }

  function removeMajorFeature(index: number) {
    setMajorFeatures((current) =>
      current.filter((_, featureIndex) => featureIndex !== index),
    );
  }

  function updateSubFeature(
    featureIndex: number,
    subFeatureIndex: number,
    nextValue: string,
  ) {
    const feature = majorFeatures[featureIndex];
    if (!feature) {
      return;
    }

    const nextSubFeatures = [...feature.subFeatures];
    nextSubFeatures[subFeatureIndex] = nextValue;
    updateMajorFeature(featureIndex, { subFeatures: nextSubFeatures });
  }

  function addSubFeature(featureIndex: number) {
    const feature = majorFeatures[featureIndex];
    if (!feature) {
      return;
    }

    updateMajorFeature(featureIndex, {
      subFeatures: [...feature.subFeatures, ""],
    });
  }

  function removeSubFeature(featureIndex: number, subFeatureIndex: number) {
    const feature = majorFeatures[featureIndex];
    if (!feature) {
      return;
    }

    updateMajorFeature(featureIndex, {
      subFeatures: feature.subFeatures.filter(
        (_, index) => index !== subFeatureIndex,
      ),
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(submitUrl, {
        method: submitMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: rolinkVersion,
          rolink_version: rolinkVersion,
          plugin_version: pluginVersion,
          title,
          description,
          major_features: majorFeatures,
          minor_updates: minorUpdates,
          qol_updates: qolUpdates,
          bug_fixes: bugFixes,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(payload.error || "Failed to save post."));
        return;
      }

      router.push("/management/posts");
      router.refresh();
    } catch (submitError) {
      setError(
        String(
          submitError instanceof Error ? submitError.message : submitError,
        ),
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <header className="mb-12">
        <Link
          href="/management/posts"
          className="text-muted-foreground hover:text-foreground text-sm font-medium flex items-center gap-2 mb-4 transition-colors"
        >
          <LucideArrowLeft className="w-4 h-4" />
          Back to Updates
        </Link>
        <h1 className="text-2xl  text-foreground tracking-tight flex items-center gap-3 font-semibold">
          <PageIcon name="logs" compact /> {heading}
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">{subheading}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="rounded-xl border border-border bg-card p-6 space-y-6">
          <CardContent className="p-0">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold   text-muted-foreground">
                  Ro-Link Version
                </label>
                <Input
                  aria-label="Ro-Link Version"
                  type="text"
                  value={rolinkVersion}
                  onChange={(event) => setRolinkVersion(event.target.value)}
                  placeholder={DEFAULT_ROLINK_VERSION}
                  className="w-full border text-base"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold   text-muted-foreground">
                  Plugin Version
                </label>
                <Input
                  aria-label="Plugin Version"
                  type="text"
                  value={pluginVersion}
                  onChange={(event) => setPluginVersion(event.target.value)}
                  placeholder="Plugin v1.0.0"
                  className="w-full border text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold   text-muted-foreground">
                Title
              </label>
              <Input
                aria-label="Title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Kernel v1.6.0"
                className="w-full border text-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold   text-muted-foreground">
                Description
              </label>
              <Textarea
                aria-label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Summarize the release in one clear paragraph."
                className="w-full h-32 resize-none border px-4 py-3 text-sm"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card p-6 space-y-6">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-0 pb-4">
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">
                Major Features
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Each major feature needs a title and at least one sub-feature.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={addMajorFeature}
              className="border text-xs transition-all"
            >
              Add Major Feature
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {majorFeatures.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm font-medium text-muted-foreground">
                No major features added yet.
              </div>
            ) : (
              <div className="space-y-5">
                {majorFeatures.map((feature, featureIndex) => (
                  <div
                    key={`feature-${featureIndex}`}
                    className="rounded-xl border border-border bg-background p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-3">
                        <Input
                          aria-label={`Major feature ${featureIndex + 1} title`}
                          type="text"
                          value={feature.title}
                          onChange={(event) =>
                            updateMajorFeature(featureIndex, {
                              title: event.target.value,
                            })
                          }
                          placeholder={`Major feature ${featureIndex + 1} title`}
                          className="w-full border text-base"
                        />
                        <Textarea
                          aria-label="Optional short summary for this feature."
                          value={feature.description}
                          onChange={(event) =>
                            updateMajorFeature(featureIndex, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Optional short summary for this feature."
                          className="w-full h-24 resize-none border px-4 py-3 text-sm"
                        />
                      </div>

                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => removeMajorFeature(featureIndex)}
                        className="border text-xs transition-all"
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold   text-muted-foreground">
                        Sub-Features
                      </p>
                      {feature.subFeatures.map(
                        (subFeature, subFeatureIndex) => (
                          <div
                            key={`sub-${featureIndex}-${subFeatureIndex}`}
                            className="flex gap-3"
                          >
                            <Input
                              aria-label={`Sub-feature ${subFeatureIndex + 1}`}
                              type="text"
                              value={subFeature}
                              onChange={(event) =>
                                updateSubFeature(
                                  featureIndex,
                                  subFeatureIndex,
                                  event.target.value,
                                )
                              }
                              placeholder={`Sub-feature ${subFeatureIndex + 1}`}
                              className="flex-1 border text-sm"
                            />
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() =>
                                removeSubFeature(featureIndex, subFeatureIndex)
                              }
                              className="border text-xs transition-all"
                            >
                              Remove
                            </Button>
                          </div>
                        ),
                      )}

                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => addSubFeature(featureIndex)}
                        className="border text-xs transition-all"
                      >
                        Add Sub-Feature
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <TextListEditor
          title="Minor Updates"
          description="Use this for smaller visible changes that do not need full major-feature breakdowns."
          values={minorUpdates}
          onChange={setMinorUpdates}
        />

        <TextListEditor
          title="QOL Updates"
          description="Quality-of-life improvements, polish, or workflow refinements."
          values={qolUpdates}
          onChange={setQolUpdates}
        />

        <TextListEditor
          title="Bug Fixes"
          description="List bugs fixed in this release. Leave empty if the release has no bug-fix notes."
          values={bugFixes}
          onChange={setBugFixes}
        />

        {error && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="pt-4 border-t border-border flex items-center justify-end gap-4">
          <Link
            href="/management/posts"
            className="px-6 py-3 text-muted-foreground font-semibold hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
          <Button
            variant="default"
            type="submit"
            disabled={processing || !rolinkVersion || !title || !description}
            className="disabled:opacity-50 transition-all "
          >
            {processing ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
