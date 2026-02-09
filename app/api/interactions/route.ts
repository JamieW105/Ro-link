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
                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: 'Info',
                                description: "Welcome to Ro-Link. We are a platform that enables you to connect your Discord / cmds to Roblox. We make the connection between Discord and Roblox feel like a very small gap. We allow kick, ban and unban cmds along with an advanced dashboard to show you your servers and player count.\n\nGive us a try, we are aways looking to help all community's no matter the size. Ro-link is perfect for any game and allows you to respond to urgent reports without the bother of having to join in game.",
                                color: 959977
                            },
                            {
                                title: 'Commands',
                                color: 1095921,
                                fields: [
                                    { name: '`/setup`', value: 'Initializes Ro-Link for this server (Owner Only).' },
                                    { name: '`/ping`', value: 'Check the bot response time and connection status.' },
                                    { name: '`/ban`', value: 'Permanently ban a user from the Roblox game.' },
                                    { name: '`/kick`', value: 'Kick a user from the game server.' },
                                    { name: '`/unban`', value: 'Unban a user from the Roblox game.' },
                                    { name: '`/update`', value: 'Send a global update signal to all Roblox servers (restarts them).' },
                                    { name: '`/shutdown`', value: 'Immediately shut down game servers.' },
                                    { name: '`/lookup`', value: 'Lookup a Roblox player and see their status/actions.' },
                                    { name: '`/help`', value: 'Show info and list of available commands.' }
                                ]
                            }
                        ]
                    }
                });
            }

            // Permission Check: Only 'ping' is public (Already handled ping above)
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
                        content: `Select a miscellaneous action:`,
                        flags: 64,
                        components: [{
                            type: 1,
                            components: [{
                                type: 3,
                                custom_id: `misc_menu`,
                                placeholder: 'Select an action to perform',
                                options: [
                                    { label: 'Fly', value: 'FLY', description: 'Enable flight for the player', emoji: { name: '✈️' } },
                                    { label: 'Noclip', value: 'NOCLIP', description: 'Allow player to walk through walls', emoji: { name: '👻' } },
                                    { label: 'Invis', value: 'INVIS', description: 'Make the player invisible', emoji: { name: '🫥' } },
                                    { label: 'Ghost', value: 'GHOST', description: 'Apply a ForceField material', emoji: { name: '🛡️' } },
                                    { label: 'Set Character', value: 'SET_CHAR', description: 'Change the player\'s character appearance', emoji: { name: '👤' } }
                                ]
                            }]
                        }]
                    }
                });
            }
            else if (name === 'lookup') {
                const username = options.find((o: any) => o.name === 'username').value;

                // Headers for Roblox API (Legacy Search does NOT support x-api-key)
                const headers: any = { 'User-Agent': 'Mozilla/5.0' };

                // Fetch data for the embed (Official Roblox API)
                const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${username}&limit=10`, {
                    headers
                });

                if (!searchRes.ok) {
                    if (searchRes.status === 429) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `⚠️ **Rate Limited**: Roblox is currently limiting requests from this server. Please try again in 1-2 minutes or ensure your Open Cloud key has 'User' permissions enabled.`, flags: 64 }
                        });
                    }
                    const errorText = await searchRes.text();
                    console.error('[ROBLOX API ERROR]', searchRes.status, errorText);
                    return NextResponse.json({ type: 4, data: { content: `❌ Roblox API returned an error (${searchRes.status}).` } });
                }

                const searchData = await searchRes.json();
                if (!searchData.data?.[0]) {
                    return NextResponse.json({ type: 4, data: { content: `❌ Player \`${username}\` not found.` } });
                }

                const userId = searchData.data[0].id;

                const canonicalName = searchData.data[0].name;

                const [profileRes, thumbRes, serversRes, logsRes] = await Promise.all([
                    fetch(`https://users.roblox.com/v1/users/${userId}`, { headers }),
                    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`, { headers }),
                    supabase.from('live_servers').select('id, players').eq('server_id', guild_id),
                    supabase.from('logs').select('action, moderator, created_at').eq('server_id', guild_id).eq('target', canonicalName).order('created_at', { ascending: false }).limit(5)
                ]);

                if (!profileRes.ok) {
                    return NextResponse.json({ type: 4, data: { content: `❌ Failed to fetch detailed player info from Roblox.` } });
                }

                const profile = await profileRes.json();
                const thumb = await thumbRes.json();
                const avatarUrl = thumb.data?.[0]?.imageUrl || '';

                const activeServer = serversRes.data?.find((s: any) =>
                    Array.isArray(s.players) && s.players.some((p: string) => p.toLowerCase() === profile.name.toLowerCase())
                );

                const logs = logsRes.data || [];
                const logField = logs.length > 0
                    ? logs.map(l => `• **${l.action}** by ${l.moderator.split('#')[0]} (<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>)`).join('\n')
                    : '*No previous moderation.*';

                const createdDate = new Date(profile.created);
                const accountAgeDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

                let statusText = activeServer ? `🟢 **In-Game**\n\`${activeServer.id}\`` : '⚪ Offline';
                if (profile.isBanned) statusText = '🔴 **Banned on Roblox**';

                const components = [];

                // Row 1: Links & Info
                const actionRow1 = {
                    type: 1,
                    components: [
                        { type: 2, label: 'View Profile', style: 5, url: `https://www.roblox.com/users/${userId}/profile` },
                        { type: 2, label: 'View on Dashboard', style: 5, url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guild_id}/lookup?username=${profile.name}` }
                    ]
                };

                if (activeServer && server?.linked_place_id) {
                    actionRow1.components.push({
                        type: 2,
                        label: 'Join Server',
                        style: 5,
                        url: `roblox://placeId=${server.linked_place_id}&gameInstanceId=${activeServer.id}`
                    });
                }
                components.push(actionRow1);

                // Row 2: Moderation Actions
                components.push({
                    type: 1,
                    components: [
                        { type: 2, label: 'Kick', style: 2, custom_id: `kick_${userId}_${profile.name}` },
                        { type: 2, label: 'Ban', style: 4, custom_id: `ban_${userId}_${profile.name}` },
                        { type: 2, label: 'Unban', style: 3, custom_id: `unban_${userId}_${profile.name}` }
                    ]
                });

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `Player Lookup: ${profile.displayName}`,
                            color: activeServer ? 1095921 : profile.isBanned ? 15681348 : 959977,
                            thumbnail: { url: avatarUrl },
                            fields: [
                                { name: 'Username', value: `\`${profile.name}\``, inline: true },
                                { name: 'User ID', value: `\`${userId}\``, inline: true },
                                { name: 'Status', value: statusText, inline: true },
                                { name: 'Account Age', value: `\`${accountAgeDays.toLocaleString()} Days\``, inline: true },
                                { name: 'Created', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:D> (<t:${Math.floor(createdDate.getTime() / 1000)}:R>)`, inline: true },
                                { name: 'Description', value: profile.description ? (profile.description.length > 200 ? profile.description.substring(0, 197) + '...' : profile.description) : '*No description*', inline: false },
                                { name: '📜 Moderation History (Recent)', value: logField, inline: false }
                            ],
                            footer: { text: 'Ro-Link Dashboard Integration' },
                            timestamp: new Date().toISOString()
                        }],
                        components
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

            const [action, userId, username] = interaction.data.custom_id.split('_');

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
                    triggerMessaging(action, args)
                ]);

                return NextResponse.json({
                    type: 4,
                    data: { content: msgContent, flags: 64 }
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
            title: '🛠️ Studio Setup Instructions',
            color: 959977,
            fields: [
                { name: '1. ModuleScript', value: "Create a `ModuleScript` in `ReplicatedStorage` named `RoLink`." },
                { name: '2. Paste Code', value: "Copy the code from the next box and paste it into that script." },
                { name: '3. Starter Script', value: "Create a `Script` in `ServerScriptService` with:\n```lua\nlocal RoLink = require(game.ReplicatedStorage:WaitForChild('RoLink'))\nRoLink:Initialize()\n```" },
                { name: '4. Permissions', value: "Enable **HTTP Requests** and **API Services** in Game Settings." },
                { name: 'Dashboard', value: `${baseUrl}/dashboard/${guildId}` }
            ]
        },
        {
            title: '📄 Core Bridge Code (RoLink Module)',
            color: 1095921,
            description: '```lua\n' + getLuaCode(baseUrl, apiKey) + '\n```',
            footer: { text: 'Keep your Security Key private!' }
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
	task.spawn(function()
		pcall(function()
			MS:SubscribeAsync("AdminActions", function(msg)
				local d = msg.Data
				if typeof(d) == "string" then d = Http:JSONDecode(d) end
				self:Execute(d)
			end)
		end)
	end)
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
        if p and p.Character then
            local hrp = p.Character:FindFirstChild("HumanoidRootPart")
            if hrp and not hrp:FindFirstChild("RoLinkFly") then
                local bv = Instance.new("BodyVelocity", hrp)
                bv.Name = "RoLinkFly"
                bv.MaxForce = Vector3.new(1,1,1) * 100000
                bv.Velocity = Vector3.new(0,0,0) -- Hover
            end
        end
    elseif cmd.command == "NOCLIP" then
         if p and p.Character then
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") then v.CanCollide = false end
            end
         end
    elseif cmd.command == "INVIS" then
         if p and p.Character then
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") or v:IsA("Decal") then v.Transparency = 1 end
            end
            p.Character.Head.Transparency = 1
         end
    elseif cmd.command == "GHOST" then
        if p and p.Character then
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") or v:IsA("MeshPart") then
                    v.Material = Enum.Material.ForceField
                end
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
    return new NextResponse('Ro-Link Discord Interaction Endpoint is Online. (Use POST for Discord)', { status: 200 });
}
