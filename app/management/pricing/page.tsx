'use client';

import { ArrowDown, ArrowUp, CircleDollarSign, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { defaultPricingContent, type PricingPageContent, type PricingPlan } from '@/lib/siteContent';

const newPlan = (): PricingPlan => ({
    id: `plan-${Date.now()}`,
    name: 'New plan',
    price: '$0',
    cadence: '/ month',
    description: 'Describe who this plan is for.',
    features: ['First included feature'],
    ctaLabel: 'Get started',
    ctaUrl: '/dashboard',
    featured: false,
    enabled: true,
});

export default function ManagePricingPage() {
    const [content, setContent] = useState<PricingPageContent>(defaultPricingContent);
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

    function updatePlan(index: number, changes: Partial<PricingPlan>) {
        setContent((current) => ({ ...current, plans: current.plans.map((plan, planIndex) => planIndex === index ? { ...plan, ...changes } : plan) }));
    }

    function movePlan(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= content.plans.length) return;
        const plans = [...content.plans];
        [plans[index], plans[target]] = [plans[target], plans[index]];
        setContent({ ...content, plans });
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

    if (loading) return <div className="flex min-h-56 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /></div>;

    return (
        <div className="space-y-6 md:space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Public content</p>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">Pricing Page</h1>
                    <p className="mt-1 text-slate-400">Edit page copy, add plans, change their order, or temporarily hide them.</p>
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
                <div><h2 className="text-xl font-bold text-white">Plans</h2><p className="text-sm text-slate-400">{content.plans.length} total</p></div>
                <button onClick={() => setContent({ ...content, plans: [...content.plans, newPlan()] })} className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-300 hover:bg-sky-500/20"><Plus className="h-4 w-4" />Add plan</button>
            </div>

            <div className="grid gap-5">
                {content.plans.map((plan, index) => (
                    <section key={plan.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3"><span className="rounded-lg bg-sky-500/10 p-2 text-sky-400"><CircleDollarSign className="h-5 w-5" /></span><strong className="text-white">{plan.name || `Plan ${index + 1}`}</strong></div>
                            <div className="flex gap-2">
                                <IconButton label="Move up" disabled={index === 0} onClick={() => movePlan(index, -1)}><ArrowUp /></IconButton>
                                <IconButton label="Move down" disabled={index === content.plans.length - 1} onClick={() => movePlan(index, 1)}><ArrowDown /></IconButton>
                                <IconButton label="Delete plan" danger onClick={() => confirm(`Delete “${plan.name}”?`) && setContent({ ...content, plans: content.plans.filter((_, planIndex) => planIndex !== index) })}><Trash2 /></IconButton>
                            </div>
                        </div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <EditorField label="Plan name" value={plan.name} maxLength={80} onChange={(name) => updatePlan(index, { name })} />
                            <EditorField label="Price" value={plan.price} maxLength={80} onChange={(price) => updatePlan(index, { price })} />
                            <EditorField label="Price suffix" value={plan.cadence} maxLength={60} placeholder="/ month" onChange={(cadence) => updatePlan(index, { cadence })} />
                            <EditorField label="Button label" value={plan.ctaLabel} maxLength={60} onChange={(ctaLabel) => updatePlan(index, { ctaLabel })} />
                            <EditorField label="Button URL" value={plan.ctaUrl} maxLength={500} placeholder="/dashboard or https://…" onChange={(ctaUrl) => updatePlan(index, { ctaUrl })} />
                            <EditorField label="Description" value={plan.description} maxLength={300} multiline onChange={(description) => updatePlan(index, { description })} />
                            <EditorField label="Features (one per line)" value={plan.features.join('\n')} multiline onChange={(value) => updatePlan(index, { features: value.split('\n') })} />
                            <div className="grid content-start gap-3 sm:pt-7">
                                <Toggle label="Visible on pricing page" checked={plan.enabled} onChange={(enabled) => updatePlan(index, { enabled })} />
                                <Toggle label="Show as recommended" checked={plan.featured} onChange={(featured) => updatePlan(index, { featured })} />
                            </div>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function EditorField({ label, value, onChange, multiline = false, maxLength, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; placeholder?: string }) {
    const classes = 'rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-500';
    return <label className="grid gap-2 text-sm font-semibold text-slate-300">{label}{multiline ? <textarea rows={3} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${classes} resize-y`} /> : <input value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={classes} />}</label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-300"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-sky-500" />{label}</label>;
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactElement<{ className?: string }> }) {
    return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`rounded-lg border p-2 disabled:opacity-30 ${danger ? 'border-red-500/20 text-red-300 hover:bg-red-500/10' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{children}</button>;
}
