
import { createClient } from '@supabase/supabase-js';

const supabaseParams = {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
};

import { supabase } from './supabase';

export async function logAction(server_id: string, action: string, target: string, moderator: string, reason: string = 'No reason provided') {
    try {
        console.log(`[LOGGER] Starting logAction for server ${server_id}, action ${action}`);
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Use service role client if available, otherwise fallback to standard client
        const client = (url && serviceKey) ? createClient(url, serviceKey, supabaseParams) : supabase;

        // 1. Insert into Database
        const { error: dbError } = await client
            .from('logs')
            .insert([{
                server_id,
                action,
                target,
                moderator,
                timestamp: new Date().toISOString()
            }]);

        if (dbError) {
            console.error("[LOGGER] Failed to insert log into DB:", dbError);
        } else {
            console.log("[LOGGER] Database log inserted successfully");
        }

        // 2. Fetch Logging Channel ID
        const { data: serverData, error: serverError } = await client
            .from('servers')
            .select('logging_channel_id')
            .eq('id', server_id)
            .maybeSingle();

        if (serverError) {
            console.error("[LOGGER] Error fetching server logging config:", serverError);
            return;
        }
        if (!serverData?.logging_channel_id) {
            console.log(`[LOGGER] No logging channel configured for server ${server_id}`);
            return; // No logging channel configured
        }

        // 3. Send to Discord
        const channelId = serverData.logging_channel_id;
        const serverName = "Managed Server";

        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            console.error("[LOGGER] Missing DISCORD_TOKEN for logging");
            return;
        }

        // Determine Color based on Action
        let color = 0x3498db; // Blue (Default)
        if (action.includes('BAN')) color = 0xe74c3c; // Red
        else if (action.includes('KICK')) color = 0xe67e22; // Orange
        else if (action.includes('MUTE') || action.includes('TIMEOUT')) color = 0xf1c40f; // Yellow
        else if (action.includes('LOOKUP')) color = 0x9b59b6; // Purple
        else if (action.includes('REPORT')) color = 0x2ecc71; // Green

        console.log(`[LOGGER] Sending Discord log to channel ${channelId}`);
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
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
                        { name: "Server", value: serverName, inline: true },
                        { name: "Reason", value: reason, inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: "Ro-Link Global Logger" }
                }]
            })
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[LOGGER] Discord API Error: ${res.status} - ${errBody}`);
        } else {
            console.log("[LOGGER] Discord log sent successfully");
        }

    } catch (e) {
        console.error("[LOGGER] Fatal error in logAction:", e);
    }
}
