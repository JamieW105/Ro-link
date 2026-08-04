'use client';

import { ArrowLeft, CircleDollarSign, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EditorField, LoadingState, StatusMessage, Toggle } from '@/app/management/SiteContentFields';
import { defaultPricingContent, type PricingPageContent, type PricingPlan } from '@/lib/siteContent';

function blankPlan(): PricingPlan {
    return {
        id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: '',
        price: '',
        cadence: '',
        description: '',
        features: [''],
        ctaLabel: 'Get started',
        ctaUrl: '/dashboard',
        featured: false,
        available: true,
        comingSoon: false,
        enabled: true,
    };
}

export default function PricingPlanEditor({ planId }: { planId?: string }) {
    const router = useRouter();
    const editing = Boolean(planId);
    const [content, setContent] = useState<PricingPageContent>(defaultPricingContent);
    const [plan, setPlan] = useState<PricingPlan>(blankPlan);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    useEffect(() => {
        fetch('/api/management/site-content/pricing', { cache: 'no-store' })
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Could not load pricing content.');
                const loaded = body as PricingPageContent;
                setContent(loaded);
                if (planId) {
                    const existing = loaded.plans.find((item) => item.id === planId);
                    if (!existing) setNotFound(true);
                    else setPlan(existing);
                }
            })
            .catch((error) => setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not load pricing content.' }))
            .finally(() => setLoading(false));
    }, [planId]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        const plans = editing
            ? content.plans.map((item) => item.id === planId ? plan : item)
            : [...content.plans, plan];
        try {
            const response = await fetch('/api/management/site-content/pricing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...content, plans }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || `Could not ${editing ? 'save' : 'create'} pricing plan.`);
            router.push('/management/pricing');
            router.refresh();
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : `Could not ${editing ? 'save' : 'create'} pricing plan.` });
            setSaving(false);
        }
    }

    if (loading) return <LoadingState />;
    if (notFound) return <MissingPlan />;

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-16">
            <header>
                <Link href="/management/pricing" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Pricing</Link>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Public content</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">{editing ? 'Edit pricing plan' : 'Create pricing plan'}</h1>
                <p className="mt-1 text-slate-400">{editing ? 'Update this plan, its call to action, and public status.' : 'Add a new plan to the public Pricing page.'}</p>
            </header>

            <StatusMessage message={message} />

            <form onSubmit={submit} className="space-y-6">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-7">
                    <div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-sky-500/10 p-2 text-sky-400"><CircleDollarSign className="h-5 w-5" /></span><h2 className="font-bold text-white">Plan details</h2></div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <EditorField label="Plan name" value={plan.name} maxLength={80} placeholder="e.g. Community" onChange={(name) => setPlan({ ...plan, name })} />
                        <EditorField label="Price" value={plan.price} maxLength={80} placeholder="$0 or Free" onChange={(price) => setPlan({ ...plan, price })} />
                        <EditorField label="Price suffix" value={plan.cadence} maxLength={60} placeholder="/ month" required={false} onChange={(cadence) => setPlan({ ...plan, cadence })} />
                        <EditorField label="Button label" value={plan.ctaLabel} maxLength={60} onChange={(ctaLabel) => setPlan({ ...plan, ctaLabel })} />
                        <div className="sm:col-span-2"><EditorField label="Description" value={plan.description} maxLength={300} multiline placeholder="Describe who this plan is for." onChange={(description) => setPlan({ ...plan, description })} /></div>
                        <div className="sm:col-span-2"><EditorField label="Included features (one per line)" value={plan.features.join('\n')} multiline placeholder="First included feature" onChange={(value) => setPlan({ ...plan, features: value.split('\n') })} /></div>
                        <div className="sm:col-span-2"><EditorField label="Button URL" value={plan.ctaUrl} maxLength={500} placeholder="/dashboard or https://…" onChange={(ctaUrl) => setPlan({ ...plan, ctaUrl })} /></div>
                    </div>
                </section>

                <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:grid-cols-2 md:p-7">
                    <Toggle label="Visible on pricing page" description="Turn this off to keep the plan saved but hidden." checked={plan.enabled} onChange={(enabled) => setPlan({ ...plan, enabled })} />
                    <Toggle label="Available for selection" description="Unavailable plans stay visible with a disabled button." checked={plan.available} onChange={(available) => setPlan({ ...plan, available })} />
                    <Toggle label="Coming soon" description="Shows a coming-soon state and disables selection." checked={plan.comingSoon} onChange={(comingSoon) => setPlan({ ...plan, comingSoon })} />
                    <Toggle label="Show as recommended" description="Visually highlights this plan on the public page." checked={plan.featured} onChange={(featured) => setPlan({ ...plan, featured })} />
                </section>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
                    <Link href="/management/pricing" className="rounded-xl px-5 py-3 text-center text-sm font-bold text-slate-400 hover:text-white">Cancel</Link>
                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : editing ? 'Save plan' : 'Create plan'}</button>
                </div>
            </form>
        </div>
    );
}

function MissingPlan() {
    return <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/20 bg-red-500/10 px-8 py-10 text-center"><h1 className="text-2xl font-bold text-white">Pricing plan not found</h1><p className="mt-2 text-sm text-red-200">This plan may have been removed or its link is no longer valid.</p><Link href="/management/pricing" className="mt-6 inline-flex rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15">Back to Pricing</Link></div>;
}
