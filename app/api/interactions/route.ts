import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';

export const runtime = 'edge';

// ... (hexToUint8 and verifyDiscordRequest functions) ...

function hexToUint8(hex: string) {
    const cleanHex = hex.trim();
    const matches = cleanHex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array(0);
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

async function verifyDiscordRequest(request: Request) {
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
        console.error('Missing: ', { signature: !!signature, timestamp: !!timestamp, key: !!publicKey });
        return { isValid: false };
    }

    try {
        const body = await request.text();
        const encoder = new TextEncoder();
        const isValid = nacl.sign.detached.verify(
            encoder.encode(timestamp + body),
            hexToUint8(signature),
            hexToUint8(publicKey)
        );

        console.log(`[VERIFY] Result: ${isValid} | TS: ${timestamp}`);
        return { isValid, body };
    } catch (e) {
        console.error('Verify Exception:', e);
        return { isValid: false };
    }
}



export async function POST(req: Request) {
    try {
        const { isValid, body } = await verifyDiscordRequest(req);

        if (!isValid || !body) {
            return new NextResponse('Invalid request signature', { status: 401 });
        }

        const interaction = JSON.parse(body);
        const { type, guild_id, member, user: interactionUser } = interaction;
        const user = interactionUser || member?.user;
        const userTag = user ? `${user.username}${user.discriminator !== '0' ? '#' + user.discriminator : ''}` : 'Unknown';

        // Helper to trigger Messaging Service
        const triggerMessaging = async (command: string, args: any, serverData: any = null) => {
            if (!guild_id) return;
            await sendRobloxMessage(guild_id, command, args, serverData);
        };

        // 2. Handle PING
        if (type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 3. Handle Application Commands
        if (type === 2) {
            const { name, options } = interaction.data;

            // Handle Setup (Owner Only)
            if (name === 'setup') {
                if (!guild_id) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ This command can only be used in a Discord Server.`, flags: 64 }
                    });
                }

                // Verify Owner via Discord API
                const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guild_id}`, {
                    headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
                });

                if (!guildRes.ok) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to verify server owner status.`, flags: 64 }
                    });
                }

                const guildData = await guildRes.json();
                if (user.id !== guildData.owner_id) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ This command can only be run by the server owner.`, flags: 64 }
                    });
                }

                // Check if already setup
                const { data: existingServer } = await supabase
                    .from('servers')
                    .select('*')
                    .eq('id', guild_id)
                    .maybeSingle();

                if (existingServer) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: 'ℹ️ **This server is already set up!** Here are your integration details:',
                            embeds: getSetupEmbeds(guild_id, existingServer.api_key),
                            flags: 64
                        }
                    });
                }

                // Return Modal
                return NextResponse.json({
                    type: 9,
                    data: {
                        title: 'Ro-Link Server Setup',
                        custom_id: 'setup_modal',
                        components: [
                            {
                                type: 1,
                                components: [{
                                    type: 4,
                                    custom_id: 'place_id',
                                    label: 'Roblox Place ID',
                                    style: 1,
                                    placeholder: 'Enter your Roblox Place ID (e.g. 123456789)',
                                    required: true
                                }]
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4,
                                    custom_id: 'universe_id',
                                    label: 'Roblox Universe ID',
                                    style: 1,
                                    placeholder: 'Enter your Roblox Universe ID',
                                    required: true
                                }]
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4,
                                    custom_id: 'api_key',
                                    label: 'Roblox Open Cloud API Key',
                                    style: 2,
                                    placeholder: 'Paste your API Key here (Secure)',
                                    required: true
                                }]
                            }
                        ]
                    }
                });
            }

            // Handle 'ping' command immediately (No DB required)
            if (name === 'ping') {
                const timestamp = Number(BigInt(interaction.id) >> 22n) + 1420070400000;
                const latency = Math.abs(Date.now() - timestamp);
                return NextResponse.json({
                    type: 4,
                    data: { content: `🏓 **Pong!**\nLatency: \`${latency}ms\`\nInstance: \`Vercel Edge (Australia/Sydney)\`` }
                });
            }

            // Handle 'help' command
            if (name === 'help') {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: 'Ro-Link System Information',
                                description: "Welcome to **Ro-Link**, the premium bridge between Discord and Roblox. Manage your community with seamless integration, powerful moderation tools, and real-time data syncing.\n\n**Note:** To setup your server, use `/setup`.",
                                url: baseUrl,
                                color: 0x2b2d31,
                                thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                                fields: [
                                    {
                                        name: '**Management Commands**',
                                        value: "`/setup` - Initialize the bridge (Owner Only)\n`/update` - Global Server Soft-Shutdown\n`/shutdown` - Emergency Server Shutdown",
                                        inline: false
                                    },
                                    {
                                        name: '**Moderation Commands**',
                                        value: "`/ban` - Permanently ban a user\n`/kick` - Kick a user from the server\n`/unban` - Revoke a ban\n`/misc` - Player actions (Fly, Heal, etc.)",
                                        inline: false
                                    },
                                    {
                                        name: '**Utility Commands**',
                                        value: "`/get-discord` - Find Discord from Roblox\n`/get-roblox` - Find Roblox from Discord\n`/verify` - Link your account",
                                        inline: false
                                    }
                                ],
                                footer: { text: 'Ro-Link Systems • Premium Integration', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                                timestamp: new Date().toISOString()
                            }
                        ]
                    }
                });
            }

            if (name === 'verify') {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: 'Account Verification',
                            description: 'Link your Roblox account to unlock all features.',
                            color: 0x2b2d31,
                            thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            fields: [
                                { name: 'Step 1', value: `Navigate to [**Verification Portal**](${baseUrl}/verify)`, inline: true },
                                { name: 'Step 2', value: 'Log in with Discord', inline: true },
                                { name: 'Step 3', value: 'Authorize Roblox', inline: true }
                            ],
                            footer: { text: 'Ro-Link Systems • Verification', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            timestamp: new Date().toISOString()
                        }],
                        components: [{
                            type: 1,
                            components: [{
                                type: 2,
                                style: 5,
                                label: 'Open Verification Portal',
                                url: `${baseUrl}/verify`
                            }]
                        }],
                        flags: 64
                    }
                });
            }

            if (name === 'get-discord') {
                const robloxUsername = options?.find((o: any) => o.name === 'roblox_username')?.value;
                const { data, error } = await supabase
                    .from('verified_users')
                    .select('*')
                    .ilike('roblox_username', robloxUsername)
                    .maybeSingle();

                if (error || !data) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ No Discord account found for **${robloxUsername}**.`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `Player Lookup: ${data.roblox_username}`,
                            color: 0x2b2d31,
                            thumbnail: { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${data.roblox_id}&width=420&height=420&format=png` },
                            fields: [
                                { name: 'Roblox Account', value: `[${data.roblox_username}](https://www.roblox.com/users/${data.roblox_id}/profile)\n\`ID: ${data.roblox_id}\``, inline: true },
                                { name: 'Discord Account', value: `<@${data.discord_id}>\n\`ID: ${data.discord_id}\``, inline: true },
                                { name: 'Linked Date', value: `<t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`, inline: false }
                            ],
                            footer: { text: 'Ro-Link Systems • Lookup Service' },
                            timestamp: new Date().toISOString()
                        }]
                    }
                });
            }

            if (name === 'get-roblox') {
                const discordUserId = options?.find((o: any) => o.name === 'discord_user')?.value;
                const { data, error } = await supabase
                    .from('verified_users')
                    .select('*')
                    .eq('discord_id', discordUserId)
                    .maybeSingle();

                if (error || !data) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ No Roblox account found for <@${discordUserId}>.`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `Player Lookup`,
                            color: 0x2b2d31,
                            thumbnail: { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${data.roblox_id}&width=420&height=420&format=png` },
                            fields: [
                                { name: 'Discord Account', value: `<@${data.discord_id}>\n\`ID: ${data.discord_id}\``, inline: true },
                                { name: 'Roblox Account', value: `[${data.roblox_username}](https://www.roblox.com/users/${data.roblox_id}/profile)\n\`ID: ${data.roblox_id}\``, inline: true },
                                { name: 'Linked Date', value: `<t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`, inline: false }
                            ],
                            footer: { text: 'Ro-Link Systems • Lookup Service' },
                            timestamp: new Date().toISOString()
                        }]
                    }
                });
            }

            if (name === 'report') {
                const { data: server, error: serverError } = await supabase
                    .from('servers')
                    .select('reports_enabled')
                    .eq('id', guild_id)
                    .single();

                if (serverError || !server?.reports_enabled) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ The report system is currently **DISABLED** in this server.`, flags: 64 }
                    });
                }

                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: 'Player Reporting System',
                            description: 'Submit a report against a player for rule violations. All reports are reviewed by server moderators.',
                            color: 0xff4444,
                            thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            fields: [
                                { name: 'Warning', value: "False reporting or misuse of this system may result in a ban from the bot and server.", inline: false },
                                { name: 'Process', value: "1. Click the button below\n2. Enter the Roblox Username\n3. Describe the incident and provide proof if possible", inline: false }
                            ],
                            footer: { text: 'Ro-Link Systems • Reports', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
                            timestamp: new Date().toISOString()
                        }],
                        components: [{
                            type: 1,
                            components: [{
                                type: 2,
                                style: 4, // Danger/Red
                                label: 'Create Report',
                                custom_id: 'report_open',
                                emoji: { name: '🚨' }
                            }]
                        }],
                        flags: 64
                    }
                });
            }


            const permissions = BigInt(member?.permissions || '0');
            const hasPerms = (permissions & 0x2n) !== 0n || (permissions & 0x4n) !== 0n || (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;

            if (!hasPerms) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ You do not have permission to use this command. (Requires Kick/Ban Members or Admin)`, flags: 64 }
                });
            }

            // Check if server is setup
            if (!guild_id) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ This command can only be used in a Discord Server.`, flags: 64 }
                });
            }

            const { data: server, error: serverError } = await supabase
                .from('servers')
                .select('*')
                .eq('id', guild_id)
                .maybeSingle();

            if (serverError || !server) {
                console.error(`[AUTH] Server check failed for ${guild_id}:`, serverError);
                return NextResponse.json({
                    type: 4,
                    data: {
                        content: `❌ This server is not set up with Ro-Link yet.\n\n**Server Owners** can use \`/setup\` to initialize it directly, or visit the dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guild_id}`,
                        flags: 64
                    }
                });
            }

            const targetUser = options?.find((o: any) => o.name === 'username')?.value;
            const jobId = options?.find((o: any) => o.name === 'job_id')?.value;
            const reason = options?.find((o: any) => o.name === 'reason')?.value || 'No reason provided';

            let message = '';
            if (name === 'ban') {
                // Parallelize Operations
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: name.toUpperCase(),
                        args: { username: targetUser, reason: 'Discord Command', moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging(name.toUpperCase(), { username: targetUser, reason: 'Discord Command', moderator: userTag }, server),
                    supabase.from('logs').insert([{
                        server_id: guild_id,
                        action: name.toUpperCase(),
                        target: targetUser,
                        moderator: userTag
                    }])
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🔨 **Banned** \`${targetUser}\` from Roblox game.`;
            }
            else if (name === 'kick') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'KICK',
                        args: { username: targetUser, reason: 'Discord Command', moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('KICK', { username: targetUser, reason: 'Discord Command', moderator: userTag }, server),
                    supabase.from('logs').insert([{
                        server_id: guild_id,
                        action: 'KICK',
                        target: targetUser,
                        moderator: userTag
                    }])
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🥾 **Kicked** \`${targetUser}\` from Roblox server.`;
            }
            else if (name === 'unban') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'UNBAN',
                        args: { username: targetUser, reason: 'Discord Command', moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('UNBAN', { username: targetUser, reason: 'Discord Command', moderator: userTag }, server),
                    supabase.from('logs').insert([{
                        server_id: guild_id,
                        action: 'UNBAN',
                        target: targetUser,
                        moderator: userTag
                    }])
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🔓 **Unbanned** \`${targetUser}\` from Roblox.`;
            }
            else if (name === 'update') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'UPDATE',
                        args: { reason: "Manual Update Triggered", moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('UPDATE', { reason: "Manual Update Triggered", moderator: userTag }, server),
                    supabase.from('logs').insert([{
                        server_id: guild_id,
                        action: 'UPDATE',
                        target: 'ALL',
                        moderator: userTag
                    }])
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                message = `🚀 **Update Signal Sent**! All game servers will restart shortly.`;
            }
            else if (name === 'shutdown') {
                const [queueRes] = await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: 'SHUTDOWN',
                        args: { job_id: jobId, moderator: userTag },
                        status: 'PENDING'
                    }]),
                    triggerMessaging('SHUTDOWN', { job_id: jobId, moderator: userTag }, server),
                    supabase.from('logs').insert([{
                        server_id: guild_id,
                        action: 'SHUTDOWN',
                        target: jobId || 'ALL',
                        moderator: userTag
                    }])
                ]);

                if (queueRes.error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                const targetMsg = jobId ? `server \`${jobId}\`` : 'all active game servers';
                message = `🛑 **SHUTDOWN SIGNAL SENT**! Closing ${targetMsg}.`;
            }

            else if (name === 'misc') {
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: 'Miscellaneous Actions',
                            description: 'Select an action from the menu below to apply it to a Roblox player.',
                            color: 0x2b2d31,
                            fields: [
                                { name: 'Movement', value: "`FLY` `NOCLIP`", inline: true },
                                { name: 'Visibility', value: "`INVIS` `GHOST`", inline: true },
                                { name: 'Vitality', value: "`HEAL` `KILL` `RESET`", inline: true },
                                { name: 'Identity', value: "`SET_CHAR` `REFRESH`", inline: true }
                            ],
                            footer: { text: 'Ro-Link Systems • Admin Tools' },
                            timestamp: new Date().toISOString()
                        }],
                        flags: 64,
                        components: [{
                            type: 1,
                            components: [{
                                type: 3,
                                custom_id: `misc_menu`,
                                placeholder: 'Choose an action...',
                                options: [
                                    { label: 'Fly', value: 'FLY', description: 'Enable flight for the player' },
                                    { label: 'Noclip', value: 'NOCLIP', description: 'Allow player to walk through walls' },
                                    { label: 'Invis', value: 'INVIS', description: 'Make the player invisible' },
                                    { label: 'Ghost', value: 'GHOST', description: 'Apply a ForceField material' },
                                    { label: 'Set Character', value: 'SET_CHAR', description: 'Change appearance' },
                                    { label: 'Heal', value: 'HEAL', description: 'Restore health' },
                                    { label: 'Kill', value: 'KILL', description: 'Instant kill' },
                                    { label: 'Reset', value: 'RESET', description: 'Reset character' },
                                    { label: 'Refresh', value: 'REFRESH', description: 'Refresh character' }
                                ]
                            }]
                        }]
                    }
                });
            }


            return NextResponse.json({
                type: 4,
                data: { content: message }
            });
        }

        // Handle Button Clicks (Vercel)
        if (type === 3) {
            // Public Button: Report Form
            if (interaction.data.custom_id === 'report_open') {
                return NextResponse.json({
                    type: 9,
                    data: {
                        title: "Submit Player Report",
                        custom_id: "report_submit",
                        components: [{
                            type: 1,
                            components: [{
                                type: 4,
                                custom_id: "target_input",
                                label: "Roblox User or Discord ID",
                                style: 1,
                                min_length: 3,
                                max_length: 32,
                                placeholder: "Username or User ID",
                                required: true
                            }]
                        }, {
                            type: 1,
                            components: [{
                                type: 4,
                                custom_id: "reason",
                                label: "Reason & Evidence",
                                style: 2,
                                min_length: 10,
                                max_length: 1000,
                                placeholder: "Describe what happened...",
                                required: true
                            }]
                        }]
                    }
                });
            }

            // Permission Check for buttons
            const permissions = BigInt(member?.permissions || '0');
            const hasPerms = (permissions & 0x2n) !== 0n || (permissions & 0x4n) !== 0n || (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;


            if (!hasPerms) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ You do not have permission to use this button.`, flags: 64 }
                });
            }

            if (interaction.data.custom_id === 'misc_menu') {
                const action = interaction.data.values[0];

                const components = [{
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'target_user',
                        label: "Target Username",
                        style: 1,
                        placeholder: 'Enter the Roblox username',
                        required: true
                    }]
                }];

                if (action === 'SET_CHAR') {
                    components.push({
                        type: 1,
                        components: [{
                            type: 4,
                            custom_id: 'char_user',
                            label: "Character Username",
                            style: 1,
                            placeholder: 'Username of appearance to copy',
                            required: true
                        }]
                    });
                }

                return NextResponse.json({
                    type: 9,
                    data: {
                        title: `Action: ${action}`,
                        custom_id: `misc_modal_${action}`,
                        components: components
                    }
                });
            }

            if (interaction.data.custom_id.startsWith('switch_')) {
                const isRoblox = interaction.data.custom_id.startsWith('switch_roblox');
                const target = interaction.data.custom_id.split('_').pop();

                const components = [{
                    type: 1,
                    components: isRoblox ? [
                        { type: 2, style: 2, label: 'Kick (Roblox)', custom_id: `KICK_0_${target}` },
                        { type: 2, style: 4, label: 'Ban (Roblox)', custom_id: `BAN_0_${target}` },
                        { type: 2, style: 1, label: 'Discord Actions', custom_id: `switch_discord_${target}` }
                    ] : [
                        { type: 2, style: 2, label: 'Kick (Discord)', custom_id: `discord_kick_${target}` },
                        { type: 2, style: 4, label: 'Ban (Discord)', custom_id: `discord_ban_${target}` },
                        { type: 2, style: 1, label: 'Roblox Actions', custom_id: `switch_roblox_${target}` }
                    ]
                }];

                return NextResponse.json({
                    type: 7, // UPDATE_MESSAGE
                    data: { components }
                });
            }

            if (interaction.data.custom_id.startsWith('discord_')) {
                const parts = interaction.data.custom_id.split('_');
                const discAction = parts[1]; // kick or ban
                const target = parts.slice(2).join('_');

                let targetId = target;
                if (target.includes('<@')) {
                    targetId = target.replace(/[<@!>]/g, '');
                }

                // If not numeric, it might be a username, try resolving
                if (isNaN(Number(targetId))) {
                    const { data } = await supabase.from('verified_users').select('discord_id').ilike('roblox_username', target).maybeSingle();
                    if (data) targetId = data.discord_id;
                }

                if (isNaN(Number(targetId))) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Could not resolve Discord ID for \`${target}\`.`, flags: 64 }
                    });
                }

                const res = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/${discAction === 'ban' ? 'bans' : 'members'}/${targetId}`, {
                    method: discAction === 'ban' ? 'PUT' : 'DELETE',
                    headers: {
                        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: discAction === 'ban' ? JSON.stringify({ reason: 'Ro-Link Reporting Action' }) : undefined
                });

                if (!res.ok) {
                    const err = await res.text();
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to ${discAction} user: ${err}`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: { content: `✅ Successfully **${discAction.toUpperCase()}ED** <@${targetId}> from the server.`, flags: 64 }
                });
            }

            const customId = interaction.data.custom_id;
            const parts = customId.split('_');
            const action = parts[0];
            const userId = parts[1];
            const username = parts.slice(2).join('_');

            // Parallelize Button Actions
            await Promise.all([
                supabase.from('command_queue').insert([{
                    server_id: guild_id,
                    command: action.toUpperCase(),
                    args: { username, reason: 'Discord Button Action', moderator: userTag },
                    status: 'PENDING'
                }]),
                triggerMessaging(action.toUpperCase(), { username, reason: 'Discord Button Action', moderator: userTag }), // Will fetch server internally
                supabase.from('logs').insert([{
                    server_id: guild_id,
                    action: action.toUpperCase(),
                    target: username,
                    moderator: userTag
                }])
            ]);

            return NextResponse.json({
                type: 4,
                data: { content: `✅ **${action.toUpperCase()}** command queued for \`${username}\`.`, flags: 64 }
            });
        }

        // Handle Modal Submissions (Vercel)
        if (type === 5) {
            const { custom_id, components: modalComponents } = interaction.data;

            if (custom_id.startsWith('misc_modal_')) {
                const action = custom_id.replace('misc_modal_', '');

                const getField = (id: string) => {
                    const row = modalComponents.find((c: any) => c.components.some((ic: any) => ic.custom_id === id));
                    return row ? row.components.find((ic: any) => ic.custom_id === id).value : '';
                };

                const targetUser = getField('target_user');
                let args: any = { username: targetUser, moderator: userTag };
                let msgContent = `✅ Queuing **${action}** for **${targetUser}**...`;

                if (action === 'SET_CHAR') {
                    const charUser = getField('char_user');
                    args.char_user = charUser;
                    msgContent = `✅ Queuing **Set Character** (to ${charUser}) for **${targetUser}**...`;
                }

                await Promise.all([
                    supabase.from('command_queue').insert([{
                        server_id: guild_id,
                        command: action,
                        args: args,
                        status: 'PENDING'
                    }]),
                    triggerMessaging(action, args),
                    supabase.from('logs').insert([{
                        server_id: guild_id,
                        action: action,
                        target: targetUser,
                        moderator: userTag
                    }])
                ]);

                return NextResponse.json({
                    type: 4,
                    data: { content: msgContent, flags: 64 }
                });
            }

            if (custom_id === 'report_submit') {
                const getField = (id: string) => {
                    const row = modalComponents.find((c: any) => c.components.some((ic: any) => ic.custom_id === id));
                    return row ? row.components.find((ic: any) => ic.custom_id === id).value : '';
                };

                const targetInput = getField('target_input');
                const reason = getField('reason');

                // 1. Save to Database
                const { error: dbError } = await supabase.from('reports').insert([{
                    server_id: guild_id,
                    reporter_discord_id: member?.user?.id || interactionUser?.id,
                    reporter_roblox_username: null,
                    reported_roblox_username: targetInput,
                    reason: reason,
                    status: 'PENDING'
                }]);

                if (dbError) {
                    console.error('Report DB Error:', dbError);
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to submit report. Please try again later.`, flags: 64 }
                    });
                }

                // 2. Send Notification to Channel (if configured)
                const { data: server } = await supabase
                    .from('servers')
                    .select('reports_channel_id, moderator_role_id')
                    .eq('id', guild_id)
                    .single();

                if (server?.reports_channel_id) {
                    console.log(`[REPORTS] Forwarding report to channel: ${server.reports_channel_id}`);
                    const roleMention = server.moderator_role_id ? `<@&${server.moderator_role_id}>` : '';

                    fetch(`https://discord.com/api/v10/channels/${server.reports_channel_id}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: roleMention,
                            embeds: [{
                                title: '🚨 New User Report',
                                color: 0xff4444,
                                fields: [
                                    { name: 'Reported User', value: `\`${targetInput}\``, inline: true },
                                    { name: 'Reporter', value: `<@${member?.user?.id || interactionUser?.id}>`, inline: true },
                                    { name: 'Reason', value: reason }
                                ],
                                footer: { text: `Ro-Link Systems • ID: ${guild_id}` },
                                timestamp: new Date().toISOString()
                            }],
                            components: [{
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        style: 2,
                                        label: 'Kick (Discord)',
                                        custom_id: `discord_kick_${targetInput}`
                                    },
                                    {
                                        type: 2,
                                        style: 4,
                                        label: 'Ban (Discord)',
                                        custom_id: `discord_ban_${targetInput}`
                                    },
                                    {
                                        type: 2,
                                        style: 1,
                                        label: 'Roblox Actions',
                                        custom_id: `switch_roblox_${targetInput}`
                                    }
                                ]
                            }]
                        })
                    }).then(res => {
                        if (!res.ok) {
                            console.error(`[REPORTS] Failed to send to channel ${server.reports_channel_id}: ${res.status}`);
                        } else {
                            console.log(`[REPORTS] Successfully forwarded report to channel ${server.reports_channel_id}`);
                        }
                    }).catch(err => console.error('[REPORTS] Error forwarding report to Discord:', err));
                } else {
                    console.log(`[REPORTS] No reports channel configured for guild ${guild_id}`);
                }

                return NextResponse.json({
                    type: 4,
                    data: { content: `✅ **Report Submitted!** The moderation team has been notified.`, flags: 64 }
                });
            }

            if (custom_id === 'setup_modal') {
                const getField = (id: string) => {
                    const row = modalComponents.find((c: any) => c.components.some((ic: any) => ic.custom_id === id));
                    return row ? row.components.find((ic: any) => ic.custom_id === id).value : '';
                };

                const placeId = getField('place_id');
                const universeId = getField('universe_id');
                const openCloudKey = getField('api_key');
                const generatedKey = 'rl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

                const { error: dbError } = await supabase
                    .from('servers')
                    .upsert({
                        id: guild_id,
                        linked_place_id: placeId,
                        universe_id: universeId,
                        open_cloud_key: openCloudKey,
                        api_key: generatedKey
                    });

                if (dbError) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Setup failed: ${dbError.message}`, flags: 64 }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        content: '✅ **Setup Successful!** Please follow the instructions below to complete the integration:',
                        embeds: getSetupEmbeds(guild_id, generatedKey),
                        flags: 64
                    }
                });
            }
        }

        return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 });
    } catch (error) {
        console.error('Interaction error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Helper for Setup Instructions
function getSetupEmbeds(guildId: string, apiKey: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    return [
        {
            title: 'Studio Setup Instructions',
            color: 0x2b2d31,
            description: "Follow these steps to integrate Ro-Link with your Roblox game.",
            thumbnail: { url: `${baseUrl}/Media/Ro-LinkIcon.png` },
            fields: [
                { name: '1. ModuleScript', value: "Create a `ModuleScript` in `ReplicatedStorage` named `RoLink`.", inline: false },
                { name: '2. Paste Code', value: "Copy the **Code Block** below and paste it into the `RoLink` script.", inline: false },
                { name: '3. Starter Script', value: "Create a `Script` in `ServerScriptService` with:\n```lua\nlocal RoLink = require(game.ReplicatedStorage:WaitForChild('RoLink'))\nRoLink:Initialize()\n```", inline: false },
                { name: '4. Permissions', value: "Enable **HTTP Requests** and **API Services** in Game Settings.", inline: false },
                { name: 'Dashboard', value: `[**Manage Server**](${baseUrl}/dashboard/${guildId})`, inline: false }
            ],
            footer: { text: 'Ro-Link Systems • Setup', icon_url: `${baseUrl}/Media/Ro-LinkIcon.png` },
            timestamp: new Date().toISOString()
        },
        {
            title: 'Core Bridge Code (RoLink Module)',
            color: 0x2b2d31,
            description: '```lua\n' + getLuaCode(baseUrl, apiKey) + '\n```',
            footer: { text: 'KEEP YOUR SECURITY KEY PRIVATE!' },
            timestamp: new Date().toISOString()
        }
    ];
}

function getLuaCode(baseUrl: string, apiKey: string) {
    return `-- RoLink Core Bridge
local RoLink = {}
local Http = game:GetService("HttpService")
local Players = game:GetService("Players")
local MS = game:GetService("MessagingService")

local URL = "${baseUrl}"
local KEY = "${apiKey}"
local POLL_INTERVAL = 5

function RoLink:Initialize()
	-- 1. Fetch Server Settings
	task.spawn(function()
		local s, r = pcall(function()
			return Http:RequestAsync({
				Url = URL .. "/api/v1/settings",
				Method = "GET",
				Headers = { ["x-api-key"] = KEY }
			})
		end)
		if s and r.StatusCode == 200 then
			self.settings = Http:JSONDecode(r.Body)
		end
	end)

	-- 2. Security Check (Block Unverified Joins)
	Players.PlayerAdded:Connect(function(player)
		-- Wait for settings to load if they haven't yet
		for i=1, 5 do
			if self.settings then break end
			task.wait(0.5)
		end
		
		if self.settings and self.settings.blockUnverified then
			local s, r = pcall(function()
				return Http:RequestAsync({
					Url = URL .. "/api/v1/lookup?robloxId=" .. player.UserId,
					Method = "GET"
				})
			end)
			
			-- 404 means the user has no mapping in Ro-Link
			if s and r.StatusCode == 404 then
				player:Kick("\n[Ro-Link Security]\n\nThis game requires a linked Discord account.\n\nLink your account at: " .. URL .. "/verify")
			end
		end
	end)

	-- 3. Subscribe to Command Service
	task.spawn(function()
		pcall(function()
			MS:SubscribeAsync("AdminActions", function(msg)
				local d = msg.Data
				if typeof(d) == "string" then d = Http:JSONDecode(d) end
				self:Execute(d)
			end)
		end)
	end)

	-- 4. Command Polling Fallback
	task.spawn(function()
		while true do
			local id = game.JobId ~= "" and game.JobId or "STUDIO"
			local s, r = pcall(function()
				return Http:RequestAsync({
					Url = URL .. "/api/roblox/poll",
					Method = "POST",
					Headers = { ["Content-Type"] = "application/json", ["Authorization"] = "Bearer " .. KEY },
					Body = Http:JSONEncode({ jobId = id, playerCount = #Players:GetPlayers(), players = (function() local l = {} for _, p in ipairs(Players:GetPlayers()) do table.insert(l, p.Name) end return l end)() })
				})
			end)
			if s and r.StatusCode == 200 then
				local d = Http:JSONDecode(r.Body)
				for _, c in ipairs(d.commands or {}) do self:Execute(c) end
			end
			task.wait(POLL_INTERVAL)
		end
	end)
end

function RoLink:Execute(cmd)
	local u, r = cmd.args.username, cmd.args.reason or "No reason"
	local p = Players:FindFirstChild(u) 
    
    if not p and cmd.command ~= "UPDATE" and cmd.command ~= "SHUTDOWN" then return end

	if cmd.command == "KICK" then
		p:Kick(r)
	elseif cmd.command == "BAN" then
		task.spawn(function()
			local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(u) end)
			if s and uid then pcall(function() Players:BanAsync({UserIds={uid},Duration=-1,DisplayReason=r,PrivateReason="RoLink"}) end) end
            if p then p:Kick("Banned: "..r) end
		end)
	elseif cmd.command == "UNBAN" then
		task.spawn(function()
			local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(u) end)
			if s and uid then pcall(function() Players:UnbanAsync({UserIds={uid}}) end) end
		end)
    elseif cmd.command == "FLY" then
        if p and p.Character and p.Character:FindFirstChild("HumanoidRootPart") then
            local hrp = p.Character.HumanoidRootPart
            local bv = hrp:FindFirstChild("RoLinkFly")
            if bv then 
                bv:Destroy() 
            else
                bv = Instance.new("BodyVelocity", hrp)
                bv.Name = "RoLinkFly"
                bv.MaxForce = Vector3.new(1,1,1) * 1000000
                bv.Velocity = Vector3.new(0,0,0)
            end
        end
    elseif cmd.command == "NOCLIP" then
         if p and p.Character then
            local attr = "RoLink_Noclip"
            local state = not p.Character:GetAttribute(attr)
            p.Character:SetAttribute(attr, state)
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") then v.CanCollide = not state end
            end
         end
    elseif cmd.command == "INVIS" then
         if p and p.Character then
            local attr = "RoLink_Invis"
            local state = not p.Character:GetAttribute(attr)
            p.Character:SetAttribute(attr, state)
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") or v:IsA("Decal") then v.Transparency = state and 1 or 0 end
            end
            if p.Character:FindFirstChild("Head") and p.Character.Head:FindFirstChild("face") then
                p.Character.Head.face.Transparency = state and 1 or 0
            end
         end
    elseif cmd.command == "GHOST" then
        if p and p.Character then
            local attr = "RoLink_Ghost"
            local state = not p.Character:GetAttribute(attr)
            p.Character:SetAttribute(attr, state)
            for _, v in pairs(p.Character:GetDescendants()) do
                 if v:IsA("BasePart") or v:IsA("MeshPart") then v.Material = state and Enum.Material.ForceField or Enum.Material.Plastic end
            end
        end
    elseif cmd.command == "SET_CHAR" then
        if p and cmd.args.char_user then
            task.spawn(function()
                 local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(cmd.args.char_user) end)
                 if s and uid then
                     p:LoadCharacterWithHumanoidDescription(Players:GetHumanoidDescriptionFromUserId(uid))
                 end
            end)
        end
    elseif cmd.command == "HEAL" then
        if p and p.Character and p.Character:FindFirstChild("Humanoid") then
            p.Character.Humanoid.Health = p.Character.Humanoid.MaxHealth
        end
    elseif cmd.command == "KILL" then
        if p and p.Character and p.Character:FindFirstChild("Humanoid") then
            p.Character.Humanoid.Health = 0
        end
    elseif cmd.command == "RESET" then
        if p then p:LoadCharacter() end
    elseif cmd.command == "REFRESH" then
        if p and p.Character then
            local cf = p.Character:GetPrimaryPartCFrame()
            p:LoadCharacter()
            p.CharacterAdded:Wait()
            p.Character:SetPrimaryPartCFrame(cf)
        end
	elseif cmd.command == "UPDATE" then
		for _, p in ipairs(Players:GetPlayers()) do p:Kick("Updating...") end
	elseif cmd.command == "SHUTDOWN" then
		if not cmd.args.job_id or cmd.args.job_id == game.JobId then
			for _, p in ipairs(Players:GetPlayers()) do p:Kick("Shutdown.") end
		end
	end
end
return RoLink`;
}

export async function GET() {
    return NextResponse.json({
        status: 'API Active',
        message: 'Interactions endpoint ready for Discord webhooks (POST)'
    }, { status: 200 });
}
