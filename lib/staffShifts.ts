import type { DashboardPermissions } from './gameAdmin';

export const SHIFT_PERIODS = [
    'day',
    'week',
    '30-days',
    '6-months',
    'latest-wave',
] as const;
export const SHIFT_REPORT_PERIODS = [...SHIFT_PERIODS, 'previous-wave'] as const;
export type ShiftReportPeriod = (typeof SHIFT_REPORT_PERIODS)[number];
export type ShiftPeriod = (typeof SHIFT_PERIODS)[number];
export interface ShiftSettings {
    enabled: boolean;
    automatic_start: boolean;
    wave_days: number;
    quota_hours: number;
}
export interface ShiftWave {
    id: string;
    starts_at: string;
    ends_at: string;
    quota_hours: number;
}
export interface StaffShiftSummary {
    discord_id: string;
    roblox_user_id: string;
    username: string;
    seconds: number;
    shift_count: number;
    wave_seconds: number;
    total_seconds: number;
    total_shifts: number;
    active: boolean;
    on_break?: boolean;
}
export interface StaffShift {
    id: string;
    discord_id: string;
    username: string;
    started_at: string;
    ended_at: string | null;
    last_seen_at: string;
    seconds: number;
    active: boolean;
}
export interface ShiftReport {
    control?: { state: 'break' | 'stopped'; since: string } | null;
    current_shift_seconds?: number;
    settings: ShiftSettings;
    wave: ShiftWave;
    staff: StaffShiftSummary[];
    shifts: StaffShift[];
    has_more: boolean;
}
export type PreviousWaveReport = Omit<ShiftReport, 'wave'> & { wave: ShiftWave | null };

export function canViewStaffShifts(perms: DashboardPermissions) {
    return perms.is_admin || perms.can_view_staff_shifts;
}
export function canManageStaffShifts(perms: DashboardPermissions) {
    return perms.is_admin || perms.can_manage_staff_shifts;
}
export function isShiftStaff(perms: DashboardPermissions) {
    return (
        Object.entries(perms).some(
            ([key, value]) => key !== 'allowed_misc_cmds' && value === true,
        ) || perms.allowed_misc_cmds.length > 0
    );
}
export function shiftHours(seconds: number) {
    return (Math.max(0, seconds) / 3600).toFixed(2);
}
export function shiftPeriodStart(period: ShiftPeriod, now: Date) {
    if (period === 'latest-wave') return null;
    const start = new Date(now);
    if (period === '6-months') {
        const day = start.getUTCDate();
        start.setUTCDate(1);
        start.setUTCMonth(start.getUTCMonth() - 6);
        const endOfMonth = new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
        ).getUTCDate();
        start.setUTCDate(Math.min(day, endOfMonth));
    } else {
        start.setTime(
            start.getTime() -
                { day: 1, week: 7, '30-days': 30 }[period] * 86400_000,
        );
    }
    return start.toISOString();
}
