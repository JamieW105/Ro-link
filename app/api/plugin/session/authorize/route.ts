import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { authorizeStudioPluginSession } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

type SessionWithDiscord = Session & {
    accessToken?: string;
    user?: Session['user'] & {
        id?: string;
    };
};

export async function POST(req: Request) {
    const session = await getServerSession(authOptions) as SessionWithDiscord | null;
    if (!session?.user || !session.user.id || !session.accessToken) {
        return NextResponse.json({ error: 'You need to sign in with Discord first.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { sessionId?: string; code?: string } | null;
    const sessionId = body?.sessionId?.trim();
    const code = body?.code?.trim();

    if (!sessionId || !code) {
        return NextResponse.json({ error: 'sessionId and code are required.' }, { status: 400 });
    }

    try {
        const result = await authorizeStudioPluginSession(
            sessionId,
            code,
            session.user.id,
            session.user.name || session.user.email || 'Discord User',
            session.accessToken,
        );

        return NextResponse.json({
            status: 'authorized',
            ...result,
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to authorize Studio plugin session.',
        }, { status: 400 });
    }
}
