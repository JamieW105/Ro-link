import type { Session } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { authorizeStudioPluginSession, StudioPluginError } from '@/lib/studioPlugin';

type SessionWithDiscord = Session & {
    accessToken?: string;
    error?: string;
    user?: Session['user'] & { id?: string };
};

type CookieStore = Awaited<ReturnType<typeof import('next/headers').cookies>>;

export type StudioPluginConnectOutcome =
    | { kind: 'missing_params' }
    | { kind: 'need_discord' }
    | { kind: 'success'; pluginToken: string; tokenExpiresAt: string }
    | { kind: 'error'; message: string; status: number };

export async function authorizeStudioPluginFromBrowserSession(options: {
    sessionId: string;
    code: string;
    session: SessionWithDiscord | null;
    requestHeaders: Headers;
    cookieStore: CookieStore;
}): Promise<StudioPluginConnectOutcome> {
    const { sessionId, code, session, requestHeaders, cookieStore } = options;

    if (!sessionId || !code) {
        return { kind: 'missing_params' };
    }

    if (!session?.user?.id || !session.accessToken || session.error) {
        return { kind: 'need_discord' };
    }

    const token = await getToken({
        req: {
            headers: requestHeaders,
            cookies: cookieStore,
        } as never,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    });

    const refreshToken = typeof token?.refreshToken === 'string' ? token.refreshToken : undefined;
    const accessTokenExpiresAt = typeof token?.accessTokenExpires === 'number' ? token.accessTokenExpires : undefined;

    try {
        const result = await authorizeStudioPluginSession(
            sessionId,
            code,
            session.user.id,
            session.user.name || session.user.email || 'Discord User',
            {
                accessToken: session.accessToken,
                refreshToken,
                accessTokenExpiresAt,
            },
        );
        return {
            kind: 'success',
            pluginToken: result.pluginToken,
            tokenExpiresAt: result.tokenExpiresAt,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Studio authorization failed.';
        const status = error instanceof StudioPluginError ? error.status : 500;
        console.error('[PLUGIN][BROWSER_AUTH] authorizeStudioPluginSession failed', {
            sessionId,
            discordUserId: session.user.id,
            status,
            message,
        });
        return { kind: 'error', message, status };
    }
}
