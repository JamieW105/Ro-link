import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { authorizeStudioPluginFromBrowserSession } from '@/lib/studioPluginBrowserAuth';

export const dynamic = 'force-dynamic';

type SessionWithDiscord = Session & {
    accessToken?: string;
    user?: Session['user'] & {
        id?: string;
    };
};

/** Legacy POST — prefer server-side authorize on `/plugin/connect`. Kept for older clients. */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions) as SessionWithDiscord | null;
    const url = new URL(req.url);
    const body = await req.json().catch(() => null) as { sessionId?: string; code?: string } | null;
    const sessionId = body?.sessionId?.trim() || url.searchParams.get('sessionId')?.trim() || '';
    const code = body?.code?.trim() || url.searchParams.get('code')?.trim() || '';

    const cookieStore = await cookies();
    const outcome = await authorizeStudioPluginFromBrowserSession({
        sessionId,
        code,
        session,
        cookieStore,
        requestHeaders: req.headers,
    });

    if (outcome.kind === 'missing_params') {
        return NextResponse.json({ error: 'sessionId and code are required.' }, { status: 400 });
    }

    if (outcome.kind === 'need_discord') {
        console.warn('[PLUGIN][AUTHORIZE] Missing Discord session for Studio plugin authorization');
        return NextResponse.json({ error: 'You need to sign in with Discord first.' }, { status: 401 });
    }

    if (outcome.kind === 'error') {
        return NextResponse.json({ error: outcome.message }, { status: outcome.status });
    }

    console.info('[PLUGIN][AUTHORIZE] Studio plugin session authorized (POST)', { sessionId });

    return NextResponse.json({
        status: 'authorized',
        pluginToken: outcome.pluginToken,
        tokenExpiresAt: outcome.tokenExpiresAt,
    });
}
