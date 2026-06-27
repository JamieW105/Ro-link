import { NextResponse } from 'next/server';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';
import { normalizeModulePanelCommandDefinition } from '@/lib/modulePanelCommands';
import type { AdminPanelCommandDefinition } from '@/lib/adminPanelCommands';
import { buildPlayerPresenceEvents, PLAYER_PRESENCE_RETENTION_MS } from '@/lib/playerPresence';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';

interface QueuedCommand {
    id: string;
    args?: {
        job_id?: string;
    } | null;
}

let supportsModulePanelCommandsColumn = true;
let modulePanelCommandsColumnRetryAt = 0;
let supportsPlayerPresenceEventsTable = true;
let playerPresenceEventsTableRetryAt = 0;

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

interface LiveServerRoster {
    id?: unknown;
    players?: unknown;
}

function isMissingPlayerPresenceEventsTable(error: { code?: string } | null) {
    return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function getPreviousLiveServerPlayers(
    client: ReturnType<typeof getSupabaseAdmin>,
    jobId: string,
) {
    const { data, error } = await client
        .from('live_servers')
        .select('players')
        .eq('id', jobId)
        .maybeSingle();

    if (error) {
        console.warn('[RoLinkAPI][Poll] Could not load the previous player roster for presence tracking.', {
            jobId,
            code: error.code,
            message: error.message,
        });
        return [];
    }

    return data?.players || [];
}

async function recordPlayerPresenceEvents({
    client,
    previousPlayers,
    currentPlayers,
    serverId,
    jobId,
}: {
    client: ReturnType<typeof getSupabaseAdmin>;
    previousPlayers: unknown;
    currentPlayers: unknown;
    serverId: string;
    jobId: string;
}) {
    const events = buildPlayerPresenceEvents({
        previousPlayers,
        currentPlayers,
        serverId,
        jobId,
    });

    if (events.length === 0) {
        return;
    }

    const now = Date.now();
    if (!supportsPlayerPresenceEventsTable && now < playerPresenceEventsTableRetryAt) {
        return;
    }

    const { error } = await client
        .from('player_presence_events')
        .insert(events);

    if (!error) {
        supportsPlayerPresenceEventsTable = true;
        playerPresenceEventsTableRetryAt = 0;
        return;
    }

    if (isMissingPlayerPresenceEventsTable(error)) {
        supportsPlayerPresenceEventsTable = false;
        playerPresenceEventsTableRetryAt = now + 60 * 1000;
        console.warn('[RoLinkAPI][Poll] player_presence_events is missing; player join/leave history is disabled until the schema is migrated.', {
            code: error.code,
            message: error.message,
            migration: 'Run supabase_schema_player_presence.sql.',
        });
        return;
    }

    console.warn('[RoLinkAPI][Poll] Failed to store player presence events.', {
        code: error.code,
        message: error.message,
    });
}

async function cleanupPlayerPresenceEvents(client: ReturnType<typeof getSupabaseAdmin>, serverId: string) {
    const now = Date.now();
    if (!supportsPlayerPresenceEventsTable && now < playerPresenceEventsTableRetryAt) {
        return;
    }

    const expiry = new Date(now - PLAYER_PRESENCE_RETENTION_MS).toISOString();
    const { error } = await client
        .from('player_presence_events')
        .delete()
        .eq('server_id', serverId)
        .lt('occurred_at', expiry);

    if (!error) {
        supportsPlayerPresenceEventsTable = true;
        playerPresenceEventsTableRetryAt = 0;
        return;
    }

    if (isMissingPlayerPresenceEventsTable(error)) {
        supportsPlayerPresenceEventsTable = false;
        playerPresenceEventsTableRetryAt = now + 60 * 1000;
        return;
    }

    console.warn('[RoLinkAPI][Poll] Failed to clean expired player presence events.', {
        code: error.code,
        message: error.message,
    });
}

async function removeStaleLiveServers(
    client: ReturnType<typeof getSupabaseAdmin>,
    serverId: string,
    staleTime: string,
) {
    const { data: staleServers, error: staleQueryError } = await client
        .from('live_servers')
        .select('id, players')
        .eq('server_id', serverId)
        .lt('updated_at', staleTime);

    if (staleQueryError) {
        throw staleQueryError;
    }

    const staleServerRosters = (staleServers || []) as LiveServerRoster[];
    const staleIds = staleServerRosters
        .map((liveServer) => trimString(liveServer.id))
        .filter(Boolean);

    if (staleIds.length === 0) {
        return;
    }

    const { data: deletedServers, error: deleteError } = await client
        .from('live_servers')
        .delete()
        .eq('server_id', serverId)
        .lt('updated_at', staleTime)
        .in('id', staleIds)
        .select('id');

    if (deleteError) {
        throw deleteError;
    }

    const deletedIds = new Set(((deletedServers || []) as LiveServerRoster[]).map((liveServer) => trimString(liveServer.id)));
    await Promise.all(staleServerRosters
        .filter((liveServer) => deletedIds.has(trimString(liveServer.id)))
        .map((liveServer) => recordPlayerPresenceEvents({
            client,
            previousPlayers: liveServer.players,
            currentPlayers: [],
            serverId,
            jobId: trimString(liveServer.id),
        })));
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
    const updatedAt = new Date().toISOString();
    const legacyPayload = {
        id: jobId,
        server_id: serverId,
        player_count: playerCount || 0,
        players: players || [],
        updated_at: updatedAt
    };

    const now = Date.now();
    const shouldRetryModuleCommandsColumn = modulePanelCommands.length > 0 && now >= modulePanelCommandsColumnRetryAt;
    if (!supportsModulePanelCommandsColumn && !shouldRetryModuleCommandsColumn) {
        const fallbackResult = await client
            .from('live_servers')
            .upsert(legacyPayload, { onConflict: 'id' });

        if (fallbackResult.error) {
            throw fallbackResult.error;
        }
        return;
    }

    const payload = {
        ...legacyPayload,
        module_panel_commands: modulePanelCommands,
    };

    const result = await client
        .from('live_servers')
        .upsert(payload, { onConflict: 'id' });

    if (!result.error) {
        supportsModulePanelCommandsColumn = true;
        modulePanelCommandsColumnRetryAt = 0;
        return;
    }

    if (result.error.code === 'PGRST204') {
        supportsModulePanelCommandsColumn = false;
        modulePanelCommandsColumnRetryAt = now + 60 * 1000;
        console.warn('[RoLinkAPI][Poll] live_servers.module_panel_commands is missing; using legacy live server payload until the Supabase schema is migrated.', {
            code: result.error.code,
            message: result.error.message,
            migration: "ALTER TABLE public.live_servers ADD COLUMN IF NOT EXISTS module_panel_commands JSONB NOT NULL DEFAULT '[]'::jsonb;",
        });
    } else {
        console.warn('[RoLinkAPI][Poll] Live server upsert with module commands failed; retrying legacy payload.', {
            code: result.error.code,
            message: result.error.message,
        });
    }

    const fallbackResult = await client
        .from('live_servers')
        .upsert(legacyPayload, { onConflict: 'id' });

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
            const previousPlayers = await getPreviousLiveServerPlayers(db, jobId);
            if (status === 'SHUTDOWN' || playerCount === 0) {
                // Immediate removal
                const { error: deleteError } = await db
                    .from('live_servers')
                    .delete()
                    .eq('id', jobId);

                if (deleteError) throw deleteError;

                await recordPlayerPresenceEvents({
                    client: db,
                    previousPlayers,
                    currentPlayers: [],
                    serverId: server.id,
                    jobId,
                });

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

                await recordPlayerPresenceEvents({
                    client: db,
                    previousPlayers,
                    currentPlayers: players,
                    serverId: server.id,
                    jobId,
                });
            }

            // Periodic Cleanup: Remove any servers that haven't polled in 2 minutes
            const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            await removeStaleLiveServers(db, server.id, staleTime);
            await cleanupPlayerPresenceEvents(db, server.id);
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
