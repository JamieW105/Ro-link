import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

// Helper to convert hex string to Uint8Array
function hexToUint8Array(hex: string) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return arr;
}

// Verify the interaction from Discord
async function verifyDiscordRequest(request: Request, body: string) {
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
        console.error('Missing signature headers or Public Key');
        return false;
    }

    try {
        const encoder = new TextEncoder();
        return nacl.sign.detached.verify(
            encoder.encode(timestamp + body),
            hexToUint8Array(signature),
            hexToUint8Array(publicKey)
        );
    } catch (e) {
        console.error('Signature verification error:', e);
        return false;
    }
}

export async function POST(req: Request) {
    const bodyText = await req.text();

    // 1. Verify Request
    const isValid = await verifyDiscordRequest(req, bodyText);
    if (!isValid) {
        return new NextResponse('Invalid request signature', { status: 401 });
    }

    const interaction = JSON.parse(bodyText);

    // 2. Handle PING (Discord verification)
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
}
