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
        const triggerMessaging = async (command: string, args: any) => {
            if (!guild_id) return;
            await sendRobloxMessage(guild_id, command, args);
        };

        // 2. Handle PING
        if (type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 3. Handle Application Commands
        if (type === 2) {
            const { name, options } = interaction.data;

            // Permission Check: Only 'ping' is public
            if (name !== 'ping') {
                const permissions = BigInt(member?.permissions || '0');
                const hasPerms = (permissions & 0x2n) !== 0n || (permissions & 0x4n) !== 0n || (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;

                if (!hasPerms) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ You do not have permission to use this command. (Requires Kick/Ban Members or Admin)`, flags: 64 }
                    });
                }
            }

            // Check if server is setup
            const { data: server } = await supabase
                .from('servers')
                .select('id, open_cloud_key')
                .eq('id', guild_id)
                .single();

            if (!server) {
                return NextResponse.json({
                    type: 4,
                    data: {
                        content: `❌ This server is not set up with Ro-Link yet. Please visit the dashboard to initialize it.`,
                        flags: 64
                    }
                });
            }

            const targetUser = options?.find((o: any) => o.name === 'username')?.value;
            const jobId = options?.find((o: any) => o.name === 'job_id')?.value;
            const reason = options?.find((o: any) => o.name === 'reason')?.value || 'No reason provided';

            let message = '';
            if (name === 'ban') {
                // Add to Command Queue
                const { error } = await supabase.from('command_queue').insert([{
                    server_id: guild_id,
                    command: name.toUpperCase(),
                    args: { username: targetUser, reason: 'Discord Command', moderator: userTag },
                    status: 'PENDING'
                }]);

                if (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                await triggerMessaging(name.toUpperCase(), { username: targetUser, reason: 'Discord Command', moderator: userTag });
                // Add to Logs
                await supabase.from('logs').insert([{
                    server_id: guild_id,
                    action: name.toUpperCase(),
                    target: targetUser,
                    moderator: userTag
                }]);
                message = `🔨 **Banned** \`${targetUser}\` from Roblox game.`;
            }
            else if (name === 'kick') {
                const { error } = await supabase.from('command_queue').insert([{
                    server_id: guild_id,
                    command: 'KICK',
                    args: { username: targetUser, reason: 'Discord Command', moderator: userTag },
                    status: 'PENDING'
                }]);

                if (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                await triggerMessaging('KICK', { username: targetUser, reason: 'Discord Command', moderator: userTag });
                // Add to Logs
                await supabase.from('logs').insert([{
                    server_id: guild_id,
                    action: 'KICK',
                    target: targetUser,
                    moderator: userTag
                }]);
                message = `🥾 **Kicked** \`${targetUser}\` from Roblox server.`;
            }
            else if (name === 'unban') {
                const { error } = await supabase.from('command_queue').insert([{
                    server_id: guild_id,
                    command: 'UNBAN',
                    args: { username: targetUser, reason: 'Discord Command', moderator: userTag },
                    status: 'PENDING'
                }]);

                if (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                await triggerMessaging('UNBAN', { username: targetUser, reason: 'Discord Command', moderator: userTag });
                // Add to Logs
                await supabase.from('logs').insert([{
                    server_id: guild_id,
                    action: 'UNBAN',
                    target: targetUser,
                    moderator: userTag
                }]);
                message = `🔓 **Unbanned** \`${targetUser}\` from Roblox.`;
            }
            else if (name === 'update') {
                const { error } = await supabase.from('command_queue').insert([{
                    server_id: guild_id,
                    command: 'UPDATE',
                    args: { reason: "Manual Update Triggered", moderator: userTag },
                    status: 'PENDING'
                }]);

                if (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                await triggerMessaging('UPDATE', { reason: "Manual Update Triggered", moderator: userTag });
                // Add to Logs
                await supabase.from('logs').insert([{
                    server_id: guild_id,
                    action: 'UPDATE',
                    target: 'ALL',
                    moderator: userTag
                }]);
                message = `🚀 **Update Signal Sent**! All game servers will restart shortly.`;
            }
            else if (name === 'shutdown') {
                const { error } = await supabase.from('command_queue').insert([{
                    server_id: guild_id,
                    command: 'SHUTDOWN',
                    args: { job_id: jobId, moderator: userTag },
                    status: 'PENDING'
                }]);

                if (error) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Failed to queue command.`, flags: 64 }
                    });
                }
                await triggerMessaging('SHUTDOWN', { job_id: jobId, moderator: userTag });
                // Add to Logs
                await supabase.from('logs').insert([{
                    server_id: guild_id,
                    action: 'SHUTDOWN',
                    target: jobId || 'ALL',
                    moderator: userTag
                }]);
                const targetMsg = jobId ? `server \`${jobId}\`` : 'all active game servers';
                message = `🛑 **SHUTDOWN SIGNAL SENT**! Closing ${targetMsg}.`;
            }
            else if (name === 'ping') {
                const timestamp = Number(BigInt(interaction.id) >> 22n) + 1420070400000;
                const latency = Math.abs(Date.now() - timestamp);
                return NextResponse.json({
                    type: 4,
                    data: { content: `🏓 **Pong!**\nLatency: \`${latency}ms\`\nInstance: \`Vercel Edge (Australia/Sydney)\`` }
                });
            }
            else if (name === 'lookup') {
                const username = options.find((o: any) => o.name === 'username').value;

                // Headers for Roblox API
                const headers: any = { 'User-Agent': 'Mozilla/5.0' };
                if (server?.open_cloud_key) headers['x-api-key'] = server.open_cloud_key;

                // Fetch data for the embed (Official Roblox API)
                const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${username}&limit=1`, {
                    headers
                });

                if (!searchRes.ok) {
                    const errorText = await searchRes.text();
                    console.error('[ROBLOX API ERROR]', searchRes.status, errorText);
                    return NextResponse.json({ type: 4, data: { content: `❌ Roblox API returned an error (${searchRes.status}).` } });
                }

                const searchData = await searchRes.json();
                if (!searchData.data?.[0]) {
                    return NextResponse.json({ type: 4, data: { content: `❌ Player \`${username}\` not found.` } });
                }

                const userId = searchData.data[0].id;

                const [profileRes, thumbRes] = await Promise.all([
                    fetch(`https://users.roblox.com/v1/users/${userId}`, { headers }),
                    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`, { headers })
                ]);

                if (!profileRes.ok) {
                    return NextResponse.json({ type: 4, data: { content: `❌ Failed to fetch detailed player info from Roblox.` } });
                }

                const profile = await profileRes.json();
                const thumb = await thumbRes.json();
                const avatarUrl = thumb.data?.[0]?.imageUrl || '';

                // Fetch Presence and Logs now that we have the exact name
                const [serversRes, logsRes] = await Promise.all([
                    supabase.from('live_servers').select('players').eq('server_id', guild_id),
                    supabase.from('logs').select('action, moderator, created_at').eq('server_id', guild_id).eq('target', profile.name).order('created_at', { ascending: false }).limit(3)
                ]);

                const activeServer = serversRes.data?.find((s: any) =>
                    Array.isArray(s.players) && s.players.some((p: string) => p.toLowerCase() === profile.name.toLowerCase())
                );

                const logs = logsRes.data || [];
                const logField = logs.length > 0
                    ? logs.map(l => `• **${l.action}** by ${l.moderator.split('#')[0]} (<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>)`).join('\n')
                    : '*No previous moderation.*';

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
                                { name: 'Status', value: activeServer ? '🟢 **In-Game**' : '⚪ Offline', inline: true },
                                { name: '📜 Moderation History (Recent)', value: logField, inline: false }
                            ],
                            footer: { text: 'Ro-Link Dashboard Integration' }
                        }],
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, label: 'Kick', style: 2, custom_id: `kick_${userId}_${profile.name}` },
                                { type: 2, label: 'Ban', style: 4, custom_id: `ban_${userId}_${profile.name}` },
                                { type: 2, label: 'Unban', style: 3, custom_id: `unban_${userId}_${profile.name}` }
                            ]
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
            // Permission Check for buttons
            const permissions = BigInt(member?.permissions || '0');
            const hasPerms = (permissions & 0x2n) !== 0n || (permissions & 0x4n) !== 0n || (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;

            if (!hasPerms) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ You do not have permission to use this button.`, flags: 64 }
                });
            }

            const [action, userId, username] = interaction.data.custom_id.split('_');

            const { error } = await supabase.from('command_queue').insert([{
                server_id: guild_id,
                command: action.toUpperCase(),
                args: { username, reason: 'Discord Button Action', moderator: userTag },
                status: 'PENDING'
            }]);

            if (!error) {
                await triggerMessaging(action.toUpperCase(), { username, reason: 'Discord Button Action', moderator: userTag });

                await supabase.from('logs').insert([{
                    server_id: guild_id,
                    action: action.toUpperCase(),
                    target: username,
                    moderator: userTag
                }]);
            }

            return NextResponse.json({
                type: 4,
                data: { content: `✅ **${action.toUpperCase()}** command queued for \`${username}\`.`, flags: 64 }
            });
        }

        return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 });
    } catch (error) {
        console.error('Interaction error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET() {
    return new NextResponse('Ro-Link Discord Interaction Endpoint is Online. (Use POST for Discord)', { status: 200 });
}
