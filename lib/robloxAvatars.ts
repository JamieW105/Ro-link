const AVATAR_PROXY_PATH = '/api/roblox/avatar';

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

export function buildRobloxAvatarUrl(userId: unknown, size = 150) {
    const normalizedUserId = trimString(userId);
    if (!normalizedUserId) {
        return null;
    }

    const params = new URLSearchParams({
        userId: normalizedUserId,
        size: String(size),
    });

    return `${AVATAR_PROXY_PATH}?${params.toString()}`;
}

export function normalizeRobloxAvatarUrl(rawUrl: unknown, fallbackUserId?: unknown, size = 150) {
    const avatarUrl = trimString(rawUrl);
    if (!avatarUrl) {
        return buildRobloxAvatarUrl(fallbackUserId, size);
    }

    try {
        const parsed = new URL(avatarUrl, 'https://ro-link.local');
        const hostname = parsed.hostname.toLowerCase();

        if (hostname === 'www.roblox.com' && parsed.pathname.toLowerCase() === '/headshot-thumbnail/image') {
            return buildRobloxAvatarUrl(parsed.searchParams.get('userId') || fallbackUserId, size);
        }

        if (hostname === 'thumbnails.roblox.com' && parsed.pathname.toLowerCase().includes('/avatar-headshot')) {
            const firstUserId = (parsed.searchParams.get('userIds') || '').split(',')[0];
            return buildRobloxAvatarUrl(firstUserId || fallbackUserId, size);
        }
    } catch {
        return buildRobloxAvatarUrl(fallbackUserId, size);
    }

    return avatarUrl;
}
