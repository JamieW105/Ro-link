'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePermissions } from '@/context/PermissionsContext';
import type { ShiftSettings } from '@/lib/staffShifts';

const inputClass =
    'mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white';
export default function StaffShiftSettingsPage() {
    const serverId = String(useParams().id);
    const permissions = usePermissions();
    const canManage =
        permissions.is_admin || permissions.can_manage_staff_shifts;
    const [draft, setDraft] = useState<ShiftSettings | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const response = await fetch(
                    `/api/dashboard/staff-shifts?${new URLSearchParams({ serverId, settingsOnly: 'true' })}`,
                    { cache: 'no-store', signal },
                );
                const data = await response.json();
                if (!response.ok)
                    throw new Error(
                        data.error || 'Could not load shift settings.',
                    );
                setDraft(data.settings);
                setError('');
            } catch (error) {
                if (!signal?.aborted)
                    setError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load shift settings.',
                    );
            }
        },
        [serverId],
    );
    useEffect(() => {
        if (!canManage) return;
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load, canManage]);
    async function save(event: React.FormEvent) {
        event.preventDefault();
        if (!draft) return;
        setSaving(true);
        setNotice('');
        setError('');
        try {
            const response = await fetch(
                '/api/dashboard/staff-shifts/settings',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serverId, ...draft }),
                },
            );
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error || 'Could not save shift settings.');
            setNotice('Shift settings saved.');
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'Could not save shift settings.',
            );
        } finally {
            setSaving(false);
        }
    }
    if (!canManage)
        return (
            <p className="p-8 text-sm text-slate-400">
                You need Manage Staff Shift Settings permission to view this
                page.
            </p>
        );
    return (
        <div className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
            <Link
                href={`/dashboard/${serverId}/staff-shifts`}
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
                <ArrowLeft size={16} />
                Staff shifts
            </Link>
            <h1 className="text-2xl font-bold text-white">
                Staff shift settings
            </h1>
            {error && (
                <p role="alert" className="text-sm text-red-300">
                    {error}
                    {!draft && (
                        <button
                            type="button"
                            onClick={() => {
                                void load();
                            }}
                            className="ml-2 underline"
                        >
                            Retry
                        </button>
                    )}
                </p>
            )}
            {notice && (
                <p role="status" className="text-sm text-emerald-300">
                    {notice}
                </p>
            )}
            {!draft && !error && (
                <p className="text-sm text-slate-400">
                    Loading shift settings…
                </p>
            )}
            {draft && (
                <form onSubmit={save} className="space-y-8">
                    <fieldset
                        disabled={saving}
                        className="space-y-6 disabled:opacity-60"
                    >
                        <div className="space-y-5 border-b border-slate-800 pb-6">
                            <label className="flex items-center justify-between gap-6 text-sm text-white">
                                Staff shifts enabled
                                <input
                                    type="checkbox"
                                    checked={draft.enabled}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            enabled: event.target.checked,
                                        })
                                    }
                                    className="h-4 w-4 accent-yellow-400"
                                />
                            </label>
                            <label className="flex items-center justify-between gap-6 text-sm text-white">
                                Automatically start shifts when staff join the
                                game
                                <input
                                    type="checkbox"
                                    checked={draft.automatic_start}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            automatic_start:
                                                event.target.checked,
                                        })
                                    }
                                    className="h-4 w-4 accent-yellow-400"
                                />
                            </label>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2">
                            <label className="text-sm text-slate-300">
                                Shift wave length (days)
                                <input
                                    type="number"
                                    min={1}
                                    max={366}
                                    step={1}
                                    required
                                    value={draft.wave_days}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            wave_days: Number(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                    className={inputClass}
                                />
                            </label>
                            <label className="text-sm text-slate-300">
                                Quota per wave (hours)
                                <input
                                    type="number"
                                    min={0}
                                    max={8784}
                                    step="0.25"
                                    required
                                    value={draft.quota_hours}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            quota_hours: Number(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                    className={inputClass}
                                />
                            </label>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-500">
                            Wave length and quota changes apply to the next
                            wave. Disabling shifts ends active shifts and keeps
                            their history. A quota of zero means no quota.
                        </p>
                    </fieldset>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save shift settings'}
                    </button>
                </form>
            )}
        </div>
    );
}
