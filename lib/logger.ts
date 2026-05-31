
import { createClient } from '@supabase/supabase-js';
import { stringifyLogValue } from './logRecords';
import { resolveLinkedLogUserLabels, type LinkedLogUserLabel } from './logIdentity';

const supabaseParams = {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
};

import { supabase } from './supabase';

function formatDiscordLogActor(rawValue: string, linkedUser?: LinkedLogUserLabel) {
    if (!linkedUser?.mention) {
        return rawValue;
    }

    const normalizedRawValue = rawValue.toLowerCase();
    if (
        !rawValue
        || normalizedRawValue === linkedUser.mention.toLowerCase()
        || /^<@!?\d{17,20}>$/.test(rawValue)
        || linkedUser.identities.some((identity) => identity.toLowerCase() === normalizedRawValue)
    ) {
        return linkedUser.mention;
    }

    return `${linkedUser.mention} (${rawValue})`;
}

export async function logAction(server_id: string, action: string, target: unknown, moderator: unknown, reason: unknown = 'No reason provided') {
    try {
        const safeAction = stringifyLogValue(action, 'UNKNOWN');
        const safeTarget = stringifyLogValue(target, 'Unknown Target');
        const safeModerator = stringifyLogValue(moderator, 'System');
        const safeReason = stringifyLogValue(reason, 'No reason provided');

        console.log(`[LOGGER] Starting logAction for server ${server_id}, action ${safeAction}`);
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Use service role client if available, otherwise fallback to standard client
        const client = (url && serviceKey) ? createClient(url, serviceKey, supabaseParams) : supabase;
        const linkedUserLabels = await resolveLinkedLogUserLabels(client, [safeTarget, safeModerator]);
        const discordTarget = formatDiscordLogActor(safeTarget, linkedUserLabels.get(safeTarget.toLowerCase()));
        const discordModerator = formatDiscordLogActor(safeModerator, linkedUserLabels.get(safeModerator.toLowerCase()));

        // 1. Insert into Database
        const { error: dbError } = await client
            .from('logs')
            .insert([{
                server_id,
                action: safeAction,
                target: safeTarget,
                moderator: safeModerator,
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
        if (safeAction.includes('BAN')) color = 0xe74c3c; // Red
        else if (safeAction.includes('KICK')) color = 0xe67e22; // Orange
        else if (safeAction.includes('MUTE') || safeAction.includes('TIMEOUT')) color = 0xf1c40f; // Yellow
        else if (safeAction.includes('LOOKUP')) color = 0x9b59b6; // Purple
        else if (safeAction.includes('REPORT')) color = 0x2ecc71; // Green

        console.log(`[LOGGER] Sending Discord log to channel ${channelId}`);
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embeds: [{
                    title: `Action Log: ${safeAction}`,
                    color: color,
                    fields: [
                        { name: "Target", value: discordTarget || "N/A", inline: true },
                        { name: "Moderator", value: discordModerator || "System", inline: true },
                        { name: "Server", value: serverName, inline: true },
                        { name: "Reason", value: safeReason, inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: "Ro-Link Global Logger" }
                }]
            })
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[LOGGER] Discord API Error: ${res.status} - ${errBody}`);
            if (res.status === 403) {
                console.error(`[LOGGER] Bot cannot send to configured logging channel ${channelId} for server ${server_id}. Grant View Channel + Send Messages or pick a different channel in dashboard settings.`);
            }
        } else {
            console.log("[LOGGER] Discord log sent successfully");
        }

    } catch (e) {
        console.error("[LOGGER] Fatal error in logAction:", e);
    }
}
