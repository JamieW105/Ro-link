import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { DGSU_BAN_AUTH_ERROR } from '@/lib/dgsuBanConstants';

export async function requireModuleIdeUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
    }
    if (session.error === DGSU_BAN_AUTH_ERROR) {
        return { error: NextResponse.json({ error: 'This account cannot access the Module IDE.' }, { status: 403 }) } as const;
    }

    const discordUserId = String((session.user as { id?: string }).id || '').trim();
    if (!discordUserId) {
        return { error: NextResponse.json({ error: 'Discord user ID is required.' }, { status: 400 }) } as const;
    }

    return { session, discordUserId } as const;
}
export function noStoreJson(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
}
