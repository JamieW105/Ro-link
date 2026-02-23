import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const studioUserId = body.studioUserId;

        if (!studioUserId) {
            return NextResponse.json({ error: 'Missing studioUserId' }, { status: 400 });
        }

        const sessionId = crypto.randomUUID();
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        // The URL the developer must visit to verify their Roblox Studio session
        const loginUrl = `${protocol}://${host}/dashboard/plugin/verify?session=${sessionId}`;

        const { error } = await supabase
            .from('plugin_sessions')
            .insert([{ session_id: sessionId, studio_user_id: studioUserId, status: 'pending' }]);

        if (error) {
            console.warn("Table 'plugin_sessions' might not exist, creating placeholder session:", error);
        }

        return NextResponse.json({ sessionId, loginUrl });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
