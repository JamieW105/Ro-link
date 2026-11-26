import { NextResponse } from 'next/server';
import {
    requireDashboardAccess,
    trimString,
} from '@/lib/serverDashboardAccess';
import { canManageStaffShifts } from '@/lib/staffShifts';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req: Request) {
    const body = await req.json().catch(() => null);
    const serverId = trimString(body?.serverId);
    if (!serverId)
        return NextResponse.json(
            { error: 'Server ID required.' },
            { status: 400 },
        );
    const access = await requireDashboardAccess(serverId, canManageStaffShifts);
    if ('error' in access) return access.error;
    if (
        typeof body.enabled !== 'boolean' ||
        typeof body.automatic_start !== 'boolean' ||
        !Number.isInteger(body.wave_days) ||
        body.wave_days < 1 ||
        body.wave_days > 366 ||
        typeof body.quota_hours !== 'number' ||
        !Number.isFinite(body.quota_hours) ||
        body.quota_hours < 0 ||
        body.quota_hours > 8784
    ) {
        return NextResponse.json(
            {
                error: 'Choose a wave of 1–366 days and a quota of 0–8784 hours.',
            },
            { status: 400 },
        );
    }
    const { error } = await getSupabaseAdmin().rpc('staff_shift_configure', {
        p_server: serverId,
        p_enabled: body.enabled,
        p_automatic: body.automatic_start,
        p_days: body.wave_days,
        p_quota: body.quota_hours,
    });
    if (error) {
        console.error('[Staff Shifts] Settings failed', error);
        return NextResponse.json(
            { error: 'Could not save staff shift settings.' },
            { status: 500 },
        );
    }
    return NextResponse.json({ ok: true });
}
