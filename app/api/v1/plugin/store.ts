// Temporary in-memory store instead of using Supabase SQL database
// This ensures the plugin API works locally without setting up the database tables.

const globalAny = global as any;

if (!globalAny.pluginStore) {
    globalAny.pluginStore = {
        // session_id -> { studio_user_id, status, token }
        sessions: new Map<string, any>(),

        // token -> { status }
        tokens: new Map<string, any>(),

        // game_id -> { configured, api_key }
        games: new Map<string, any>()
    };

    // Pre-populate a fake game for testing if needed
    // globalAny.pluginStore.games.set("123456789", { configured: true, api_key: "fake_api_key_123" });
}

export const pluginStore = globalAny.pluginStore;
