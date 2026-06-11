import { NextResponse } from 'next/server';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';
import { normalizeModulePanelCommandDefinition } from '@/lib/modulePanelCommands';
import type { AdminPanelCommandDefinition } from '@/lib/adminPanelCommands';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
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

function normalizeModulePanelCommandPayload(value: unknown) {
    const rawCommands = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? Object.values(value as Record<string, unknown>)
            : [];

    return rawCommands
        .map(normalizeModulePanelCommandDefinition)
        .filter((command): command is AdminPanelCommandDefinition => Boolean(command))
        .slice(0, 100);
}

async function upsertLiveServer({
    client,
    jobId,
    serverId,
    playerCount,
    players,
    modulePanelCommands,
}: {
    client: ReturnType<typeof getSupabaseAdmin>;
    jobId: string;
    serverId: string;
    playerCount: unknown;
    players: unknown;
    modulePanelCommands: AdminPanelCommandDefinition[];
}) {
    const payload = {
        id: jobId,
        server_id: serverId,
        player_count: playerCount || 0,
        players: players || [],
        module_panel_commands: modulePanelCommands,
        updated_at: new Date().toISOString()
    };

    const result = await client
        .from('live_servers')
        .upsert(payload, { onConflict: 'id' });

    if (!result.error) {
        return;
    }

    console.warn('[RoLinkAPI][Poll] Live server upsert with module commands failed; retrying legacy payload.', {
        code: result.error.code,
        message: result.error.message,
    });

    const fallbackResult = await client
        .from('live_servers')
        .upsert({
            id: payload.id,
            server_id: payload.server_id,
            player_count: payload.player_count,
            players: payload.players,
            updated_at: payload.updated_at
        }, { onConflict: 'id' });

    if (fallbackResult.error) {
        throw fallbackResult.error;
    }
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
        const modulePanelCommands = normalizeModulePanelCommandPayload(body.modulePanelCommands ?? body.module_panel_commands);
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

        const db = getSupabaseAdmin();

        // 2. Handle Shutdown (Explicit via status or implicit via 0 players)
        if (jobId) {
            if (status === 'SHUTDOWN' || playerCount === 0) {
                // Immediate removal
                const { error: deleteError } = await db
                    .from('live_servers')
                    .delete()
                    .eq('id', jobId);

                if (deleteError) throw deleteError;

                console.log(`[POLL] Server ${jobId} removed (Status: ${status || '0 Players'}).`);
            } else {
                // Normal update
                await upsertLiveServer({
                    client: db,
                    jobId,
                    serverId: server.id,
                    playerCount,
                    players,
                    modulePanelCommands,
                });
            }

            // Periodic Cleanup: Remove any servers that haven't polled in 2 minutes
            const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            const { error: cleanupError } = await db
                .from('live_servers')
                .delete()
                .eq('server_id', server.id)
                .lt('updated_at', staleTime);

            if (cleanupError) throw cleanupError;
        }

        // 3. Fetch Pending Commands
        const { data: commands, error: commandError } = await db
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
            const { error: updateError } = await db
                .from('command_queue')
                .update({ status: 'PROCESSED' })
                .in('id', ids);

            if (updateError) throw updateError;
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
