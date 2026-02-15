import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, embed, content } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
        }

        // 1. Create DM Channel
        const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: userId })
        });

        if (!dmRes.ok) {
            const err = await dmRes.text();
            console.error('Failed to create DM channel:', err);
            return NextResponse.json({ error: 'Failed to open DM' }, { status: 500 });
        }

        const channel = await dmRes.json();
        const channelId = channel.id;

        // 2. Send Message
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content || '',
                embeds: embed ? [embed] : []
            })
        });

        if (!msgRes.ok) {
            const err = await msgRes.text();
            console.error('Failed to send DM:', err);
            return NextResponse.json({ error: 'Failed to send message (User might have DMs closed)' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error('DM API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
