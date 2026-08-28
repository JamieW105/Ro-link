import { getSupabaseAdmin } from './supabaseAdmin';

const SERVER_CHILD_TABLES = [
    'logs',
    'live_servers',
    'command_queue',
    'dashboard_roles',
    'reports',
    'server_addon_modules',
    'server_custom_modules',
] as const;

export async function deleteServerData(serverId: string, client = getSupabaseAdmin()) {
    for (const table of SERVER_CHILD_TABLES) {
        const { error } = await client
            .from(table)
            .delete()
            .eq('server_id', serverId);

        if (error) {
            throw new Error(`Failed to delete ${table}: ${error.message}`);
        }
    }

    const { error: serverDeleteError } = await client
        .from('servers')
        .delete()
        .eq('id', serverId);

    if (serverDeleteError) {
        throw new Error(`Failed to delete server configuration: ${serverDeleteError.message}`);
    }

    const { data: remainingServer, error: verificationError } = await client
        .from('servers')
        .select('id')
        .eq('id', serverId)
        .maybeSingle();

    if (verificationError) {
        throw new Error(`Failed to verify server deletion: ${verificationError.message}`);
    }

    if (remainingServer) {
        throw new Error('Failed to delete server configuration: the server record still exists.');
    }
}
