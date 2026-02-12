
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendRobloxMessage } from '@/lib/roblox';

export async function POST(req: Request) {
    // 1. Authenticate with API Key
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const { data: server, error: authError } = await supabase
        .from('servers')
        .select('*')
        .eq('api_key', apiKey)
        .single();

    if (authError || !server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    // 2. Parse Body
    const body = await req.json().catch(() => ({}));
    const { command, args, moderator } = body;

    if (!command) {
        return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const commandName = command.toUpperCase();
    const safeArgs = args || {};
    const modName = moderator || 'API User';

    try {
        // 3. Queue Command
        const { error: queueError } = await supabase.from('command_queue').insert([{
            server_id: server.id,
            command: commandName,
            args: { ...safeArgs, moderator: modName },
            status: 'PENDING'
        }]);

        if (queueError) throw queueError;

        // 4. Trigger Instant Message (MessagingService)
        // This is "fire and forget" for speed, but ideally we await it if reliability > latency
        const msgResult = await sendRobloxMessage(server.id, commandName, { ...safeArgs, moderator: modName }, server);

        // 5. Log Action
        await supabase.from('logs').insert([{
            server_id: server.id,
            action: commandName,
            target: safeArgs.username || 'N/A',
            moderator: modName
        }]);

        return NextResponse.json({
            success: true,
            message: `Command ${commandName} queued.`,
            open_cloud_status: msgResult.success ? 'Sent' : 'Failed'
        });

    } catch (err: any) {
        console.error('API Error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
