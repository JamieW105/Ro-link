'use client';

import { ArrowDown, ArrowUp, ListChecks, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { defaultFeaturesContent, type FeaturesPageContent, type FeatureSection } from '@/lib/siteContent';

const newFeature = (): FeatureSection => ({
    id: `feature-${Date.now()}`,
    title: 'New feature',
    description: 'Explain how this feature helps a community or staff team.',
    items: ['First capability'],
    enabled: true,
});

export default function ManageFeaturesPage() {
    const [content, setContent] = useState<FeaturesPageContent>(defaultFeaturesContent);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    useEffect(() => {
        fetch('/api/management/site-content/features', { cache: 'no-store' })
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Could not load features content.');
                setContent(body);
            })
            .catch((error) => setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not load features content.' }))
            .finally(() => setLoading(false));
    }, []);

    function updateFeature(index: number, changes: Partial<FeatureSection>) {
        setContent((current) => ({ ...current, sections: current.sections.map((feature, featureIndex) => featureIndex === index ? { ...feature, ...changes } : feature) }));
    }

    function moveFeature(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= content.sections.length) return;
        const sections = [...content.sections];
        [sections[index], sections[target]] = [sections[target], sections[index]];
        setContent({ ...content, sections });
    }

    async function save() {
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch('/api/management/site-content/features', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(content),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Could not save features content.');
            setContent(body);
            setMessage({ type: 'success', text: 'Features page saved. Public changes may take up to one minute to appear.' });
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not save features content.' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="flex min-h-56 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /></div>;

    return (
        <div className="space-y-6 md:space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Public content</p>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">Features Page</h1>
                    <p className="mt-1 text-slate-400">Edit the introduction and manage every feature shown publicly.</p>
                </div>
                <button onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50">
                    <Save className="h-4 w-4" aria-hidden="true" />{saving ? 'Saving…' : 'Save page'}
                </button>
            </header>

            {message && <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'border-red-500/25 bg-red-500/10 text-red-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}>{message.text}</div>}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
                <h2 className="font-bold text-white">Page introduction</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <EditorField label="Eyebrow" value={content.eyebrow} maxLength={80} onChange={(eyebrow) => setContent({ ...content, eyebrow })} />
                    <EditorField label="Title" value={content.title} maxLength={120} onChange={(title) => setContent({ ...content, title })} />
                    <EditorField label="Highlighted title" value={content.highlightedTitle} maxLength={120} onChange={(highlightedTitle) => setContent({ ...content, highlightedTitle })} />
                    <EditorField label="Introduction" value={content.intro} maxLength={500} multiline onChange={(intro) => setContent({ ...content, intro })} />
                </div>
            </section>

            <div className="flex items-center justify-between gap-4">
                <div><h2 className="text-xl font-bold text-white">Feature sections</h2><p className="text-sm text-slate-400">{content.sections.length} total</p></div>
                <button onClick={() => setContent({ ...content, sections: [...content.sections, newFeature()] })} className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-300 hover:bg-sky-500/20"><Plus className="h-4 w-4" />Add feature</button>
            </div>

            <div className="grid gap-5">
                {content.sections.map((feature, index) => (
                    <section key={feature.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3"><span className="rounded-lg bg-sky-500/10 p-2 text-sky-400"><ListChecks className="h-5 w-5" /></span><div><span className="block text-xs font-bold text-slate-500">{String(index + 1).padStart(2, '0')}</span><strong className="text-white">{feature.title || `Feature ${index + 1}`}</strong></div></div>
                            <div className="flex gap-2">
                                <IconButton label="Move up" disabled={index === 0} onClick={() => moveFeature(index, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
                                <IconButton label="Move down" disabled={index === content.sections.length - 1} onClick={() => moveFeature(index, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
                                <IconButton label="Delete feature" danger onClick={() => confirm(`Delete “${feature.title}”?`) && setContent({ ...content, sections: content.sections.filter((_, featureIndex) => featureIndex !== index) })}><Trash2 className="h-4 w-4" /></IconButton>
                            </div>
                        </div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <EditorField label="Feature title" value={feature.title} maxLength={100} onChange={(title) => updateFeature(index, { title })} />
                            <label className="flex items-center gap-3 self-end rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-300"><input type="checkbox" checked={feature.enabled} onChange={(event) => updateFeature(index, { enabled: event.target.checked })} className="h-4 w-4 accent-sky-500" />Visible on features page</label>
                            <EditorField label="Description" value={feature.description} maxLength={500} multiline onChange={(description) => updateFeature(index, { description })} />
                            <EditorField label="Bullet points (one per line)" value={feature.items.join('\n')} multiline onChange={(value) => updateFeature(index, { items: value.split('\n') })} />
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function EditorField({ label, value, onChange, multiline = false, maxLength }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number }) {
    const classes = 'rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-500';
    return <label className="grid gap-2 text-sm font-semibold text-slate-300">{label}{multiline ? <textarea rows={4} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={`${classes} resize-y`} /> : <input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={classes} />}</label>;
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
    return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`rounded-lg border p-2 disabled:opacity-30 ${danger ? 'border-red-500/20 text-red-300 hover:bg-red-500/10' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{children}</button>;
}
