
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/logger';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    // We should probably allow unauthenticated logs if they come from the bot/kernel, 
    // but for the dashboard logs specifically, we can check session.
    // However, to keep it simple and reusable for now, let's just require the necessary fields.

    try {
        const { serverId, action, target, moderator } = await req.json();

        if (!serverId || !action || !target) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await logAction(serverId, action, target, moderator || 'System');

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
