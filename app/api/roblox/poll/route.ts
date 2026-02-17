import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    return NextResponse.json({
        status: 'API Active',
        message: 'Endpoint ready for Roblox server polling (POST)'
    }, { status: 200 });
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'No API Key' }, { status: 401 });

        const apiKey = authHeader.replace('Bearer ', '');
        const { jobId, playerCount, players, status } = await req.json().catch(() => ({}));

        // 1. Validate API Key and get Server ID
        const { data: server, error: serverError } = await supabase
            .from('servers')
            .select('id, admin_cmds_enabled, misc_cmds_enabled')
            .eq('api_key', apiKey)
            .single();

        if (serverError || !server) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
        }

        // 2. Handle Shutdown (Explicit via status or implicit via 0 players)
        if (jobId) {
            if (status === 'SHUTDOWN' || playerCount === 0) {
                // Immediate removal
                await supabase
                    .from('live_servers')
                    .delete()
                    .eq('id', jobId);

                console.log(`[POLL] Server ${jobId} removed (Status: ${status || '0 Players'}).`);
            } else {
                // Normal update
                try {
                    await supabase
                        .from('live_servers')
                        .upsert({
                            id: jobId,
                            server_id: server.id,
                            player_count: playerCount || 0,
                            players: players || [],
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });
                } catch (upsertError) {
                    await supabase
                        .from('live_servers')
                        .upsert({
                            id: jobId,
                            server_id: server.id,
                            player_count: playerCount || 0,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });
                }
            }

            // Periodic Cleanup: Remove any servers that haven't polled in 2 minutes
            const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            await supabase
                .from('live_servers')
                .delete()
                .eq('server_id', server.id)
                .lt('updated_at', staleTime);
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

        return NextResponse.json({
            commands,
            settings: {
                adminCmdsEnabled: server.admin_cmds_enabled !== false,
                miscCmdsEnabled: server.misc_cmds_enabled !== false
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
