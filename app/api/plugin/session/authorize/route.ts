import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { authorizeStudioPluginSession, StudioPluginError } from '@/lib/studioPlugin';

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
        console.warn('[PLUGIN][AUTHORIZE] Missing Discord session for Studio plugin authorization');
        return NextResponse.json({ error: 'You need to sign in with Discord first.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => null) as { sessionId?: string; code?: string } | null;
    const sessionId = body?.sessionId?.trim() || url.searchParams.get('sessionId')?.trim();
    const code = body?.code?.trim() || url.searchParams.get('code')?.trim();

    if (!sessionId || !code) {
        console.warn('[PLUGIN][AUTHORIZE] Missing session parameters', {
            sessionId: sessionId || null,
            hasCode: Boolean(code),
            discordUserId: session.user.id,
            url: req.url,
            bodyKeys: body && typeof body === 'object' ? Object.keys(body) : [],
        });
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

        console.info('[PLUGIN][AUTHORIZE] Studio plugin session authorized', {
            sessionId,
            discordUserId: session.user.id,
        });

        return NextResponse.json({
            status: 'authorized',
            ...result,
        });
    } catch (error) {
        console.error('[PLUGIN][AUTHORIZE] Failed to authorize Studio plugin session', {
            sessionId,
            discordUserId: session.user.id,
            error: error instanceof Error ? error.message : error,
        });

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to authorize Studio plugin session.',
        }, { status: error instanceof StudioPluginError ? error.status : 500 });
    }
}
