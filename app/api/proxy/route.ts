import { NextResponse } from 'next/server';

type RobloxProfilePayload = {
    id: number;
    username: string;
    displayName: string;
    description: string;
    created: string;
    isBanned?: boolean;
    avatarUrl: string;
};

type CachedProfile = {
    expiresAt: number;
    payload: RobloxProfilePayload;
};

const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
const profileCache = new Map<string, CachedProfile>();

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function getCachedProfile(cacheKey: string, includeExpired = false) {
    const cached = profileCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (!includeExpired && cached.expiresAt <= Date.now()) {
        profileCache.delete(cacheKey);
        return null;
    }

    return cached.payload;
}

function cacheProfile(cacheKey: string, payload: RobloxProfilePayload) {
    profileCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
    });
}

async function resolveUserId(username: string) {
    const numericUserId = Number(username);
    if (Number.isInteger(numericUserId) && numericUserId > 0) {
        return numericUserId;
    }

    const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });

    if (!searchRes.ok) {
        return { error: `Roblox Search Error (${searchRes.status})`, status: searchRes.status };
    }

    const searchData = await searchRes.json();
    const userId = searchData?.data?.[0]?.id;
    if (!userId) {
        return { error: 'Player not found', status: 404 };
    }

    return Number(userId);
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = trimString(searchParams.get('username'));

    if (!username) {
        return NextResponse.json({
            status: 'API Active',
            message: 'Ready for Roblox profile proxy'
        }, { status: 200 });
    }

    const cacheKey = username.toLowerCase();
    const cachedProfile = getCachedProfile(cacheKey);
    if (cachedProfile) {
        return NextResponse.json(cachedProfile, {
            headers: { 'Cache-Control': 'private, max-age=300' },
        });
    }

    try {
        const resolvedUserId = await resolveUserId(username);
        if (typeof resolvedUserId !== 'number') {
            const staleProfile = getCachedProfile(cacheKey, true);
            if (staleProfile && resolvedUserId.status === 429) {
                return NextResponse.json(staleProfile, {
                    headers: {
                        'Cache-Control': 'private, max-age=60',
                        'X-Roblox-Profile-Cache': 'stale',
                    },
                });
            }

            return NextResponse.json({ error: resolvedUserId.error }, { status: resolvedUserId.status });
        }

        const userId = resolvedUserId;
        const profileRes = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(String(userId))}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!profileRes.ok) {
            const staleProfile = getCachedProfile(cacheKey, true);
            if (staleProfile && profileRes.status === 429) {
                return NextResponse.json(staleProfile, {
                    headers: {
                        'Cache-Control': 'private, max-age=60',
                        'X-Roblox-Profile-Cache': 'stale',
                    },
                });
            }

            return NextResponse.json({ error: `Roblox Profile Error (${profileRes.status})` }, { status: profileRes.status });
        }

        const profileData = await profileRes.json();

        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        const thumbData = thumbRes.ok ? await thumbRes.json() : {};
        const avatarUrl = thumbData.data?.[0]?.imageUrl || '';

        const payload = {
            id: userId,
            username: profileData.name,
            displayName: profileData.displayName,
            description: profileData.description,
            created: profileData.created,
            isBanned: profileData.isBanned,
            avatarUrl
        };

        cacheProfile(cacheKey, payload);
        cacheProfile(String(userId), payload);

        return NextResponse.json(payload, {
            headers: { 'Cache-Control': 'private, max-age=300' },
        });

    } catch (error) {
        console.error('Roblox Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to fetch Roblox data' }, { status: 500 });
    }
}
