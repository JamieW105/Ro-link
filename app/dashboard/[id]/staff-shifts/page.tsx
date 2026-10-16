'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Settings, X } from 'lucide-react';
import { usePermissions } from '@/context/PermissionsContext';
import {
    shiftHours,
    type ShiftPeriod,
    type ShiftReport,
    type ShiftSettings,
    type ShiftWave,
} from '@/lib/staffShifts';

const periods: Array<{ value: ShiftPeriod; label: string }> = [
    { value: 'day', label: 'Past day' },
    { value: 'week', label: 'Past week' },
    { value: '30-days', label: 'Past 30 days' },
    { value: '6-months', label: 'Past 6 months' },
    { value: 'latest-wave', label: 'Latest wave' },
];
const inputClass =
    'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white';
export default function StaffShiftsPage() {
    const { id } = useParams();
    const serverId = String(id);
    const perms = usePermissions();
    const canView = perms.is_admin || perms.can_view_staff_shifts;
    const canManage = perms.is_admin || perms.can_manage_staff_shifts;
    const [period, setPeriod] = useState<ShiftPeriod>('latest-wave');
    const [offset, setOffset] = useState(0);
    const [report, setReport] = useState<ShiftReport | null>(null);
    const [config, setConfig] = useState<{
        settings: ShiftSettings;
        wave: ShiftWave;
    } | null>(null);
    const [draft, setDraft] = useState<ShiftSettings | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const settingsButton = useRef<HTMLButtonElement>(null);
    function closeSettings() {
        if (saving) return;
        setShowSettings(false);
        settingsButton.current?.focus();
    }
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const params = new URLSearchParams({
                    serverId,
                    period,
                    offset: String(offset),
                    ...(!canView ? { settingsOnly: 'true' } : {}),
                });
                const response = await fetch(
                    `/api/dashboard/staff-shifts?${params}`,
                    { cache: 'no-store', signal },
                );
                const data = await response.json();
                if (!response.ok)
                    throw new Error(
                        data.error || 'Could not load staff shifts.',
                    );
                if (canView) setReport(data);
                setConfig({ settings: data.settings, wave: data.wave });
                setError('');
            } catch (error) {
                if (signal?.aborted) return;
                setError(
                    error instanceof Error
                        ? error.message
                        : 'Could not load staff shifts.',
                );
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        [serverId, period, offset, canView],
    );
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        const timer = setInterval(() => {
            void load(controller.signal);
        }, 30_000);
        return () => {
            controller.abort();
            clearInterval(timer);
        };
    }, [load]);
    async function saveSettings(event: React.FormEvent) {
        event.preventDefault();
        if (!draft) return;
        setSaving(true);
        setError('');
        setNotice('');
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
                throw new Error(data.error || 'Could not save settings.');
            setShowSettings(false);
            settingsButton.current?.focus();
            setNotice('Shift settings saved.');
            await load();
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'Could not save settings.',
            );
        } finally {
            setSaving(false);
        }
    }
    const shortDate = (value: string) =>
        new Date(value).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    return (
        <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-white">Staff shifts</h1>
                {canManage && (
                    <button
                        type="button"
                        ref={settingsButton}
                        aria-label="Manage staff shift settings"
                        title="Manage staff shift settings"
                        disabled={!config}
                        onClick={() => {
                            setDraft({ ...config!.settings });
                            setShowSettings(true);
                        }}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
                    >
                        <Settings size={20} />
                    </button>
                )}
            </div>
            {error && (
                <p role="alert" className="text-sm text-red-300">
                    {error}{' '}
                    <button
                        className="underline"
                        onClick={() => {
                            void load();
                        }}
                    >
                        Retry
                    </button>
                </p>
            )}
            {notice && (
                <p role="status" className="text-sm text-emerald-300">
                    {notice}
                </p>
            )}
            {loading && (
                <p className="text-sm text-slate-400">Loading staff shifts…</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
                {config && (
                    <p className="text-sm text-slate-400">
                        {config.settings.enabled
                            ? 'Current wave'
                            : 'Shifts disabled'}
                        <span className="ml-2 text-slate-200">
                            {shortDate(config.wave.starts_at)} –{' '}
                            {shortDate(config.wave.ends_at)}
                        </span>
                        <span className="ml-2">
                            ·{' '}
                            {config.wave.quota_hours > 0
                                ? `${config.wave.quota_hours}h quota`
                                : 'No quota'}
                        </span>
                    </p>
                )}
                {canView && (
                    <label>
                        <span className="sr-only">Time period</span>
                        <select
                            value={period}
                            onChange={(event) => {
                                setLoading(true);
                                setReport(null);
                                setPeriod(event.target.value as ShiftPeriod);
                                setOffset(0);
                            }}
                            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                        >
                            {periods.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            {canView && report && (
                <>
                    <section
                        aria-label="Staff activity"
                        className="overflow-hidden rounded-xl border border-slate-800"
                    >
                        <table className="hidden w-full text-left text-sm md:table">
                            <caption className="sr-only">
                                Staff time and quota progress
                            </caption>
                            <thead className="border-b border-slate-800 text-xs text-slate-500">
                                <tr>
                                    <th className="px-5 py-4 font-medium">
                                        Staff
                                    </th>
                                    <th className="px-5 py-4 font-medium">
                                        Hours
                                    </th>
                                    <th className="px-5 py-4 font-medium">
                                        Shifts
                                    </th>
                                    <th className="w-1/3 px-5 py-4 font-medium">
                                        Wave quota
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                                {report.staff.map((staff) => (
                                    <tr key={staff.discord_id}>
                                        <td className="px-5 py-5">
                                            <span className="flex items-center gap-2 font-medium text-white">
                                                <span
                                                    role="img"
                                                    aria-label={
                                                        staff.on_break
                                                            ? 'On break'
                                                            : staff.active
                                                              ? 'On shift'
                                                              : 'Off shift'
                                                    }
                                                    className={`h-1.5 w-1.5 rounded-full ${staff.on_break ? 'bg-amber-400' : staff.active ? 'bg-emerald-400' : 'bg-slate-600'}`}
                                                />
                                                {staff.username}
                                            </span>
                                        </td>
                                        <td className="px-5 py-5 tabular-nums text-slate-300">
                                            {shiftHours(staff.seconds)}
                                        </td>
                                        <td className="px-5 py-5 tabular-nums text-slate-300">
                                            {staff.shift_count}
                                        </td>
                                        <td className="px-5 py-5">
                                            <ShiftQuota
                                                name={staff.username}
                                                seconds={staff.wave_seconds}
                                                quota={report.wave.quota_hours}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="divide-y divide-slate-800/70 md:hidden">
                            {report.staff.map((staff) => (
                                <article
                                    key={staff.discord_id}
                                    className="space-y-4 p-5"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="flex items-center gap-2 text-sm font-medium text-white">
                                            <span
                                                role="img"
                                                aria-label={
                                                    staff.on_break
                                                        ? 'On break'
                                                        : staff.active
                                                          ? 'On shift'
                                                          : 'Off shift'
                                                }
                                                className={`h-1.5 w-1.5 rounded-full ${staff.on_break ? 'bg-amber-400' : staff.active ? 'bg-emerald-400' : 'bg-slate-600'}`}
                                            />
                                            {staff.username}
                                        </h2>
                                        <p className="text-xs text-slate-400">
                                            {shiftHours(staff.seconds)}h ·{' '}
                                            {staff.shift_count} shifts
                                        </p>
                                    </div>
                                    <ShiftQuota
                                        name={staff.username}
                                        seconds={staff.wave_seconds}
                                        quota={report.wave.quota_hours}
                                    />
                                </article>
                            ))}
                        </div>
                        {report.staff.length === 0 && (
                            <p className="p-8 text-center text-sm text-slate-500">
                                No staff shifts yet.
                            </p>
                        )}
                    </section>
                    <details className="border-t border-slate-800 pt-5">
                        <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-white">
                            Shift history
                        </summary>
                        <div className="mt-4 divide-y divide-slate-800/70">
                            {report.shifts.map((shift) => (
                                <div
                                    key={shift.id}
                                    className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
                                >
                                    <div>
                                        <p className="text-slate-200">
                                            {shift.username}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {new Date(
                                                shift.started_at,
                                            ).toLocaleString()}{' '}
                                            –{' '}
                                            {shift.active
                                                ? 'On shift'
                                                : new Date(
                                                      shift.ended_at ||
                                                          shift.last_seen_at,
                                                  ).toLocaleString()}
                                        </p>
                                    </div>
                                    <span className="text-slate-400">
                                        {shiftHours(shift.seconds)}h
                                    </span>
                                </div>
                            ))}
                            {report.shifts.length === 0 && (
                                <p className="py-4 text-sm text-slate-500">
                                    No shifts in this period.
                                </p>
                            )}
                        </div>
                        {(offset > 0 || report.has_more) && (
                            <div className="mt-4 flex justify-between">
                                <button
                                    disabled={offset === 0}
                                    onClick={() => {
                                        setLoading(true);
                                        setOffset(Math.max(0, offset - 50));
                                    }}
                                    className="text-sm text-slate-400 disabled:opacity-30"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={!report.has_more}
                                    onClick={() => {
                                        setLoading(true);
                                        setOffset(offset + 50);
                                    }}
                                    className="text-sm text-slate-400 disabled:opacity-30"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </details>
                </>
            )}
            {!canView && (
                <p className="text-sm text-slate-500">
                    Your role can manage shift settings. Viewing staff time and
                    history requires the View Staff Shifts permission.
                </p>
            )}
            {showSettings && draft && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
                    onClick={() => {
                        closeSettings();
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="shift-settings-title"
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                closeSettings();
                            }
                            if (event.key !== 'Tab') return;
                            const controls = Array.from(
                                event.currentTarget.querySelectorAll<HTMLElement>(
                                    'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
                                ),
                            );
                            const first = controls[0];
                            const last = controls[controls.length - 1];
                            if (
                                event.shiftKey &&
                                document.activeElement === first
                            ) {
                                event.preventDefault();
                                last?.focus();
                            } else if (
                                !event.shiftKey &&
                                document.activeElement === last
                            ) {
                                event.preventDefault();
                                first?.focus();
                            }
                        }}
                        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <h2
                                id="shift-settings-title"
                                className="text-xl font-bold text-white"
                            >
                                Manage staff shifts
                            </h2>
                            <button
                                type="button"
                                autoFocus
                                aria-label="Close shift settings"
                                disabled={saving}
                                onClick={closeSettings}
                                className="text-slate-300"
                            >
                                <X />
                            </button>
                        </div>
                        <form onSubmit={saveSettings} className="space-y-5">
                            <label className="flex items-center justify-between gap-4 text-sm text-white">
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
                                    className="h-5 w-5 accent-yellow-400"
                                />
                            </label>
                            <label className="flex items-center justify-between gap-4 text-sm text-white">
                                Automatically start staff shifts when staff join
                                the game
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
                                    className="h-5 w-5 accent-yellow-400"
                                />
                            </label>
                            <label className="block text-sm text-slate-300">
                                Shift wave length (days)
                                <input
                                    type="number"
                                    required
                                    min={1}
                                    max={366}
                                    step={1}
                                    value={draft.wave_days}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            wave_days: Number(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                    className={`${inputClass} mt-2`}
                                />
                            </label>
                            <label className="block text-sm text-slate-300">
                                Quota per wave (hours)
                                <input
                                    type="number"
                                    required
                                    min={0}
                                    max={8784}
                                    step="0.25"
                                    value={draft.quota_hours}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            quota_hours: Number(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                    className={`${inputClass} mt-2`}
                                />
                            </label>
                            <p className="text-xs leading-relaxed text-slate-400">
                                Wave length and quota changes apply to the next
                                wave. Disabling shifts ends active shifts and
                                keeps their history. A quota of zero means no
                                quota.
                            </p>
                            {error && (
                                <p
                                    role="alert"
                                    className="text-sm text-red-300"
                                >
                                    {error}
                                </p>
                            )}
                            <button
                                disabled={saving}
                                className="w-full rounded-xl bg-yellow-400 p-3 font-bold text-slate-950 disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save shift settings'}
                            </button>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}

function ShiftQuota({
    name,
    seconds,
    quota,
}: {
    name: string;
    seconds: number;
    quota: number;
}) {
    const progress =
        quota > 0 ? Math.min(100, (seconds / (quota * 3600)) * 100) : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
                <span>
                    {shiftHours(seconds)} / {quota}h
                </span>
                <span>
                    {quota > 0 ? `${Math.round(progress)}%` : 'No quota'}
                </span>
            </div>
            <div
                role="progressbar"
                aria-label={`${name} wave quota`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-1 overflow-hidden rounded-full bg-slate-800"
            >
                <div
                    className="h-full rounded-full bg-yellow-400"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
