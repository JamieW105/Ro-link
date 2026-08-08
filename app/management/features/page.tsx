'use client';

import { ArrowDown, ArrowUp, Clock3, Eye, EyeOff, ListChecks, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { EditorField, LoadingState, StatusMessage } from '@/app/management/SiteContentFields';
import { defaultFeaturesContent, type FeaturesPageContent } from '@/lib/siteContent';

export default function ManageFeaturesPage() {
    const [content, setContent] = useState<FeaturesPageContent>(defaultFeaturesContent);
    const [query, setQuery] = useState('');
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

    const filteredFeatures = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return content.sections;
        return content.sections.filter((feature) => [feature.title, feature.description, ...feature.items].join(' ').toLowerCase().includes(normalized));
    }, [content.sections, query]);

    function moveFeature(id: string, direction: -1 | 1) {
        const index = content.sections.findIndex((feature) => feature.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= content.sections.length) return;
        const sections = [...content.sections];
        [sections[index], sections[target]] = [sections[target], sections[index]];
        setContent({ ...content, sections });
    }

    function deleteFeature(id: string, title: string) {
        if (!confirm(`Delete “${title}”? Save the page to confirm this change.`)) return;
        setContent({ ...content, sections: content.sections.filter((feature) => feature.id !== id) });
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

    if (loading) return <LoadingState />;

    return (
        <div className="space-y-6 md:space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Public content</p>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">Features Page</h1>
                    <p className="mt-1 text-slate-400">Manage the public introduction and individual feature pages.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save page'}</button>
                    <Link href="/management/features/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500"><Plus className="h-4 w-4" />Create feature</Link>
                </div>
            </header>

            <StatusMessage message={message} />

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
                <h2 className="font-bold text-white">Page introduction</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <EditorField label="Eyebrow" value={content.eyebrow} maxLength={80} onChange={(eyebrow) => setContent({ ...content, eyebrow })} />
                    <EditorField label="Title" value={content.title} maxLength={120} onChange={(title) => setContent({ ...content, title })} />
                    <EditorField label="Highlighted title" value={content.highlightedTitle} maxLength={120} onChange={(highlightedTitle) => setContent({ ...content, highlightedTitle })} />
                    <EditorField label="Introduction" value={content.intro} maxLength={500} multiline onChange={(intro) => setContent({ ...content, intro })} />
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div><h2 className="text-xl font-bold text-white">Features</h2><p className="text-sm text-slate-400">{query ? `${filteredFeatures.length} of ${content.sections.length}` : content.sections.length} total</p></div>
                    <label className="relative block w-full sm:max-w-sm">
                        <span className="sr-only">Search features</span>
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search features…" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500" />
                    </label>
                </div>

                {filteredFeatures.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-12 text-center text-sm text-slate-500">No features match “{query}”.</div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredFeatures.map((feature) => {
                            const index = content.sections.findIndex((item) => item.id === feature.id);
                            return (
                                <article key={feature.id} className="group flex min-h-40 flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-slate-700">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2.5"><span className="rounded-lg bg-sky-500/10 p-1.5 text-sky-400"><ListChecks className="h-4 w-4" /></span><div className="min-w-0"><span className="block text-[10px] font-bold text-slate-600">{String(index + 1).padStart(2, '0')}</span><h3 className="truncate text-sm font-bold text-white">{feature.title}</h3></div></div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <IconButton label="Move up" disabled={index === 0 || Boolean(query)} onClick={() => moveFeature(feature.id, -1)}><ArrowUp /></IconButton>
                                            <IconButton label="Move down" disabled={index === content.sections.length - 1 || Boolean(query)} onClick={() => moveFeature(feature.id, 1)}><ArrowDown /></IconButton>
                                        </div>
                                    </div>
                                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-400">{feature.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${feature.enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>{feature.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{feature.enabled ? 'Visible' : 'Hidden'}</span>
                                        {feature.comingSoon && <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-300"><Clock3 className="h-3 w-3" />Coming soon</span>}
                                        <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-400">{feature.items.length} points</span>
                                    </div>
                                    <div className="mt-auto flex items-center justify-end gap-1 border-t border-slate-800 pt-3">
                                        <Link href={`/management/features/${encodeURIComponent(feature.id)}/edit`} aria-label={`Edit ${feature.title}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/10"><Pencil className="h-3.5 w-3.5" />Edit</Link>
                                        <button type="button" onClick={() => deleteFeature(feature.id, feature.title)} aria-label={`Delete ${feature.title}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
                {query && <p className="text-xs text-slate-500">Clear the search to reorder features.</p>}
            </section>
        </div>
    );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded-md border border-slate-800 p-1 text-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 [&_svg]:h-3 [&_svg]:w-3">{children}</button>;
}
