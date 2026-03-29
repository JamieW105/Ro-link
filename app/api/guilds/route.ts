import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { listVisibleGuildsForDiscordSession } from '@/lib/dashboardGuilds';

export const dynamic = 'force-dynamic';

type SessionWithDiscord = Session & {
    accessToken?: string;
    user?: Session['user'] & {
        id?: string;
    };
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    // Heartbeat check for uptime monitors (Allow check without authentication)
    // We check for ?status=check OR the Better Uptime user agent
    if (searchParams.get('status') === 'check' || req.headers.get('user-agent')?.includes('Better Uptime')) {
        return NextResponse.json({ status: 'API Active', message: 'Guilds endpoint operational' }, { status: 200 });
    }

    const session = await getServerSession(authOptions) as SessionWithDiscord | null;

    if (!session || !session.accessToken || !session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const visibleGuilds = await listVisibleGuildsForDiscordSession(
            session.accessToken,
            session.user.id,
        );

        return NextResponse.json(visibleGuilds);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
