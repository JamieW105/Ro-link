'use client';

import { ArrowDown, ArrowUp, CircleDollarSign, Clock3, Eye, EyeOff, Pencil, Plus, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { EditorField, LoadingState, StatusMessage } from '@/app/management/SiteContentFields';
import { defaultPricingContent, type PricingPageContent } from '@/lib/siteContent';

export default function ManagePricingPage() {
    const [content, setContent] = useState<PricingPageContent>(defaultPricingContent);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    useEffect(() => {
        fetch('/api/management/site-content/pricing', { cache: 'no-store' })
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Could not load pricing content.');
                setContent(body);
            })
            .catch((error) => setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not load pricing content.' }))
            .finally(() => setLoading(false));
    }, []);

    const filteredPlans = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return content.plans;
        return content.plans.filter((plan) => [plan.name, plan.price, plan.cadence, plan.description, ...plan.features].join(' ').toLowerCase().includes(normalized));
    }, [content.plans, query]);

    function movePlan(id: string, direction: -1 | 1) {
        const index = content.plans.findIndex((plan) => plan.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= content.plans.length) return;
        const plans = [...content.plans];
        [plans[index], plans[target]] = [plans[target], plans[index]];
        setContent({ ...content, plans });
    }

    function deletePlan(id: string, name: string) {
        if (!confirm(`Delete “${name}”? Save the page to confirm this change.`)) return;
        setContent({ ...content, plans: content.plans.filter((plan) => plan.id !== id) });
    }

    async function save() {
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch('/api/management/site-content/pricing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(content),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Could not save pricing content.');
            setContent(body);
            setMessage({ type: 'success', text: 'Pricing page saved. Public changes may take up to one minute to appear.' });
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not save pricing content.' });
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
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">Pricing Page</h1>
                    <p className="mt-1 text-slate-400">Manage the public introduction and individual pricing plan pages.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save page'}</button>
                    <Link href="/management/pricing/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500"><Plus className="h-4 w-4" />Create plan</Link>
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
                    <div><h2 className="text-xl font-bold text-white">Pricing plans</h2><p className="text-sm text-slate-400">{query ? `${filteredPlans.length} of ${content.plans.length}` : content.plans.length} total</p></div>
                    <label className="relative block w-full sm:max-w-sm">
                        <span className="sr-only">Search pricing plans</span>
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pricing plans…" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500" />
                    </label>
                </div>

                {filteredPlans.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-12 text-center text-sm text-slate-500">No pricing plans match “{query}”.</div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredPlans.map((plan) => {
                            const index = content.plans.findIndex((item) => item.id === plan.id);
                            return (
                                <article key={plan.id} className="group flex min-h-40 flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-slate-700">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2.5"><span className="rounded-lg bg-sky-500/10 p-1.5 text-sky-400"><CircleDollarSign className="h-4 w-4" /></span><div className="min-w-0"><span className="block text-[10px] font-bold text-slate-600">{String(index + 1).padStart(2, '0')}</span><h3 className="truncate text-sm font-bold text-white">{plan.name}</h3></div></div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <IconButton label="Move up" disabled={index === 0 || Boolean(query)} onClick={() => movePlan(plan.id, -1)}><ArrowUp /></IconButton>
                                            <IconButton label="Move down" disabled={index === content.plans.length - 1 || Boolean(query)} onClick={() => movePlan(plan.id, 1)}><ArrowDown /></IconButton>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-baseline gap-1"><strong className="text-lg text-white">{plan.price}</strong><span className="text-xs text-slate-500">{plan.cadence}</span></div>
                                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{plan.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${plan.enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>{plan.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{plan.enabled ? 'Visible' : 'Hidden'}</span>
                                        {!plan.available && <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-300">Unavailable</span>}
                                        {plan.comingSoon && <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-300"><Clock3 className="h-3 w-3" />Coming soon</span>}
                                        {plan.featured && <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-violet-300"><Sparkles className="h-3 w-3" />Recommended</span>}
                                    </div>
                                    <div className="mt-auto flex items-center justify-end gap-1 border-t border-slate-800 pt-3">
                                        <Link href={`/management/pricing/${encodeURIComponent(plan.id)}/edit`} aria-label={`Edit ${plan.name}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/10"><Pencil className="h-3.5 w-3.5" />Edit</Link>
                                        <button type="button" onClick={() => deletePlan(plan.id, plan.name)} aria-label={`Delete ${plan.name}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
                {query && <p className="text-xs text-slate-500">Clear the search to reorder pricing plans.</p>}
            </section>
        </div>
    );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded-md border border-slate-800 p-1 text-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 [&_svg]:h-3 [&_svg]:w-3">{children}</button>;
}
