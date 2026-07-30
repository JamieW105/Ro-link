'use client';

import { CalendarClock, ExternalLink, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
    SITE_BANNER_PLACEMENTS,
    SITE_BANNER_TONES,
    type SiteBanner,
    type SiteBannerPlacement,
    type SiteBannerTone,
} from '@/lib/siteBanners';

type BannerForm = {
    title: string;
    message: string;
    placement: SiteBannerPlacement;
    tone: SiteBannerTone;
    linkLabel: string;
    linkUrl: string;
    enabled: boolean;
    startsAt: string;
    endsAt: string;
};

const emptyForm: BannerForm = {
    title: '',
    message: '',
    placement: 'ALL',
    tone: 'INFO',
    linkLabel: '',
    linkUrl: '',
    enabled: true,
    startsAt: '',
    endsAt: '',
};

const placementLabels: Record<SiteBannerPlacement, string> = {
    PUBLIC: 'Public Pages',
    DASHBOARD: 'Dashboard',
    ALL: 'All Pages',
};

const placementHelp: Record<SiteBannerPlacement, string> = {
    PUBLIC: 'Pages that do not require sign in',
    DASHBOARD: 'Pages that require sign in',
    ALL: 'Every page across the site',
};

const toneLabels: Record<SiteBannerTone, string> = {
    INFO: 'Information',
    SUCCESS: 'Success',
    WARNING: 'Warning',
    CRITICAL: 'Critical',
};

function toLocalDateTime(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function SiteBannersPage() {
    const [banners, setBanners] = useState<SiteBanner[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<BannerForm>(emptyForm);

    const loadBanners = useCallback(async () => {
        setError('');
        try {
            const response = await fetch('/api/management/site-banners', { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to load site banners.');
            setBanners(Array.isArray(payload) ? payload : []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load site banners.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadBanners();
    }, [loadBanners]);

    function openCreate() {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setNotice('');
        setFormOpen(true);
    }

    function openEdit(banner: SiteBanner) {
        setEditingId(banner.id);
        setForm({
            title: banner.title,
            message: banner.message,
            placement: banner.placement,
            tone: banner.tone,
            linkLabel: banner.linkLabel || '',
            linkUrl: banner.linkUrl || '',
            enabled: banner.enabled,
            startsAt: toLocalDateTime(banner.startsAt),
            endsAt: toLocalDateTime(banner.endsAt),
        });
        setError('');
        setNotice('');
        setFormOpen(true);
    }

    async function saveBanner(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');

        try {
            const response = await fetch(
                editingId ? `/api/management/site-banners/${editingId}` : '/api/management/site-banners',
                {
                    method: editingId ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...form,
                        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
                        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
                    }),
                },
            );
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to save site banner.');

            setFormOpen(false);
            setNotice(editingId ? 'Site banner updated.' : 'Site banner created.');
            await loadBanners();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save site banner.');
        } finally {
            setSaving(false);
        }
    }

    async function removeBanner(banner: SiteBanner) {
        if (!confirm(`Delete "${banner.title}"? This cannot be undone.`)) return;
        setError('');
        setNotice('');

        const response = await fetch(`/api/management/site-banners/${banner.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            setError(payload.error || 'Failed to delete site banner.');
            return;
        }

        setNotice('Site banner deleted.');
        await loadBanners();
    }

    return (
        <div className="space-y-6 md:space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Site messaging</p>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">Site Banners</h1>
                    <p className="mt-1 text-slate-400">Publish themed notices to public pages, signed-in pages, or the whole site.</p>
                </div>
                <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New banner
                </button>
            </header>

            {(error || notice) && (
                <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-500/25 bg-red-500/10 text-red-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}>
                    {error || notice}
                </div>
            )}

            {loading ? (
                <div className="flex min-h-56 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                </div>
            ) : banners.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center">
                    <Megaphone className="mx-auto h-9 w-9 text-slate-600" aria-hidden="true" />
                    <h2 className="mt-4 font-bold text-white">No site banners yet</h2>
                    <p className="mt-1 text-sm text-slate-400">Create a banner when visitors need to see an important update.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {banners.map((banner) => (
                        <article key={banner.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
                            <div className="flex flex-col gap-5 md:flex-row md:items-start">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${banner.enabled ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                                            {banner.enabled ? 'Active' : 'Disabled'}
                                        </span>
                                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                                            {placementLabels[banner.placement]}
                                        </span>
                                        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            {toneLabels[banner.tone]}
                                        </span>
                                    </div>
                                    <h2 className="mt-4 text-lg font-bold text-white">{banner.title}</h2>
                                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{banner.message}</p>
                                    {(banner.startsAt || banner.endsAt) && (
                                        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                            <CalendarClock className="h-4 w-4" aria-hidden="true" />
                                            {banner.startsAt ? `Starts ${new Date(banner.startsAt).toLocaleString()}` : 'Starts immediately'}
                                            {' · '}
                                            {banner.endsAt ? `Ends ${new Date(banner.endsAt).toLocaleString()}` : 'No end date'}
                                        </p>
                                    )}
                                    {banner.linkLabel && banner.linkUrl && (
                                        <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300">
                                            {banner.linkLabel}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                        </a>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(banner)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-sky-500/40 hover:text-white">
                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit
                                    </button>
                                    <button onClick={() => void removeBanner(banner)} className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {formOpen && createPortal(
                <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={saveBanner}
                        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-slate-700 bg-[#080d18] p-5 shadow-2xl md:p-7"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="site-banner-dialog-title"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">{editingId ? 'Edit notice' : 'New notice'}</p>
                                <h2 id="site-banner-dialog-title" className="mt-1 text-xl font-bold text-white">{editingId ? 'Update site banner' : 'Create site banner'}</h2>
                            </div>
                            <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white" aria-label="Close">
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-5">
                            <label className="grid gap-2 text-sm font-semibold text-slate-300">
                                Title
                                <input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500" placeholder="Scheduled maintenance" />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold text-slate-300">
                                Message
                                <textarea required maxLength={500} rows={3} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500" placeholder="Tell visitors what they need to know." />
                            </label>

                            <fieldset>
                                <legend className="mb-2 text-sm font-semibold text-slate-300">Where it shows</legend>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {SITE_BANNER_PLACEMENTS.map((placement) => (
                                        <button type="button" key={placement} onClick={() => setForm({ ...form, placement })} className={`rounded-xl border p-3 text-left ${form.placement === placement ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'}`}>
                                            <span className="block text-sm font-bold text-white">{placementLabels[placement]}</span>
                                            <span className="mt-1 block text-[11px] leading-4 text-slate-500">{placementHelp[placement]}</span>
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            <label className="grid gap-2 text-sm font-semibold text-slate-300">
                                Style
                                <select value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value as SiteBannerTone })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500">
                                    {SITE_BANNER_TONES.map((tone) => <option key={tone} value={tone}>{toneLabels[tone]}</option>)}
                                </select>
                            </label>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                                    Link label <span className="font-normal text-slate-500">(optional)</span>
                                    <input maxLength={40} value={form.linkLabel} onChange={(event) => setForm({ ...form, linkLabel: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500" placeholder="View status" />
                                </label>
                                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                                    Link URL <span className="font-normal text-slate-500">(optional)</span>
                                    <input value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500" placeholder="https://status.rolink.cloud" />
                                </label>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                                    Starts <span className="font-normal text-slate-500">(optional)</span>
                                    <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500" />
                                </label>
                                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                                    Ends <span className="font-normal text-slate-500">(optional)</span>
                                    <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500" />
                                </label>
                            </div>

                            <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="h-4 w-4 accent-sky-500" />
                                <span>
                                    <span className="block text-sm font-bold text-white">Enabled</span>
                                    <span className="block text-xs text-slate-500">Show this banner while it is within its schedule.</span>
                                </span>
                            </label>
                        </div>

                        <div className="mt-7 flex justify-end gap-3 border-t border-slate-800 pt-5">
                            <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white">Cancel</button>
                            <button disabled={saving} className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50">
                                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create banner'}
                            </button>
                        </div>
                    </form>
                </div>,
                document.body,
            )}
        </div>
    );
}
