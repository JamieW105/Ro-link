import { GLOBAL_COMMAND_IDS } from './adminPanelCommands';
import { supabase } from './supabase';

export type CommandArgs = Record<string, unknown>;

export type DeliveryTarget = {
    deliveryId: string;
    jobId: string | null;
    scope: 'COMMAND' | 'SERVER' | 'GLOBAL';
};

const LIVE_SERVER_FRESHNESS_MS = 2 * 60 * 1000;

const GLOBAL_COMMAND_LOOKUP = new Set<string>(GLOBAL_COMMAND_IDS);
const PLAYER_TARGET_COMMAND_LOOKUP = new Set<string>([
    'KICK',
    'BAN',
    'UNBAN',
    'SOFTBAN',
    'FLY',
    'NOCLIP',
    'INVIS',
    'GHOST',
    'SET_CHAR',
    'HEAL',
    'DAMAGE',
    'KILL',
    'MAX_HEALTH',
    'RESET',
    'REFRESH',
    'WALK_SPEED',
    'JUMP_POWER',
    'FREEZE',
    'UNFREEZE',
    'BRING_TO_SPAWN',
    'TELEPORT_TO_ME',
    'FORCEFIELD_ADD',
    'FORCEFIELD_REMOVE',
]);

type LiveServerRecord = {
    id?: string | null;
    players?: unknown;
};

export function trimString(value: unknown) {
    return String(value ?? '').trim();
}

export function buildDeliveryArgs(baseArgs: CommandArgs, target: DeliveryTarget) {
    const nextArgs: CommandArgs = { ...baseArgs };
    nextArgs.delivery_id = target.deliveryId;

    if (target.jobId) {
        nextArgs.job_id = target.jobId;
    } else {
        delete nextArgs.job_id;
    }

    if (target.scope !== 'COMMAND') {
        nextArgs.target_scope = target.scope;
    } else if (!trimString(nextArgs.target_scope)) {
        delete nextArgs.target_scope;
    }

    return nextArgs;
}

function normalizeIdentity(value: unknown) {
    return trimString(value).toLowerCase();
}

function getTargetIdentity(args: CommandArgs) {
    return trimString(
        args.username
        || args.targetName
        || args.userIdentity
        || args.target_label,
    );
}

function playerMatchesIdentity(player: unknown, targetIdentity: string) {
    const normalizedTarget = normalizeIdentity(targetIdentity);
    if (!normalizedTarget) {
        return false;
    }

    if (typeof player === 'string' || typeof player === 'number') {
        return normalizeIdentity(player) === normalizedTarget;
    }

    if (!player || typeof player !== 'object') {
        return false;
    }

    const record = player as Record<string, unknown>;
    const candidates = [
        record.username,
        record.name,
        record.displayName,
        record.userId,
        record.UserId,
    ];

    return candidates.some((candidate) => normalizeIdentity(candidate) === normalizedTarget);
}

async function getFreshLiveServers(serverId: string) {
    const freshAfter = new Date(Date.now() - LIVE_SERVER_FRESHNESS_MS).toISOString();
    const { data: liveServers, error } = await supabase
        .from('live_servers')
        .select('id, players')
        .eq('server_id', serverId)
        .gte('updated_at', freshAfter);

    if (error) {
        throw new Error(error.message);
    }

    return (liveServers || []) as LiveServerRecord[];
}

function liveServerHasPlayer(server: LiveServerRecord, targetIdentity: string) {
    return Array.isArray(server.players)
        && server.players.some((player) => playerMatchesIdentity(player, targetIdentity));
}

async function resolvePlayerJobId(serverId: string, targetIdentity: string, preferredJobId?: string) {
    const liveServers = await getFreshLiveServers(serverId);
    const preferred = trimString(preferredJobId);

    if (preferred) {
        const preferredServer = liveServers.find((server) => trimString(server.id) === preferred);
        if (preferredServer && liveServerHasPlayer(preferredServer, targetIdentity)) {
            return preferred;
        }
    }

    const matchedServer = liveServers.find((server) => liveServerHasPlayer(server, targetIdentity));
    return trimString(matchedServer?.id) || null;
}

export async function resolveDeliveryTargets(
    serverId: string,
    command: string,
    args: CommandArgs,
    options?: { preferredJobId?: string },
) {
    const requestedJobId = trimString(args.job_id);
    if (requestedJobId) {
        return [{
            deliveryId: crypto.randomUUID(),
            jobId: requestedJobId,
            scope: 'SERVER',
        }] satisfies DeliveryTarget[];
    }

    const requestedScope = trimString(args.target_scope).toUpperCase();
    if (requestedScope === 'GLOBAL' && GLOBAL_COMMAND_LOOKUP.has(command)) {
        const liveServers = await getFreshLiveServers(serverId);
        const jobIds = Array.from(new Set(
            liveServers
                .map((server) => trimString(server.id))
                .filter(Boolean),
        ));

        return jobIds.map((jobId) => ({
            deliveryId: crypto.randomUUID(),
            jobId,
            scope: 'GLOBAL',
        })) satisfies DeliveryTarget[];
    }

    const targetIdentity = getTargetIdentity(args);
    if (targetIdentity && PLAYER_TARGET_COMMAND_LOOKUP.has(command)) {
        const targetJobId = await resolvePlayerJobId(serverId, targetIdentity, options?.preferredJobId);
        if (!targetJobId) {
            return [] satisfies DeliveryTarget[];
        }

        return [{
            deliveryId: crypto.randomUUID(),
            jobId: targetJobId,
            scope: 'SERVER',
        }] satisfies DeliveryTarget[];
    }

    return [{
        deliveryId: crypto.randomUUID(),
        jobId: null,
        scope: 'COMMAND',
    }] satisfies DeliveryTarget[];
}
