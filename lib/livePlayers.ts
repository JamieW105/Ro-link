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
    player?: unknown;
    user?: unknown;
    value?: unknown;
    data?: unknown;
    profile?: unknown;
    robloxUser?: unknown;
    robloxPlayer?: unknown;
    avatarUrl?: unknown;
    thumbnailUrl?: unknown;
    characterThumbnail?: unknown;
    headshotUrl?: unknown;
}

function trimString(value: unknown) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim();
    }

    return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getLivePlayerScore(record: RawLivePlayerObject) {
    let score = 0;

    if (trimString(record.username) || trimString(record.name)) {
        score += 2;
    }

    if (trimString(record.displayName)) {
        score += 1;
    }

    if (trimString(record.userId) || trimString(record.id)) {
        score += 1;
    }

    if (
        trimString(record.avatarUrl)
        || trimString(record.thumbnailUrl)
        || trimString(record.characterThumbnail)
        || trimString(record.headshotUrl)
    ) {
        score += 1;
    }

    return score;
}

function unwrapLivePlayerObject(value: unknown, seen = new WeakSet<object>()): RawLivePlayerObject | null {
    if (!isRecord(value)) {
        return null;
    }

    if (seen.has(value)) {
        return null;
    }

    seen.add(value);

    const record = value as RawLivePlayerObject;
    const currentScore = getLivePlayerScore(record);
    let bestMatch: RawLivePlayerObject | null = currentScore > 0 ? record : null;
    let bestScore = currentScore;

    for (const nestedValue of Object.values(record)) {
        if (!isRecord(nestedValue)) {
            continue;
        }

        const nestedMatch = unwrapLivePlayerObject(nestedValue, seen);
        if (!nestedMatch) {
            continue;
        }

        const nestedScore = getLivePlayerScore(nestedMatch);
        if (nestedScore > bestScore) {
            bestMatch = nestedMatch;
            bestScore = nestedScore;
        }
    }

    return bestMatch;
}

function collectNestedLivePlayerEntries(value: unknown, depth = 0): unknown[] {
    if (depth > 3) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.flatMap((entry) => collectNestedLivePlayerEntries(entry, depth + 1));
    }

    if (!isRecord(value)) {
        return [];
    }

    if (getLivePlayerScore(value as RawLivePlayerObject) > 0) {
        return [value];
    }

    return Object.values(value).flatMap((entry) => collectNestedLivePlayerEntries(entry, depth + 1));
}

function toRawLivePlayerEntries(rawPlayers: unknown) {
    if (Array.isArray(rawPlayers)) {
        return rawPlayers;
    }

    if (!isRecord(rawPlayers)) {
        return [];
    }

    if (getLivePlayerScore(rawPlayers as RawLivePlayerObject) > 0) {
        return [rawPlayers];
    }

    const nestedEntries = Object.values(rawPlayers).flatMap((entry) => collectNestedLivePlayerEntries(entry));
    return nestedEntries.length > 0 ? nestedEntries : Object.values(rawPlayers);
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

    const player = unwrapLivePlayerObject(rawPlayer);
    if (!player) {
        return null;
    }

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
    const players: LivePlayer[] = [];
    const seen = new Set<string>();

    for (const rawPlayer of toRawLivePlayerEntries(rawPlayers)) {
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
