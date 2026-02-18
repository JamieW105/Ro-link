import { supabase } from "./supabase";

export type ManagementPermission =
    | 'RO_LINK_DASHBOARD'
    | 'MANAGE_SERVERS'
    | 'POST_JOB_APPLICATION'
    | 'BLOCK_SERVERS'
    | 'MANAGE_RO_LINK';

export async function getManagementUser(discordId: string) {
    // Cherubdude is hardcoded super admin
    if (discordId === '953414442060746854') {
        return {
            discord_id: discordId,
            role: {
                name: 'Super Admin',
                permissions: [
                    'RO_LINK_DASHBOARD',
                    'MANAGE_SERVERS',
                    'POST_JOB_APPLICATION',
                    'BLOCK_SERVERS',
                    'MANAGE_RO_LINK'
                ] as ManagementPermission[]
            }
        };
    }

    const { data, error } = await supabase
        .from('management_users')
        .select(`
            discord_id,
            role:management_roles (
                name,
                permissions
            )
        `)
        .eq('discord_id', discordId)
        .single();

    if (error || !data) return null;
    return data;
}

export async function hasPermission(discordId: string, permission: ManagementPermission) {
    const user = await getManagementUser(discordId);
    if (!user) return false;

    // @ts-ignore
    const permissions = user.role?.permissions as string[] || [];
    return permissions.includes(permission) || permissions.includes('MANAGE_RO_LINK');
}
