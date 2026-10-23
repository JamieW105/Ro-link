import { resolveDashboardUserPermissions } from './gameAdmin';
import { normalizeLivePlayerList } from './livePlayers';
import { isShiftStaff } from './staffShifts';
import { getSupabaseAdmin } from './supabaseAdmin';

// Discord roles are refreshed at most once a minute for each linked player.
const eligibility = new Map<string, { staff: boolean; expires: number }>();
async function isEligible(serverId: string, discordId: string) {
    const key = `${serverId}:${discordId}`;
    const cached = eligibility.get(key);
    if (cached && cached.expires > Date.now()) return cached.staff;
    const staff = isShiftStaff(
        await resolveDashboardUserPermissions(serverId, discordId),
    );
    if (eligibility.size > 5000) eligibility.clear();
    eligibility.set(key, { staff, expires: Date.now() + 60_000 });
    return staff;
}

export async function trackStaffShiftRoster(
    serverId: string,
    jobId: string,
    players: unknown,
    shutdown = false,
) {
    const db = getSupabaseAdmin();
    const { data: settings, error: settingsError } = await db
        .from('staff_shift_settings')
        .select('enabled')
        .eq('server_id', serverId)
        .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.enabled) return;
    const roster = shutdown ? [] : normalizeLivePlayerList(players);
    // Only immutable Roblox IDs from the authenticated game's roster identify staff.
    const ids = [
        ...new Set(
            roster
                .map((player) => player.userId)
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    const staff: Array<{
        discord_id: string;
        roblox_user_id: string;
        username: string;
    }> = [];
    if (ids.length) {
        const { data: users, error } = await db
            .from('verified_users')
            .select('discord_id, roblox_id, roblox_username')
            .in('roblox_id', ids);
        if (error) throw error;
        for (const user of users || []) {
            try {
                if (await isEligible(serverId, user.discord_id)) {
                    staff.push({
                        discord_id: user.discord_id,
                        roblox_user_id: String(user.roblox_id),
                        username: user.roblox_username,
                    });
                }
            } catch (error) {
                // Do not interpret a Discord outage as a leave and end a valid shift.
                if ((error as { status?: number }).status === 404) continue;
                throw error;
            }
        }
    }
    const { error } = await db.rpc('staff_shift_sync', {
        p_server: serverId,
        p_job: jobId,
        p_staff: staff,
    });
    if (error) throw error;
}
