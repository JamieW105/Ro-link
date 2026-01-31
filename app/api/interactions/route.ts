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

        // 2. Handle PING
        if (interaction.type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 3. Handle Application Commands
        if (interaction.type === 2) {
            const { name, options } = interaction.data;
            const { guild_id, member, user: interactionUser } = interaction;
            const user = interactionUser || member?.user;
            const userTag = user ? `${user.username}#${user.discriminator}` : 'Unknown';

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
            const reason = options?.find((o: any) => o.name === 'reason')?.value || 'No reason provided';

            // Add to Command Queue
            const { error } = await supabase.from('command_queue').insert([{
                server_id: guild_id,
                command: name.toUpperCase(),
                args: { username: targetUser, reason: reason, moderator: userTag },
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
                target: targetUser || 'ALL',
                moderator: userTag
            }]);

            let message = '';
            if (name === 'ban') message = `🔨 **Banned** \`${targetUser}\` from Roblox game.`;
            else if (name === 'kick') message = `🥾 **Kicked** \`${targetUser}\` from Roblox server.`;
            else if (name === 'unban') message = `🔓 **Unbanned** \`${targetUser}\` from Roblox.`;
            else if (name === 'update') message = `🚀 **Update Signal Sent**! All game servers will restart shortly.`;

            return NextResponse.json({
                type: 4,
                data: { content: message }
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
