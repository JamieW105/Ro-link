import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

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

        // 2. Handle PING
        if (type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 3. Handle Application Commands
        if (type === 2) {
            const { name, options } = interaction.data;

            // Check if server is setup
            const { data: server } = await supabase
                .from('servers')
                .select('id')
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

            // Add to Command Queue
            const { error } = await supabase.from('command_queue').insert([{
                server_id: guild_id,
                command: name.toUpperCase(),
                args: { username: targetUser, job_id: jobId, reason: reason, moderator: userTag },
                status: 'PENDING'
            }]);

            if (error) {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ Failed to queue command.`, flags: 64 }
                });
            }

            // Add to Logs
            await supabase.from('logs').insert([{
                server_id: guild_id,
                action: name.toUpperCase(),
                target: targetUser || jobId || 'ALL',
                moderator: userTag
            }]);

            let message = '';
            if (name === 'ban') message = `🔨 **Banned** \`${targetUser}\` from Roblox game.`;
            else if (name === 'kick') message = `🥾 **Kicked** \`${targetUser}\` from Roblox server.`;
            else if (name === 'unban') message = `🔓 **Unbanned** \`${targetUser}\` from Roblox.`;
            else if (name === 'update') message = `🚀 **Update Signal Sent**! All game servers will restart shortly.`;
            else if (name === 'shutdown') {
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

                // Fetch data for the embed (Using RoProxy to bypass Vercel IP block)
                const searchRes = await fetch('https://users.roproxy.com/v1/usernames/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
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

                const user = searchData.data[0];
                const userId = user.id;

                const [profileRes, thumbRes, serversRes] = await Promise.all([
                    fetch(`https://users.roproxy.com/v1/users/${userId}`),
                    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`),
                    supabase.from('live_servers').select('players').eq('server_id', guild_id)
                ]);

                if (!profileRes.ok) {
                    return NextResponse.json({ type: 4, data: { content: `❌ Failed to fetch detailed player info from Roblox (${profileRes.status}).` } });
                }

                const profile = await profileRes.json();
                const thumb = await thumbRes.json();
                const avatarUrl = thumb.data?.[0]?.imageUrl || '';

                // Safe check for serversRes.data
                const activeServer = serversRes.data?.find((s: any) =>
                    Array.isArray(s.players) && s.players.some((p: string) => p.toLowerCase() === profile.name.toLowerCase())
                );

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
                                { name: 'Status', value: activeServer ? '🟢 **In-Game**' : '⚪ Offline', inline: true }
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
            const [action, userId, username] = interaction.data.custom_id.split('_');

            await supabase.from('command_queue').insert([{
                server_id: guild_id,
                command: action.toUpperCase(),
                args: { username, reason: 'Discord Button Action', moderator: userTag },
                status: 'PENDING'
            }]);

            await supabase.from('logs').insert([{
                server_id: guild_id,
                action: action.toUpperCase(),
                target: username,
                moderator: userTag
            }]);

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
