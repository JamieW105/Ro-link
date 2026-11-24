const { randomBytes } = require('node:crypto');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} guildId
 * @returns {Promise<{ api_key: string | null } | null>}
 */
async function findSetupServer(client, guildId) {
    const { data, error } = await client
        .from('servers')
        .select('api_key')
        .eq('id', guildId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ id: string, place_id: string, universe_id: string, open_cloud_key: string }} server
 * @param {{ api_key: string | null } | null} existingServer
 */
async function saveSetupServer(client, server, existingServer) {
    const setup = { ...server, api_key: `rl_${randomBytes(16).toString('hex')}` };
    const servers = client.from('servers');
    const { error } = existingServer
        ? await saveIncompleteSetup(servers.update(setup).eq('id', server.id), existingServer.api_key)
        : await servers.upsert(setup, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;

    // Return the persisted key even if another submission completed setup first.
    const savedServer = await findSetupServer(client, server.id);
    const apiKey = savedServer?.api_key?.trim();
    if (!apiKey) throw new Error('The server has no setup key.');
    return apiKey;
}

function saveIncompleteSetup(query, previousKey) {
    return previousKey === null ? query.is('api_key', null) : query.eq('api_key', previousKey);
}

module.exports = { findSetupServer, saveSetupServer };
