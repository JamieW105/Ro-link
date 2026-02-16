import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
        }

        const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: {
                'Authorization': `Bot ${botToken}`
            }
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('Failed to fetch Discord user:', err);
            return NextResponse.json({ error: 'Failed to fetch Discord user' }, { status: res.status });
        }

        const user = await res.json();

        // Construct avatar URL
        let avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
        if (user.avatar) {
            const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
            avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=512`;
        }

        return NextResponse.json({
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            global_name: user.global_name,
            avatar_url: avatarUrl,
            banner_color: user.banner_color
        });

    } catch (e) {
        console.error('Discord User API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
