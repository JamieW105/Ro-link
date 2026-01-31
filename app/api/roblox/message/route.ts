import { NextResponse } from 'next/server';
import { sendRobloxMessage } from '@/lib/roblox';

export async function POST(req: Request) {
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
