import { getSupabaseAdmin } from './supabaseAdmin';
import { normalizeLivePlayerList } from './livePlayers';

const LIVE_SERVER_FRESHNESS_MS = 5 * 60 * 1000;

type LiveServerRecord = {
    id?: string | null;
    players?: unknown;
};

type VerifiedUserRecord = {
    discord_id?: string | null;
    roblox_id?: string | number | null;
    roblox_username?: string | null;
};

export type ReportServerContext = {
    reporter_live_server_id: string | null;
    reporter_join_url: string | null;
    reported_live_server_id: string | null;
    reported_join_url: string | null;
};

export type ResolveReportServerContextInput = {
    serverId: string;
    placeId?: string | number | null;
    reporterDiscordId?: string | null;
    reporterRobloxUsername?: string | null;
    reporterLiveServerId?: string | null;
    reportedRobloxUsername: string;
};

const emptyContext = (): ReportServerContext => ({
    reporter_live_server_id: null,
    reporter_join_url: null,
    reported_live_server_id: null,
    reported_join_url: null,
});

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function normalizeIdentity(value: unknown) {
    return trimString(value).toLowerCase();
}

function buildRobloxJoinUrl(placeId: unknown, jobId: unknown) {
    const normalizedPlaceId = trimString(placeId);
    const normalizedJobId = trimString(jobId);
    if (!normalizedPlaceId || !normalizedJobId) {
        return null;
    }

    return `https://www.roblox.com/games/start?placeId=${encodeURIComponent(normalizedPlaceId)}&gameInstanceId=${encodeURIComponent(normalizedJobId)}`;
}

function findLiveServer(liveServers: LiveServerRecord[], identities: unknown[]) {
    const normalizedIdentities = new Set(
        identities
            .map(normalizeIdentity)
            .filter(Boolean),
    );

    return liveServers.find((liveServer) => (
        normalizeLivePlayerList(liveServer.players).some((player) => (
            normalizedIdentities.has(normalizeIdentity(player.username))
            || normalizedIdentities.has(normalizeIdentity(player.displayName))
            || normalizedIdentities.has(normalizeIdentity(player.userId))
        ))
    )) || null;
}

function isDiscordId(value: string) {
    return /^\d{17,20}$/.test(value);
}

/**
 * Captures the live Roblox jobs occupied by the reporter and reported player at
 * report creation time. These are snapshots: later presence changes do not
 * change the historical report context.
 */
export async function resolveReportServerContext(input: ResolveReportServerContextInput): Promise<ReportServerContext> {
    const serverId = trimString(input.serverId);
    const reporterDiscordId = trimString(input.reporterDiscordId);
    const reporterRobloxUsername = trimString(input.reporterRobloxUsername);
    const reporterLiveServerId = trimString(input.reporterLiveServerId);
    const reportedRobloxUsername = trimString(input.reportedRobloxUsername);

    if (!serverId || !reportedRobloxUsername) {
        return emptyContext();
    }

    try {
        const client = getSupabaseAdmin();
        const reporterNeedsLookup = /^\d{5,32}$/.test(reporterDiscordId);
        const reportedNeedsLookup = isDiscordId(reportedRobloxUsername);
        const freshAfter = new Date(Date.now() - LIVE_SERVER_FRESHNESS_MS).toISOString();

        const [liveServersResult, reporterResult, reportedResult] = await Promise.all([
            client
                .from('live_servers')
                .select('id, players')
                .eq('server_id', serverId)
                .gte('updated_at', freshAfter)
                .order('updated_at', { ascending: false }),
            reporterNeedsLookup
                ? client
                    .from('verified_users')
                    .select('discord_id, roblox_id, roblox_username')
                    .eq('discord_id', reporterDiscordId)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            reportedNeedsLookup
                ? client
                    .from('verified_users')
                    .select('discord_id, roblox_id, roblox_username')
                    .eq('discord_id', reportedRobloxUsername)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);

        if (liveServersResult.error) {
            throw liveServersResult.error;
        }
        if (reporterResult.error) {
            throw reporterResult.error;
        }
        if (reportedResult.error) {
            throw reportedResult.error;
        }

        const liveServers = (liveServersResult.data || []) as LiveServerRecord[];
        const reporter = reporterResult.data as VerifiedUserRecord | null;
        const reported = reportedResult.data as VerifiedUserRecord | null;
        const reporterServer = findLiveServer(liveServers, [
            reporterRobloxUsername,
            reporterDiscordId,
            reporter?.roblox_username,
            reporter?.roblox_id,
        ]);
        const reportedServer = findLiveServer(liveServers, [
            reportedRobloxUsername,
            reported?.roblox_username,
            reported?.roblox_id,
        ]);
        const reporterJobId = reporterLiveServerId || trimString(reporterServer?.id) || null;
        const reportedJobId = trimString(reportedServer?.id) || null;

        return {
            reporter_live_server_id: reporterJobId,
            reporter_join_url: buildRobloxJoinUrl(input.placeId, reporterJobId),
            reported_live_server_id: reportedJobId,
            reported_join_url: buildRobloxJoinUrl(input.placeId, reportedJobId),
        };
    } catch (error) {
        // Presence is supplemental context. A transient roster failure must not block a report.
        console.warn('[Reports] Failed to capture live server context:', error);
        return emptyContext();
    }
}
