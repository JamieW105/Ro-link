import { NextRequest, NextResponse } from 'next/server';

import { normalizeLivePlayerList } from '@/lib/livePlayers';
import { requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type OptionItem = {
    value: string;
    label: string;
    description?: string;
    iconUrl?: string | null;
    data?: Record<string, unknown>;
};

type LiveServerRow = {
    id?: string | null;
    player_count?: number | null;
    players?: unknown;
    updated_at?: string | null;
};

type RobloxSearchUser = {
    id?: unknown;
    name?: unknown;
    displayName?: unknown;
};

type RobloxThumbnail = {
    targetId?: unknown;
    imageUrl?: unknown;
};

function matchesQuery(values: unknown[], query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;

    return values.some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
}

function formatServerLabel(jobId: string) {
    return jobId ? `Server ${jobId.slice(0, 8).toUpperCase()}` : 'Live Server';
}

async function fetchLiveServers(serverId: string) {
    const freshAfter = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await getSupabaseAdmin()
        .from('live_servers')
        .select('id, player_count, players, updated_at')
        .eq('server_id', serverId)
        .gte('updated_at', freshAfter)
        .order('updated_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as LiveServerRow[];
}

async function fetchRobloxUsers(query: string): Promise<OptionItem[]> {
    if (query.length < 2) return [];

    const searchResponse = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(query)}&limit=10`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });

    if (!searchResponse.ok) {
        throw new Error(`Roblox user search failed (${searchResponse.status}).`);
    }

    const searchPayload = await searchResponse.json().catch(() => ({}));
    const users = (Array.isArray(searchPayload.data) ? searchPayload.data : []) as RobloxSearchUser[];
    const userIds = users
        .map((user) => trimString(user?.id))
        .filter(Boolean);

    let thumbnails = new Map<string, string>();
    if (userIds.length > 0) {
        const thumbnailResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds.map((userId) => encodeURIComponent(userId)).join(',')}&size=150x150&format=Png&isCircular=false`,
            { headers: { Accept: 'application/json' }, cache: 'no-store' },
        ).catch(() => null);

        if (thumbnailResponse?.ok) {
            const thumbnailPayload = await thumbnailResponse.json().catch(() => ({}));
            thumbnails = new Map(
                ((Array.isArray(thumbnailPayload.data) ? thumbnailPayload.data : []) as RobloxThumbnail[])
                    .map((item) => [trimString(item?.targetId), trimString(item?.imageUrl)]),
            );
        }
    }

    return users
        .map((user): OptionItem | null => {
            const userId = trimString(user?.id);
            const username = trimString(user?.name);
            if (!userId || !username) return null;

            const displayName = trimString(user?.displayName) || username;
            const iconUrl = thumbnails.get(userId) || `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(userId)}&width=180&height=180&format=png`;
            return {
                value: username,
                label: username,
                description: displayName === username ? `Roblox ID ${userId}` : `${displayName} - ${userId}`,
                iconUrl,
                data: {
                    username,
                    Username: username,
                    name: username,
                    Name: username,
                    displayName,
                    DisplayName: displayName,
                    userId,
                    UserId: userId,
                    id: userId,
                    Id: userId,
                    avatarUrl: iconUrl,
                    source: 'roblox-users',
                },
            };
        })
        .filter((item): item is OptionItem => Boolean(item));
}

function buildServerOptions(liveServers: LiveServerRow[], query: string): OptionItem[] {
    return liveServers
        .map((server) => {
            const jobId = trimString(server.id);
            const playerCount = Number(server.player_count || 0);
            return {
                value: jobId,
                label: formatServerLabel(jobId),
                description: `${playerCount} ${playerCount === 1 ? 'player' : 'players'}`,
                data: {
                    jobId,
                    JobId: jobId,
                    job_id: jobId,
                    id: jobId,
                    Id: jobId,
                    name: formatServerLabel(jobId),
                    Name: formatServerLabel(jobId),
                    playerCount,
                    PlayerCount: playerCount,
                    player_count: playerCount,
                    updatedAt: server.updated_at || null,
                    source: 'live-servers',
                },
            };
        })
        .filter((option) => option.value && matchesQuery([option.value, option.label, option.description], query))
        .slice(0, 50);
}

function buildLivePlayerOptions(liveServers: LiveServerRow[], query: string, jobId: string): OptionItem[] {
    const servers = jobId
        ? liveServers.filter((server) => trimString(server.id) === jobId)
        : liveServers;
    const seen = new Set<string>();
    const options: OptionItem[] = [];

    for (const server of servers) {
        const serverJobId = trimString(server.id);
        for (const player of normalizeLivePlayerList(server.players)) {
            const key = player.userId ? `id:${player.userId}` : `name:${player.username.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);

            if (!matchesQuery([player.username, player.displayName, player.userId], query)) continue;

            options.push({
                value: player.username,
                label: player.username,
                description: player.displayName === player.username
                    ? `In ${formatServerLabel(serverJobId)}`
                    : `${player.displayName} - ${formatServerLabel(serverJobId)}`,
                iconUrl: player.avatarUrl,
                data: {
                    username: player.username,
                    Username: player.username,
                    name: player.username,
                    Name: player.username,
                    displayName: player.displayName,
                    DisplayName: player.displayName,
                    userId: player.userId,
                    UserId: player.userId,
                    id: player.userId,
                    Id: player.userId,
                    avatarUrl: player.avatarUrl,
                    jobId: serverJobId,
                    JobId: serverJobId,
                    job_id: serverJobId,
                    source: jobId ? 'live-server-players' : 'live-players',
                },
            });
        }
    }

    return options.slice(0, 50);
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const type = trimString(req.nextUrl.searchParams.get('type')).toLowerCase();
    const source = trimString(req.nextUrl.searchParams.get('source')).toLowerCase();
    const query = trimString(req.nextUrl.searchParams.get('query')).slice(0, 80);
    const jobId = trimString(req.nextUrl.searchParams.get('jobId')).slice(0, 120);

    const access = await requireDashboardAccess(serverId);
    if ('error' in access) {
        return access.error;
    }

    try {
        if (type === 'player' && source === 'roblox-users') {
            return NextResponse.json({ options: await fetchRobloxUsers(query) });
        }

        const liveServers = await fetchLiveServers(serverId);
        if (type === 'server') {
            return NextResponse.json({ options: buildServerOptions(liveServers, query) });
        }

        if (type === 'player') {
            return NextResponse.json({
                options: buildLivePlayerOptions(liveServers, query, source === 'live-server-players' ? jobId : ''),
            });
        }

        return NextResponse.json({ options: [] });
    } catch (error) {
        console.error('[Module Input Options API] Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load options.' }, { status: 500 });
    }
}
