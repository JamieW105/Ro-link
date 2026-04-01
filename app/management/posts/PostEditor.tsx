'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { UpdatePostMajorFeature, UpdatePostRecord } from '@/lib/updatePosts';

type PostEditorProps = {
    initialPost?: UpdatePostRecord | null;
    submitUrl: string;
    submitMethod: 'POST' | 'PATCH';
    heading: string;
    subheading: string;
    submitLabel: string;
};

function emptyFeature(): UpdatePostMajorFeature {
    return {
        title: '',
        description: '',
        subFeatures: [''],
    };
}

function normalizeListForEditor(values: string[] | undefined) {
    return Array.isArray(values) && values.length > 0 ? values : [''];
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
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="text-sm text-slate-500 mt-1">{description}</p>
            </div>

            <div className="space-y-3">
                {values.map((value, index) => (
                    <div key={`${title}-${index}`} className="flex gap-3">
                        <input
                            type="text"
                            value={value}
                            onChange={(event) => updateValue(index, event.target.value)}
                            placeholder={`${title} item ${index + 1}`}
                            className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500"
                        />
                        <button
                            type="button"
                            onClick={() => removeValue(index)}
                            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-300 transition-all hover:bg-red-500/20"
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={() => onChange([...values, ''])}
                className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-300 transition-all hover:bg-sky-500/20"
            >
                Add Item
            </button>
        </div>
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
    const [title, setTitle] = useState(initialPost?.title || '');
    const [description, setDescription] = useState(initialPost?.description || '');
    const [majorFeatures, setMajorFeatures] = useState<UpdatePostMajorFeature[]>(
        initialPost?.major_features && initialPost.major_features.length > 0
            ? initialPost.major_features.map((feature) => ({
                title: feature.title,
                description: feature.description || '',
                subFeatures: normalizeListForEditor(feature.subFeatures),
            }))
            : [],
    );
    const [minorUpdates, setMinorUpdates] = useState<string[]>(normalizeListForEditor(initialPost?.minor_updates));
    const [qolUpdates, setQolUpdates] = useState<string[]>(normalizeListForEditor(initialPost?.qol_updates));
    const [bugFixes, setBugFixes] = useState<string[]>(normalizeListForEditor(initialPost?.bug_fixes));
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function updateMajorFeature(index: number, updates: Partial<UpdatePostMajorFeature>) {
        setMajorFeatures((current) => current.map((feature, featureIndex) => {
            if (featureIndex !== index) {
                return feature;
            }

            return {
                ...feature,
                ...updates,
            };
        }));
    }

    function addMajorFeature() {
        setMajorFeatures((current) => [...current, emptyFeature()]);
    }

    function removeMajorFeature(index: number) {
        setMajorFeatures((current) => current.filter((_, featureIndex) => featureIndex !== index));
    }

    function updateSubFeature(featureIndex: number, subFeatureIndex: number, nextValue: string) {
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

        updateMajorFeature(featureIndex, { subFeatures: [...feature.subFeatures, ''] });
    }

    function removeSubFeature(featureIndex: number, subFeatureIndex: number) {
        const feature = majorFeatures[featureIndex];
        if (!feature) {
            return;
        }

        updateMajorFeature(featureIndex, {
            subFeatures: feature.subFeatures.filter((_, index) => index !== subFeatureIndex),
        });
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setError(null);

        try {
            const response = await fetch(submitUrl, {
                method: submitMethod,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                setError(String(payload.error || 'Failed to save post.'));
                return;
            }

            router.push('/management/posts');
            router.refresh();
        } catch (submitError) {
            setError(String(submitError instanceof Error ? submitError.message : submitError));
        } finally {
            setProcessing(false);
        }
    }

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <header className="mb-12">
                <Link href="/management/posts" className="text-slate-500 hover:text-white text-sm font-medium flex items-center gap-2 mb-4 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Updates
                </Link>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">{heading}</h1>
                <p className="text-slate-400 mt-2 text-lg">{subheading}</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
                <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Kernel v1.6.0"
                            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-sky-500"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Description</label>
                        <textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Summarize the release in one clear paragraph."
                            className="w-full h-32 resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500"
                            required
                        />
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Major Features</h2>
                            <p className="text-sm text-slate-500 mt-1">Each major feature needs a title and at least one sub-feature.</p>
                        </div>

                        <button
                            type="button"
                            onClick={addMajorFeature}
                            className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-300 transition-all hover:bg-sky-500/20"
                        >
                            Add Major Feature
                        </button>
                    </div>

                    {majorFeatures.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center text-sm font-medium text-slate-500">
                            No major features added yet.
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {majorFeatures.map((feature, featureIndex) => (
                                <div key={`feature-${featureIndex}`} className="rounded-3xl border border-slate-800 bg-slate-950/40 p-6 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-3">
                                            <input
                                                type="text"
                                                value={feature.title}
                                                onChange={(event) => updateMajorFeature(featureIndex, { title: event.target.value })}
                                                placeholder={`Major feature ${featureIndex + 1} title`}
                                                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base font-bold text-white focus:outline-none focus:border-sky-500"
                                            />
                                            <textarea
                                                value={feature.description}
                                                onChange={(event) => updateMajorFeature(featureIndex, { description: event.target.value })}
                                                placeholder="Optional short summary for this feature."
                                                className="w-full h-24 resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeMajorFeature(featureIndex)}
                                            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-300 transition-all hover:bg-red-500/20"
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sub-Features</p>
                                        {feature.subFeatures.map((subFeature, subFeatureIndex) => (
                                            <div key={`sub-${featureIndex}-${subFeatureIndex}`} className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={subFeature}
                                                    onChange={(event) => updateSubFeature(featureIndex, subFeatureIndex, event.target.value)}
                                                    placeholder={`Sub-feature ${subFeatureIndex + 1}`}
                                                    className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeSubFeature(featureIndex, subFeatureIndex)}
                                                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 transition-all hover:border-red-500/20 hover:text-red-300"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={() => addSubFeature(featureIndex)}
                                            className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-300 transition-all hover:bg-sky-500/20"
                                        >
                                            Add Sub-Feature
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

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
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                        {error}
                    </div>
                )}

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-4">
                    <Link href="/management/posts" className="px-6 py-3 text-slate-400 font-bold hover:text-white transition-colors">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={processing || !title || !description}
                        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-10 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-sky-900/40"
                    >
                        {processing ? 'Saving...' : submitLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}
