import { normalizeLivePlayerList, type LivePlayer } from './livePlayers';

export const PLAYER_PRESENCE_RETENTION_MS = 30 * 60 * 1000;

export type PlayerPresenceEventType = 'JOIN' | 'LEAVE';

export type PlayerPresenceEventInsert = {
    server_id: string;
    job_id: string;
    roblox_user_id: string | null;
    username: string;
    display_name: string;
    avatar_url: string | null;
    event_type: PlayerPresenceEventType;
    occurred_at: string;
};

export type PlayerPresenceActivity = PlayerPresenceEventInsert & {
    id?: string;
};

function normalizeIdentity(value: unknown) {
    return String(value ?? '').trim().toLowerCase();
}

function playerMatches(left: LivePlayer, right: LivePlayer) {
    const leftUserId = normalizeIdentity(left.userId);
    const rightUserId = normalizeIdentity(right.userId);

    if (leftUserId && rightUserId && leftUserId === rightUserId) {
        return true;
    }

    return normalizeIdentity(left.username) === normalizeIdentity(right.username);
}

function toPresenceEvent(
    player: LivePlayer,
    eventType: PlayerPresenceEventType,
    serverId: string,
    jobId: string,
    occurredAt: string,
): PlayerPresenceEventInsert {
    return {
        server_id: serverId,
        job_id: jobId,
        roblox_user_id: player.userId,
        username: player.username,
        display_name: player.displayName || player.username,
        avatar_url: player.avatarUrl,
        event_type: eventType,
        occurred_at: occurredAt,
    };
}

/**
 * Compares consecutive live-server rosters. A roster received for the first
 * time is treated as joins, which makes users immediately searchable.
 */
export function buildPlayerPresenceEvents({
    previousPlayers,
    currentPlayers,
    serverId,
    jobId,
    occurredAt = new Date().toISOString(),
}: {
    previousPlayers: unknown;
    currentPlayers: unknown;
    serverId: string;
    jobId: string;
    occurredAt?: string;
}) {
    const previous = normalizeLivePlayerList(previousPlayers);
    const current = normalizeLivePlayerList(currentPlayers);
    const events: PlayerPresenceEventInsert[] = [];

    for (const player of current) {
        if (!previous.some((previousPlayer) => playerMatches(previousPlayer, player))) {
            events.push(toPresenceEvent(player, 'JOIN', serverId, jobId, occurredAt));
        }
    }

    for (const player of previous) {
        if (!current.some((currentPlayer) => playerMatches(player, currentPlayer))) {
            events.push(toPresenceEvent(player, 'LEAVE', serverId, jobId, occurredAt));
        }
    }

    return events;
}
