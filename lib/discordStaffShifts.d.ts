import type { DashboardPermissions } from './gameAdmin';
import type { LivePlayer } from './livePlayers';
import type { ShiftPeriod } from './staffShifts';

export const SHIFT_COMMANDS: string[];
export function handleStaffShiftCommand(
    input: {
        serverId: string;
        userId: string;
        command: string;
        action?: string;
        period?: ShiftPeriod;
        page?: number;
    },
    dependencies: {
        db: ReturnType<typeof import('./supabaseAdmin').getSupabaseAdmin>;
        permissions: DashboardPermissions;
        normalizePlayers: (value: unknown) => LivePlayer[];
    },
): Promise<{
    content: string;
    flags: number;
    allowed_mentions: { parse: string[] };
    embeds?: object[];
}>;
