import { supabase } from '@/lib/supabase';

export const RO_LINK_SUPER_ADMIN_DISCORD_ID = '953414442060746854';

export async function getRoLinkStaffDiscordIds() {
    const staffIds = new Set<string>([RO_LINK_SUPER_ADMIN_DISCORD_ID]);

    const { data, error } = await supabase
        .from('management_users')
        .select(`
            discord_id,
            role:management_roles (
                permissions
            )
        `);

    if (error) {
        throw new Error(error.message);
    }

    for (const row of data || []) {
        const record = row as {
            discord_id?: unknown;
            role?: { permissions?: unknown } | { permissions?: unknown }[] | null;
        };
        const discordId = String(record.discord_id || '').trim();
        const role = Array.isArray(record.role) ? record.role[0] : record.role;
        const permissions = Array.isArray(role?.permissions) ? role.permissions.map(String) : [];

        if (discordId && (permissions.includes('MANAGE_MODULES') || permissions.includes('MANAGE_RO_LINK'))) {
            staffIds.add(discordId);
        }
    }

    return staffIds;
}

export function applyOfficialModuleLabels<T extends Record<string, unknown>>(rows: T[], staffDiscordIds: Set<string>) {
    return rows.map((row) => ({
        ...row,
        is_official_module: row.author_discord_id ? staffDiscordIds.has(String(row.author_discord_id)) : false,
    }));
}
