import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';

type DiscordUser = {
    id: string;
    username: string;
    discriminator?: string;
    global_name?: string | null;
    avatar?: string | null;
    banner_color?: string | null;
};

function getDefaultAvatarUrl(user: DiscordUser) {
    const discriminator = Number(user.discriminator || 0);
    const index = discriminator > 0
        ? discriminator % 5
        : Number((BigInt(user.id) >> 22n) % 6n);

    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.error) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const userId = String(searchParams.get('userId') || '').trim();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }
        if (!/^\d{17,20}$/.test(userId)) {
            return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
        }

        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
        }

        const res = await fetch(`https://discord.com/api/v10/users/${encodeURIComponent(userId)}`, {
            headers: {
                'Authorization': `Bot ${botToken}`
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('Failed to fetch Discord user:', err);
            return NextResponse.json({ error: 'Failed to fetch Discord user' }, { status: res.status });
        }

        const user = await res.json() as DiscordUser;

        let avatarUrl = getDefaultAvatarUrl(user);
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
