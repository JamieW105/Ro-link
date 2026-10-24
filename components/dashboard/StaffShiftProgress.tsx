'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Status, StatusIndicator } from '@/components/ui/status';
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
          error instanceof Error ? error.message : 'Could not load your shift.',
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
        error instanceof Error ? error.message : 'Could not update shift.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="w-full p-4" aria-label="Your staff shifts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Your staff shifts</h2>
        <Status
          variant={
            report?.control?.state === 'break'
              ? 'warning'
              : staff?.active
                ? 'success'
                : 'default'
          }
        >
          <StatusIndicator />
          {report?.control?.state === 'break'
            ? 'On break'
            : staff?.active
              ? 'On shift'
              : 'Off shift'}
        </Status>
      </div>
      {report ? (
        <>
          <div className="mb-2 mt-3 flex justify-between gap-3 text-xs tabular-nums text-muted-foreground">
            <span>Wave quota</span>
            <span>
              {hours.toFixed(2)} / {quota} hours
              {quota === 0 ? ' · No quota' : ''}
            </span>
          </div>
          <Progress value={progress} aria-label="Progress toward wave quota" />
          <p className="mt-2 text-xs text-muted-foreground">
            {shiftHours(staff?.total_seconds || 0)} total hours ·{' '}
            {staff?.total_shifts || 0} shifts
          </p>
          {!report.settings.enabled && (
            <p className="mt-1 text-xs text-muted-foreground">
              Staff shifts are disabled.
            </p>
          )}
          {report.settings.enabled && !report.settings.automatic_start && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={changeShift}
              disabled={busy}
            >
              {busy
                ? 'Updating…'
                : staff?.active
                  ? 'End shift'
                  : report.control?.state === 'break'
                    ? 'Resume shift'
                    : 'Start shift'}
            </Button>
          )}
        </>
      ) : (
        !error && (
          <p className="mt-3 text-xs text-muted-foreground">
            Loading your shift…
          </p>
        )
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
