import { GLOBAL_COMMAND_IDS } from './adminPanelCommands';
import { livePlayerMatches, normalizeLivePlayerList } from './livePlayers';
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
    'BROADCAST',
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
    'VIEW',
    'TEAM',
    'WALK_SPEED',
    'JUMP_POWER',
    'FREEZE',
    'UNFREEZE',
    'RAGDOLL',
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
        .gte('updated_at', freshAfter)
        .order('updated_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return (liveServers || []) as LiveServerRecord[];
}

export async function resolveLiveServerTargets(serverId: string) {
    const liveServers = await getFreshLiveServers(serverId);
    const jobIds = Array.from(new Set(
        liveServers
            .map((server) => trimString(server.id))
            .filter(Boolean),
    ));

    return jobIds.map((jobId) => ({
        deliveryId: crypto.randomUUID(),
        jobId,
        scope: 'SERVER' as const,
    })) satisfies DeliveryTarget[];
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

type LocalTeleportPlan =
    | { error: string; status: 400 | 404 }
    | { jobId: string; moves: Array<{ username: string; moderator_roblox_username: string }> };

export function resolveLocalTeleport(
    command: 'BRING' | 'TO',
    args: CommandArgs,
    liveServers: LiveServerRecord[],
    sourceJobId?: string,
): LocalTeleportPlan {
    const scope = normalizeIdentity(args.target_scope);
    const target = getTargetIdentity(args) || (scope === 'global' ? 'global' : '');
    const identities = (Array.isArray(args.usernames) ? args.usernames : target.split(/[\s,]+/))
        .map((identity) => normalizeIdentity(identity).replace(/^@/, ''))
        .filter(Boolean);
    const selector = identities.length === 1 ? identities[0] : '';
    const specialTargets = ['all', 'others', 'global', 'me'];
    if (command === 'TO' && (!selector || specialTargets.includes(selector) || scope === 'global')) {
        return { error: 'To requires exactly one other player in your current server.', status: 400 };
    }
    if (identities.length === 0 || selector === 'others' || (!selector && identities.some((identity) => specialTargets.includes(identity)))) {
        return { error: 'Enter player usernames or use Global or Me on its own.', status: 400 };
    }

    const actorIdentity = trimString(args.moderator_roblox_username);
    if (!actorIdentity) {
        return { error: 'Your Roblox account is required to use Bring or To.', status: 400 };
    }

    const eligibleServers = liveServers.filter((server) => trimString(server.id) && (!sourceJobId || server.id === sourceJobId));
    for (const server of eligibleServers) {
        const roster = normalizeLivePlayerList(server.players);
        const actor = roster.find((player) => livePlayerMatches(player, actorIdentity));
        if (!actor) continue;

        const jobId = trimString(server.id);
        const otherPlayers = roster.filter((player) => player !== actor);
        const targets = selector === 'global' || selector === 'all'
            ? otherPlayers
            : selector === 'me'
                ? [actor]
                : identities.map((identity) => (command === 'TO' ? otherPlayers : roster)
                    .find((player) => livePlayerMatches(player, identity)));
        if (targets.length === 0 || targets.some((target) => !target)) {
            return { error: 'Every target must be in your current Roblox server.', status: 404 };
        }

        return {
            jobId,
            moves: [...new Set(targets)].filter((target) => target != null).map((target) => ({
                username: command === 'TO' ? actor.username : target.username,
                moderator_roblox_username: command === 'TO' ? target.username : actor.username,
            })),
        };
    }

    return { error: 'Join a live Roblox server before using Bring or To.', status: 404 };
}

export async function queueLocalTeleport(
    serverId: string,
    command: 'BRING' | 'TO',
    args: CommandArgs,
    sourceJobId?: string,
) {
    const result = resolveLocalTeleport(command, args, await getFreshLiveServers(serverId), sourceJobId);
    if ('error' in result) return result;

    // The installed bridges already support this command. Polling restricts delivery to the selected job.
    const { error } = await supabase.from('command_queue').insert(result.moves.map((move) => ({
        server_id: serverId,
        command: 'TELEPORT_TO_ME',
        args: buildDeliveryArgs({ ...move, moderator: args.moderator }, {
            deliveryId: crypto.randomUUID(),
            jobId: result.jobId,
            scope: 'SERVER',
        }),
        status: 'PENDING',
    })));
    if (error) throw new Error(error.message);

    return { deliveredTargets: result.moves.length, targetJobId: result.jobId };
}

export async function resolveDeliveryTargets(
    serverId: string,
    command: string,
    args: CommandArgs,
    options?: {
        preferredJobId?: string;
        allowGlobal?: boolean;
        playerTargetCommands?: readonly string[];
    },
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
    if (requestedScope === 'GLOBAL' && (GLOBAL_COMMAND_LOOKUP.has(command) || options?.allowGlobal)) {
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
    const playerTargetCommands = new Set(options?.playerTargetCommands ?? []);
    if (targetIdentity && (PLAYER_TARGET_COMMAND_LOOKUP.has(command) || playerTargetCommands.has(command))) {
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

    if (command === 'VIEW') {
        const viewerIdentity = trimString(args.moderator_roblox_username);
        if (viewerIdentity) {
            const targetJobId = await resolvePlayerJobId(serverId, viewerIdentity, options?.preferredJobId);
            if (!targetJobId) {
                return [] satisfies DeliveryTarget[];
            }

            return [{
                deliveryId: crypto.randomUUID(),
                jobId: targetJobId,
                scope: 'SERVER',
            }] satisfies DeliveryTarget[];
        }
    }

    return [{
        deliveryId: crypto.randomUUID(),
        jobId: null,
        scope: 'COMMAND',
    }] satisfies DeliveryTarget[];
}
