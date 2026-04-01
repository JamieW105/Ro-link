export interface LivePlayer {
    username: string;
    displayName: string;
    userId: string | null;
    avatarUrl: string | null;
}

interface RawLivePlayerObject {
    username?: unknown;
    name?: unknown;
    displayName?: unknown;
    userId?: unknown;
    id?: unknown;
    avatarUrl?: unknown;
    thumbnailUrl?: unknown;
    characterThumbnail?: unknown;
    headshotUrl?: unknown;
}

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function buildAvatarFallback(userId: string | null) {
    if (!userId) {
        return null;
    }

    return `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(userId)}&width=180&height=180&format=png`;
}

export function normalizeLivePlayer(rawPlayer: unknown): LivePlayer | null {
    if (typeof rawPlayer === 'string') {
        const username = trimString(rawPlayer);
        if (!username) {
            return null;
        }

        return {
            username,
            displayName: username,
            userId: null,
            avatarUrl: null,
        };
    }

    if (!rawPlayer || typeof rawPlayer !== 'object') {
        return null;
    }

    const player = rawPlayer as RawLivePlayerObject;
    const username = trimString(player.username || player.name);
    if (!username) {
        return null;
    }

    const userId = trimString(player.userId || player.id) || null;
    const avatarUrl = trimString(
        player.avatarUrl
        || player.thumbnailUrl
        || player.characterThumbnail
        || player.headshotUrl,
    ) || buildAvatarFallback(userId);

    return {
        username,
        displayName: trimString(player.displayName) || username,
        userId,
        avatarUrl,
    };
}

export function normalizeLivePlayerList(rawPlayers: unknown): LivePlayer[] {
    if (!Array.isArray(rawPlayers)) {
        return [];
    }

    const players: LivePlayer[] = [];
    const seen = new Set<string>();

    for (const rawPlayer of rawPlayers) {
        const player = normalizeLivePlayer(rawPlayer);
        if (!player) {
            continue;
        }

        const key = player.userId ? `id:${player.userId}` : `username:${player.username.toLowerCase()}`;
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        players.push(player);
    }

    return players;
}

export function livePlayerMatches(player: LivePlayer, identity: unknown) {
    const normalizedIdentity = trimString(identity).toLowerCase();
    if (!normalizedIdentity) {
        return false;
    }

    return player.username.toLowerCase() === normalizedIdentity
        || (player.userId ? player.userId.toLowerCase() === normalizedIdentity : false);
}

export function findLivePlayer(rawPlayers: unknown, identity: unknown) {
    return normalizeLivePlayerList(rawPlayers).find((player) => livePlayerMatches(player, identity)) || null;
}
