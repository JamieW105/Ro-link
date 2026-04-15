export interface NormalizedDashboardLog {
    id: string;
    action: string;
    target: string;
    moderator: string;
    timestamp: string;
    server_id: string | null;
}

interface RawLogRecord {
    id?: unknown;
    action?: unknown;
    target?: unknown;
    moderator?: unknown;
    timestamp?: unknown;
    server_id?: unknown;
}

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function formatActorLikeValue(value: Record<string, unknown>) {
    const username = trimString(value.username || value.name);
    const displayName = trimString(value.displayName);
    const userId = trimString(value.userId || value.id);

    if (displayName && username) {
        if (displayName.toLowerCase() === username.toLowerCase()) {
            return displayName;
        }

        return `${displayName} (@${username})`;
    }

    return displayName || username || userId;
}

export function stringifyLogValue(value: unknown, fallback = 'Unknown'): string {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const nextValue = String(value).trim();
        return nextValue || fallback;
    }

    if (Array.isArray(value)) {
        const nextValue: string = value
            .map((entry) => stringifyLogValue(entry, ''))
            .filter(Boolean)
            .join(', ');

        return nextValue || fallback;
    }

    if (value && typeof value === 'object') {
        const actorLikeLabel = formatActorLikeValue(value as Record<string, unknown>);
        if (actorLikeLabel) {
            return actorLikeLabel;
        }

        try {
            const serialized = JSON.stringify(value);
            return trimString(serialized) || fallback;
        } catch {
            return fallback;
        }
    }

    return fallback;
}

export function normalizeDashboardLog(rawLog: unknown): NormalizedDashboardLog | null {
    if (!rawLog || typeof rawLog !== 'object') {
        return null;
    }

    const log = rawLog as RawLogRecord;
    const action = stringifyLogValue(log.action, 'UNKNOWN');
    const target = stringifyLogValue(log.target, 'Unknown Target');
    const moderator = stringifyLogValue(log.moderator, 'System');
    const timestamp = trimString(log.timestamp) || new Date(0).toISOString();
    const serverId = trimString(log.server_id) || null;
    const id = trimString(log.id) || `${timestamp}-${action}-${target}-${moderator}`;

    return {
        id,
        action,
        target,
        moderator,
        timestamp,
        server_id: serverId,
    };
}

export function normalizeDashboardLogs(rawLogs: unknown): NormalizedDashboardLog[] {
    if (!Array.isArray(rawLogs)) {
        return [] as NormalizedDashboardLog[];
    }

    return rawLogs
        .map((log) => normalizeDashboardLog(log))
        .filter((log): log is NormalizedDashboardLog => Boolean(log));
}
