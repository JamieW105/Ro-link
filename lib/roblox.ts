import { supabase } from './supabase';

export async function sendRobloxMessage(serverId: string, command: string, args: any, serverData?: any) {
    try {
        // 1. Get Open Cloud Credentials
        let server = serverData;
        if (!server) {
            const { data: dbServer, error: serverError } = await supabase
                .from('servers')
                .select('universe_id, open_cloud_key')
                .eq('id', serverId)
                .single();

            if (serverError) {
                console.error('[MESSAGING] Failed to fetch server credentials:', serverError);
                return { success: false, error: 'Failed to fetch credentials' };
            }
            server = dbServer;
        }

        if (!server || !server.universe_id || !server.open_cloud_key) {
            console.error('[MESSAGING] Open Cloud not configured for server:', serverId);
            return { success: false, error: 'Open Cloud not configured' };
        }

        // 2. Publish to Roblox Messaging Service
        const messageBody = JSON.stringify({
            command,
            args,
            timestamp: Date.now()
        });

        const robloxRes = await fetch(
            `https://apis.roblox.com/messaging-service/v1/universes/${server.universe_id}/topics/AdminActions`,
            {
                method: 'POST',
                headers: {
                    'x-api-key': server.open_cloud_key.trim(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: messageBody })
            }
        );

        if (!robloxRes.ok) {
            const errorText = await robloxRes.text();
            console.error(`[OPEN CLOUD ERROR] Status: ${robloxRes.status} | Universe: ${server.universe_id}`, errorText);
            return { success: false, error: `Roblox API Error: ${robloxRes.status}` };
        }

        return { success: true };
    } catch (error) {
        console.error('[MESSAGING EXCEPTION]', error);
        return { success: false, error: String(error) };
    }
}
