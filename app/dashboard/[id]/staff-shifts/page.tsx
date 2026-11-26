'use client';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock3, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Stat,
  StatLabel,
  StatValue,
  StatDescription,
} from '@/components/ui/stat';
import { Status, StatusIndicator } from '@/components/ui/status';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { usePermissions } from '@/context/PermissionsContext';
import {
  shiftHours,
  type ShiftReportPeriod,
  type PreviousWaveReport,
  type ShiftReport,
  type ShiftSettings,
  type ShiftWave,
} from '@/lib/staffShifts';

const periods: Array<{ value: ShiftReportPeriod; label: string }> = [
  { value: 'day', label: 'Past day' },
  { value: 'week', label: 'Past week' },
  { value: '30-days', label: 'Past 30 days' },
  { value: '6-months', label: 'Past 6 months' },
  { value: 'latest-wave', label: 'Latest wave' },
  { value: 'previous-wave', label: 'Previous wave' },
];
export default function StaffShiftsPage() {
  const { id } = useParams();
  const serverId = String(id);
  const perms = usePermissions();
  const canView = perms.is_admin || perms.can_view_staff_shifts;
  const canManage = perms.is_admin || perms.can_manage_staff_shifts;
  const [period, setPeriod] = useState<ShiftReportPeriod>('latest-wave');
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<ShiftReport | PreviousWaveReport | null>(
    null,
  );
  const [config, setConfig] = useState<{
    settings: ShiftSettings;
    wave: ShiftWave | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const params = new URLSearchParams({
          serverId,
          period,
          offset: String(offset),
          ...(!canView ? { settingsOnly: 'true' } : {}),
        });
        const response = await fetch(`/api/dashboard/staff-shifts?${params}`, {
          cache: 'no-store',
          signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || 'Could not load staff shifts.');
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
  const shortDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3"><PageIcon name="shifts" />
            Staff shifts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track staff activity, shift history, and progress toward each wave’s
            quota.
          </p>
        </div>
        {canManage && (
          <Button asChild variant="outline">
            <Link href={`/dashboard/${serverId}/staff-shifts/settings`}>
              <Settings className="size-4" />
              Shift settings
            </Link>
          </Button>
        )}
      </div>
      {error && (
        <Card
          role="alert"
          className="border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
          <Button type="button" variant="link" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading staff shifts…
        </p>
      )}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        {config && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {period === 'previous-wave' ? 'Previous wave' : 'Current wave'}
              </span>
              <Status variant={config.settings.enabled ? 'success' : 'warning'}>
                <StatusIndicator />
                {config.settings.enabled
                  ? 'Tracking enabled'
                  : 'Shifts disabled'}
              </Status>
            </div>
            {config.wave ? (
              <p className="text-sm text-muted-foreground">
                {shortDate(config.wave.starts_at)} –{' '}
                {shortDate(config.wave.ends_at)} ·{' '}
                {config.wave.quota_hours > 0
                  ? `${config.wave.quota_hours}h quota`
                  : 'No quota'}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No previous wave available yet.
              </p>
            )}
          </div>
        )}
        {canView && (
          <div className="w-full sm:w-52">
            <Select
              aria-label="Time period"
              value={period}
              options={periods}
              onValueChange={(value) => {
                setLoading(true);
                setReport(null);
                setPeriod(value as ShiftReportPeriod);
                setOffset(0);
              }}
            />
          </div>
        )}
      </Card>
      {canView && report?.wave && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat className="p-5">
              <StatLabel>
                {period === 'previous-wave'
                  ? 'Staff recorded'
                  : 'Staff on shift'}
              </StatLabel>
              <StatValue>
                {period === 'previous-wave'
                  ? report.staff.length
                  : report.staff.filter((staff) => staff.active).length}
              </StatValue>
              <StatDescription>
                {period === 'previous-wave'
                  ? 'With time in this wave'
                  : 'Currently tracking time'}
              </StatDescription>
            </Stat>
            <Stat className="p-5">
              <StatLabel>Hours recorded</StatLabel>
              <StatValue>
                {shiftHours(
                  report.staff.reduce((sum, staff) => sum + staff.seconds, 0),
                )}
              </StatValue>
              <StatDescription>In the selected period</StatDescription>
            </Stat>
            <Stat className="p-5">
              <StatLabel>Shifts recorded</StatLabel>
              <StatValue>
                {report.staff.reduce(
                  (sum, staff) => sum + staff.shift_count,
                  0,
                )}
              </StatValue>
              <StatDescription>Across your staff team</StatDescription>
            </Stat>
          </div>
          <Card aria-label="Staff activity" className="overflow-hidden">
            <CardHeader>
              <CardTitle>Staff activity</CardTitle>
              <CardDescription>
                Recorded time and progress toward the selected wave’s quota.
              </CardDescription>
            </CardHeader>
            <div className="hidden md:block">
              <Table>
                <caption className="sr-only">
                  Staff time and quota progress
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Staff</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Shifts</TableHead>
                    <TableHead className="w-1/3 px-6">Wave quota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.staff.map((staff) => (
                    <TableRow key={staff.discord_id}>
                      <TableCell className="space-y-2 px-6 py-5">
                        <p className="font-medium">{staff.username}</p>
                        <ShiftState
                          active={staff.active}
                          onBreak={staff.on_break}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {shiftHours(staff.seconds)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {staff.shift_count}
                      </TableCell>
                      <TableCell className="px-6">
                        <ShiftQuota
                          name={staff.username}
                          seconds={staff.wave_seconds}
                          quota={report.wave?.quota_hours ?? 0}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {report.staff.map((staff) => (
                <article key={staff.discord_id} className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <h2 className="text-sm font-medium">{staff.username}</h2>
                      <ShiftState
                        active={staff.active}
                        onBreak={staff.on_break}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {shiftHours(staff.seconds)}h · {staff.shift_count} shifts
                    </p>
                  </div>
                  <ShiftQuota
                    name={staff.username}
                    seconds={staff.wave_seconds}
                    quota={report.wave?.quota_hours ?? 0}
                  />
                </article>
              ))}
            </div>
            {report.staff.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
                <Users className="size-7" />
                <p className="text-sm">No staff shifts yet.</p>
              </div>
            )}
          </Card>
          <Card>
            <details className="group">
              <summary className="cursor-pointer p-6 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Shift history
              </summary>
              <CardContent>
                <div className="divide-y divide-border">
                  {report.shifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
                    >
                      <div>
                        <p className="font-medium">{shift.username}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(shift.started_at).toLocaleString()} –{' '}
                          {shift.active
                            ? 'On shift'
                            : new Date(
                                shift.ended_at || shift.last_seen_at,
                              ).toLocaleString()}
                        </p>
                      </div>
                      <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                        <Clock3 className="size-4" />
                        {shiftHours(shift.seconds)}h
                      </span>
                    </div>
                  ))}
                </div>
                {report.shifts.length === 0 && (
                  <p className="py-4 text-sm text-muted-foreground">
                    No shifts in this period.
                  </p>
                )}
                {(offset > 0 || report.has_more) && (
                  <div className="mt-4 flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || loading}
                      onClick={() => {
                        setLoading(true);
                        setOffset(Math.max(0, offset - 50));
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!report.has_more || loading}
                      onClick={() => {
                        setLoading(true);
                        setOffset(offset + 50);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </details>
          </Card>
        </>
      )}
      {!canView && (
        <Card className="p-5 text-sm text-muted-foreground">
          Your role can manage shift settings. Viewing staff time and history
          requires the View Staff Shifts permission.
        </Card>
      )}
    </div>
  );
}

function ShiftState({
  active,
  onBreak,
}: {
  active: boolean;
  onBreak?: boolean;
}) {
  return (
    <Status variant={onBreak ? 'warning' : active ? 'success' : 'default'}>
      <StatusIndicator />
      {onBreak ? 'On break' : active ? 'On shift' : 'Off shift'}
    </Status>
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
      <div className="flex justify-between gap-3 text-xs tabular-nums text-muted-foreground">
        <span>
          {shiftHours(seconds)} / {quota}h
        </span>
        <span>{quota > 0 ? `${Math.round(progress)}%` : 'No quota'}</span>
      </div>
      <Progress value={progress} aria-label={`${name} wave quota`} />
    </div>
  );
}
