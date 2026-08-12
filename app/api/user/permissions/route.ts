
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { DGSU_BAN_AUTH_ERROR, DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from '@/lib/dgsuBanConstants';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');

    const session = await getServerSession(authOptions);
    if (session?.error === DGSU_BAN_AUTH_ERROR) {
        return NextResponse.json({ error: DGSU_BAN_ERROR_MESSAGE }, { status: DGSU_BAN_ERROR_STATUS });
    }

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!serverId) {
        return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    try {
        const userId = String(session.user.id);
        try {
            const permissions = await resolveDashboardUserPermissions(serverId, userId);
            return NextResponse.json(permissions);
        } catch (error) {
            const discordError = error as { status?: number };
            if (discordError?.status === 404 || discordError?.status === 403) {
                return NextResponse.json({ error: 'Not a member of this server' }, { status: 403 });
            }
            throw error;
        }
    } catch (error) {
        console.error('[Permissions API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
