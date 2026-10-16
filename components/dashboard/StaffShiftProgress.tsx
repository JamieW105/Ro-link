'use client';

import { useCallback, useEffect, useState } from 'react';
import { shiftHours, type ShiftReport } from '@/lib/staffShifts';

export default function StaffShiftProgress({ serverId }: { serverId: string }) {
    const [report, setReport] = useState<ShiftReport | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const response = await fetch(
                    `/api/dashboard/staff-shifts?serverId=${encodeURIComponent(serverId)}&self=true`,
                    { cache: 'no-store', signal },
                );
                const data = await response.json();
                if (!response.ok)
                    throw new Error(data.error || 'Could not load your shift.');
                setReport(data);
                setError('');
            } catch (error) {
                if (signal?.aborted) return;
                setError(
                    error instanceof Error
                        ? error.message
                        : 'Could not load your shift.',
                );
            }
        },
        [serverId],
    );
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        const timer = setInterval(() => {
            void load(controller.signal);
        }, 15_000);
        return () => {
            controller.abort();
            clearInterval(timer);
        };
    }, [load]);
    const staff = report?.staff[0];
    const hours = (staff?.wave_seconds || 0) / 3600;
    const quota = report?.wave.quota_hours || 0;
    const progress = quota > 0 ? Math.min(100, (hours / quota) * 100) : 0;
    async function changeShift() {
        setBusy(true);
        try {
            const response = await fetch('/api/dashboard/staff-shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    action: staff?.active ? 'stop' : 'start',
                }),
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error || 'Could not update shift.');
            await load();
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'Could not update shift.',
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="w-full lg:max-w-sm" aria-label="Your staff shifts">
            <div className="flex justify-between gap-4 text-xs font-bold text-white">
                <span>Your staff shifts</span>
                <span
                    className={
                        staff?.active ? 'text-emerald-400' : 'text-slate-400'
                    }
                >
                    {report?.control?.state === 'break'
                        ? 'On break'
                        : staff?.active
                          ? 'On shift'
                          : 'Off shift'}
                </span>
            </div>
            {report ? (
                <>
                    <div className="mt-3 flex justify-between gap-3 text-xs text-amber-200">
                        <span>Wave quota</span>
                        <span>
                            {hours.toFixed(2)} / {quota} hours
                            {quota === 0 ? ' · No quota' : ''}
                        </span>
                    </div>
                    <div
                        role="progressbar"
                        aria-label="Progress toward wave quota"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
                    >
                        <div
                            className="h-full rounded-full bg-yellow-400 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="mt-3 text-xs text-slate-300">
                        {shiftHours(staff?.total_seconds || 0)} total hours ·{' '}
                        {staff?.total_shifts || 0} shifts
                    </p>
                    {!report.settings.enabled && (
                        <p className="mt-1 text-xs text-slate-500">
                            Staff shifts are disabled.
                        </p>
                    )}
                    {report.settings.enabled &&
                        !report.settings.automatic_start && (
                            <button
                                type="button"
                                onClick={changeShift}
                                disabled={busy}
                                className="mt-3 rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-50"
                            >
                                {busy
                                    ? 'Updating…'
                                    : staff?.active
                                      ? 'End shift'
                                      : report.control?.state === 'break'
                                        ? 'Resume shift'
                                        : 'Start shift'}
                            </button>
                        )}
                </>
            ) : (
                !error && (
                    <p className="mt-3 text-xs text-slate-400">
                        Loading your shift…
                    </p>
                )
            )}
            {error && (
                <p role="alert" className="mt-2 text-xs text-red-300">
                    {error}
                </p>
            )}
        </section>
    );
}
