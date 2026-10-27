'use client';
import { useSuccessNotice } from '@/hooks/use-success-notice';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/context/PermissionsContext';
import type { ShiftSettings } from '@/lib/staffShifts';

export default function StaffShiftSettingsPage() {
  const serverId = String(useParams().id);
  const permissions = usePermissions();
  const canManage = permissions.is_admin || permissions.can_manage_staff_shifts;
  const [draft, setDraft] = useState<ShiftSettings | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useSuccessNotice<string>('');
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
          throw new Error(data.error || 'Could not load shift settings.');
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
      const response = await fetch('/api/dashboard/staff-shifts/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, ...draft }),
      });
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
      <p className="text-sm text-muted-foreground">
        You need Manage Staff Shift Settings permission to view this page.
      </p>
    );
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/dashboard/${serverId}/staff-shifts`}>
          <ArrowLeft className="size-4" />
          Staff shifts
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3"><PageIcon name="shiftSettings" />
          Staff shift settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure tracking, wave length, and staff quotas.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {!draft && (
            <Button type="button" variant="link" onClick={() => void load()}>
              Retry
            </Button>
          )}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </p>
      )}
      {!draft && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading shift settings…
        </p>
      )}
      {draft && (
        <form onSubmit={save}>
          <Card>
            <CardHeader>
              <CardTitle>Shift tracking</CardTitle>
              <CardDescription>
                Choose how staff time is recorded in your linked game.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset
                disabled={saving}
                className="space-y-6 disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-1">
                    <label
                      htmlFor="shifts-enabled"
                      className="text-sm font-medium"
                    >
                      Staff shifts enabled
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Track time and progress for eligible staff.
                    </p>
                  </div>
                  <Switch
                    id="shifts-enabled"
                    checked={draft.enabled}
                    onCheckedChange={(enabled) =>
                      setDraft({ ...draft, enabled })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-6 border-b border-border pb-6">
                  <div className="space-y-1">
                    <label
                      htmlFor="automatic-start"
                      className="text-sm font-medium"
                    >
                      Automatically start shifts
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Start tracking when staff join the game.
                    </p>
                  </div>
                  <Switch
                    id="automatic-start"
                    checked={draft.automatic_start}
                    onCheckedChange={(automatic_start) =>
                      setDraft({ ...draft, automatic_start })
                    }
                  />
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    Shift wave length (days)
                    <Input
                      type="number"
                      min={1}
                      max={366}
                      step={1}
                      required
                      value={draft.wave_days}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          wave_days: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Quota per wave (hours)
                    <Input
                      type="number"
                      min={0}
                      max={8784}
                      step="0.25"
                      required
                      value={draft.quota_hours}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          quota_hours: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Wave length and quota changes apply to the next wave.
                  Disabling shifts ends active shifts and keeps their history. A
                  quota of zero means no quota.
                </p>
              </fieldset>
            </CardContent>
            <CardFooter className="border-t border-border pt-6">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save shift settings'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
