
import { createClient } from '@supabase/supabase-js';

const supabaseParams = {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
};

let supabaseAdminClient: any = null;

function getSupabaseAdmin() {
    if (supabaseAdminClient) return supabaseAdminClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.warn("Supabase Admin credentials missing. Logging will be disabled.");
        return null;
    }

    supabaseAdminClient = createClient(url, key, supabaseParams);
    return supabaseAdminClient;
}

export async function logAction(server_id: string, action: string, target: string, moderator: string) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) return;

        // 1. Insert into Database
        const { error } = await supabaseAdmin
            .from('logs')
            .insert([{
                server_id,
                action,
                target,
                moderator,
                timestamp: new Date().toISOString() // Ensure timestamp is set if not defaulted
            }]);

        if (error) {
            console.error("Failed to insert log into DB:", error);
            // Don't throw, try to log to Discord anyway ideally, or return failure.
        }

        // 2. Fetch Logging Channel ID
        const { data: serverData, error: serverError } = await supabaseAdmin
            .from('servers')
            .select('logging_channel_id, name')
            .eq('id', server_id)
            .single();

        if (serverError || !serverData || !serverData.logging_channel_id) {
            return; // No logging channel configured
        }

        // 3. Send to Discord
        const channelId = serverData.logging_channel_id;
        const serverName = serverData.name || "Unknown Server";

        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) return;

        // Determine Color based on Action
        let color = 0x3498db; // Blue (Default)
        if (action.includes('BAN')) color = 0xe74c3c; // Red
        else if (action.includes('KICK')) color = 0xe67e22; // Orange
        else if (action.includes('MUTE') || action.includes('TIMEOUT')) color = 0xf1c40f; // Yellow
        else if (action.includes('LOOKUP')) color = 0x9b59b6; // Purple
        else if (action.includes('REPORT')) color = 0x2ecc71; // Green

        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embeds: [{
                    title: `Action Log: ${action}`,
                    color: color,
                    fields: [
                        { name: "Target", value: target || "N/A", inline: true },
                        { name: "Moderator", value: moderator || "System", inline: true },
                        { name: "Server", value: serverName, inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: "Ro-Link Global Logger" }
                }]
            })
        });

    } catch (e) {
        console.error("Error in logAction:", e);
    }
}
