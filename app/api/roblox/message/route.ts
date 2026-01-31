import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const { serverId, command, args } = await req.json();

        // 1. Get Open Cloud Credentials
        const { data: server, error: serverError } = await supabase
            .from('servers')
            .select('universe_id, open_cloud_key')
            .eq('id', serverId)
            .single();

        if (serverError || !server || !server.universe_id || !server.open_cloud_key) {
            return NextResponse.json({ error: 'Open Cloud not configured for this server.' }, { status: 400 });
        }

        // 2. Publish to Roblox Messaging Service
        const messageBody = JSON.stringify({
            command,
            args,
            timestamp: Date.now()
        });

        // Topic: AdminActions
        const robloxRes = await fetch(
            `https://apis.roblox.com/messaging-service/v1/universes/${server.universe_id}/topics/AdminActions`,
            {
                method: 'POST',
                headers: {
                    'x-api-key': server.open_cloud_key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: messageBody })
            }
        );

        if (!robloxRes.ok) {
            const error = await robloxRes.text();
            console.error('[OPEN CLOUD ERROR]', error);
            return NextResponse.json({ error: 'Failed to send message to Roblox Messaging Service' }, { status: robloxRes.status });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Messaging Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
