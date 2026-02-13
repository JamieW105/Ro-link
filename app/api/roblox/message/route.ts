import { NextResponse } from 'next/server';
import { sendRobloxMessage } from '@/lib/roblox';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
    return NextResponse.json({
        status: 'API Active',
        message: 'Endpoint ready for Roblox messaging (POST)'
    }, { status: 200 });
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Special read-only permission for 'cherubdude' (ID: 953414442060746854)
    if ((session.user as any).id === '953414442060746854') {
        return NextResponse.json({ error: 'Forbidden: Read-only access' }, { status: 403 });
    }

    try {
        const { serverId, command, args } = await req.json();
        const result = await sendRobloxMessage(serverId, command, args);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Messaging Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
