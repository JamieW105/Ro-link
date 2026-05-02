import { NextResponse } from 'next/server';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';
import { supabase } from '@/lib/supabase';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';

interface QueuedCommand {
    id: string;
    args?: {
        job_id?: string;
    } | null;
}

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function getCommandTargetJobId(command: QueuedCommand) {
    return trimString(command?.args?.job_id);
}

export async function GET() {
    return NextResponse.json({
        status: 'API Active',
        message: 'Endpoint ready for Roblox server polling (POST)'
    }, { status: 200 });
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { jobId, playerCount, players, status } = body;
        const auth = readServerApiKeyDetails(req, body.apiKey ?? body.key ?? body.serverKey ?? body.securityKey);
        const authDebug = describeServerApiKeyDetails(auth);
        if (!auth.key) {
            console.warn('[RoLinkAPI][Poll] Missing API key', { auth: authDebug });
            return NextResponse.json({
                error: 'Missing API Key',
                code: 'missing_api_key',
                message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
                auth: authDebug,
            }, { status: 401 });
        }

        // 1. Validate API Key and get Server ID
        const lookup = await findServerByKeyWithDiagnostics<{
            id: string;
            admin_cmds_enabled: boolean | null;
            misc_cmds_enabled: boolean | null;
            enforce_moderation_role_hierarchy: boolean | null;
        }>(
            'id, admin_cmds_enabled, misc_cmds_enabled, enforce_moderation_role_hierarchy',
            auth.key,
        );

        const server = lookup.server;
        if (!server) {
            console.warn('[RoLinkAPI][Poll] Invalid API key', {
                auth: authDebug,
                lookupError: lookup.error,
            });
            return NextResponse.json({
                error: 'Invalid API Key',
                code: 'invalid_api_key',
                message: 'The provided server key did not match any server record.',
                auth: authDebug,
                lookup: {
                    matchedBy: lookup.matchedBy,
                    error: lookup.error,
                },
            }, { status: 401 });
        }

        if (lookup.matchedBy !== 'api_key') {
            console.warn('[RoLinkAPI][Poll] Accepted fallback server key', {
                auth: authDebug,
                matchedBy: lookup.matchedBy,
                serverId: server.id,
            });
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
                } catch {
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
        const relevantCommands = ((commands || []) as QueuedCommand[]).filter((command) => {
            const targetJobId = getCommandTargetJobId(command);
            return !targetJobId || targetJobId === trimString(jobId);
        });

        if (relevantCommands.length > 0) {
            const ids = relevantCommands.map((command) => command.id);
            await supabase
                .from('command_queue')
                .update({ status: 'PROCESSED' })
                .in('id', ids);
        }

        return NextResponse.json({
            commands: relevantCommands,
            settings: {
                adminCmdsEnabled: server.admin_cmds_enabled !== false,
                miscCmdsEnabled: server.misc_cmds_enabled !== false,
                enforceModerationRoleHierarchy: server.enforce_moderation_role_hierarchy !== false,
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
