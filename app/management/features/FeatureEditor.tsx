'use client';

import { ArrowLeft, ListChecks, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EditorField, LoadingState, StatusMessage, Toggle } from '@/app/management/SiteContentFields';
import { defaultFeaturesContent, type FeatureSection, type FeaturesPageContent } from '@/lib/siteContent';

function blankFeature(): FeatureSection {
    return {
        id: `feature-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        title: '',
        description: '',
        items: [''],
        comingSoon: false,
        enabled: true,
    };
}

export default function FeatureEditor({ featureId }: { featureId?: string }) {
    const router = useRouter();
    const editing = Boolean(featureId);
    const [content, setContent] = useState<FeaturesPageContent>(defaultFeaturesContent);
    const [feature, setFeature] = useState<FeatureSection>(blankFeature);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    useEffect(() => {
        fetch('/api/management/site-content/features', { cache: 'no-store' })
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Could not load features content.');
                const loaded = body as FeaturesPageContent;
                setContent(loaded);
                if (featureId) {
                    const existing = loaded.sections.find((section) => section.id === featureId);
                    if (!existing) setNotFound(true);
                    else setFeature(existing);
                }
            })
            .catch((error) => setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not load features content.' }))
            .finally(() => setLoading(false));
    }, [featureId]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        const sections = editing
            ? content.sections.map((section) => section.id === featureId ? feature : section)
            : [...content.sections, feature];
        try {
            const response = await fetch('/api/management/site-content/features', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...content, sections }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || `Could not ${editing ? 'save' : 'create'} feature.`);
            router.push('/management/features');
            router.refresh();
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : `Could not ${editing ? 'save' : 'create'} feature.` });
            setSaving(false);
        }
    }

    if (loading) return <LoadingState />;
    if (notFound) return <MissingFeature />;

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-16">
            <header>
                <Link href="/management/features" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Features</Link>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Public content</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">{editing ? 'Edit feature' : 'Create feature'}</h1>
                <p className="mt-1 text-slate-400">{editing ? 'Update this feature and its public display settings.' : 'Add a new feature to the public Features page.'}</p>
            </header>

            <StatusMessage message={message} />

            <form onSubmit={submit} className="space-y-6">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-7">
                    <div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-sky-500/10 p-2 text-sky-400"><ListChecks className="h-5 w-5" /></span><h2 className="font-bold text-white">Feature details</h2></div>
                    <div className="grid gap-5">
                        <EditorField label="Feature title" value={feature.title} maxLength={100} placeholder="e.g. Live server visibility" onChange={(title) => setFeature({ ...feature, title })} />
                        <EditorField label="Description" value={feature.description} maxLength={500} multiline placeholder="Explain how this feature helps a community or staff team." onChange={(description) => setFeature({ ...feature, description })} />
                        <EditorField label="Bullet points (one per line)" value={feature.items.join('\n')} multiline placeholder="First capability" onChange={(value) => setFeature({ ...feature, items: value.split('\n') })} />
                    </div>
                </section>

                <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:grid-cols-2 md:p-7">
                    <Toggle label="Visible on features page" description="Turn this off to keep the feature saved but hidden." checked={feature.enabled} onChange={(enabled) => setFeature({ ...feature, enabled })} />
                    <Toggle label="Show as coming soon" description="Adds a coming-soon status to the public card." checked={feature.comingSoon} onChange={(comingSoon) => setFeature({ ...feature, comingSoon })} />
                </section>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
                    <Link href="/management/features" className="rounded-xl px-5 py-3 text-center text-sm font-bold text-slate-400 hover:text-white">Cancel</Link>
                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : editing ? 'Save feature' : 'Create feature'}</button>
                </div>
            </form>
        </div>
    );
}

function MissingFeature() {
    return <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/20 bg-red-500/10 px-8 py-10 text-center"><h1 className="text-2xl font-bold text-white">Feature not found</h1><p className="mt-2 text-sm text-red-200">This feature may have been removed or its link is no longer valid.</p><Link href="/management/features" className="mt-6 inline-flex rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15">Back to Features</Link></div>;
}
