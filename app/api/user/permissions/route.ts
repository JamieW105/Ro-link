
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');

    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!serverId) {
        return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    try {
        const userId = String((session.user as { id?: string }).id || '');
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
