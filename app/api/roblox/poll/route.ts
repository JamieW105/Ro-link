import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'No API Key' }, { status: 401 });

        const apiKey = authHeader.replace('Bearer ', '');
        const { jobId, playerCount } = await req.json().catch(() => ({}));

        // 1. Validate API Key and get Server ID
        const { data: server, error: serverError } = await supabase
            .from('servers')
            .select('id')
            .eq('api_key', apiKey)
            .single();

        if (serverError || !server) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
        }

        // 2. Update Live Server Status if provided
        if (jobId) {
            await supabase
                .from('live_servers')
                .upsert({
                    id: jobId,
                    server_id: server.id,
                    player_count: playerCount || 0,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            // Cleanup stale servers (older than 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            await supabase
                .from('live_servers')
                .delete()
                .eq('server_id', server.id)
                .lt('updated_at', fiveMinutesAgo);
        }

        // 3. Fetch Pending Commands
        const { data: commands, error: commandError } = await supabase
            .from('command_queue')
            .select('*')
            .eq('server_id', server.id)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true });

        if (commandError) throw commandError;

        // 4. Mark as Processed
        if (commands.length > 0) {
            const ids = commands.map(c => c.id);
            await supabase
                .from('command_queue')
                .update({ status: 'PROCESSED' })
                .in('id', ids);
        }

        return NextResponse.json({ commands });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
