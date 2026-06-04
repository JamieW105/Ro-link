import { NextRequest, NextResponse } from 'next/server';

const VALID_SIZES = new Set([48, 50, 60, 75, 100, 110, 150, 180, 352, 420, 720]);
const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

function fallbackAvatar(req: NextRequest) {
    return NextResponse.redirect(new URL('/Media/Roblox.png', req.nextUrl), {
        headers: {
            'Cache-Control': CACHE_CONTROL,
        },
    });
}

function normalizeSize(value: string | null) {
    const parsed = Number(value);
    if (VALID_SIZES.has(parsed)) {
        return parsed;
    }

    return 150;
}

function normalizeUserId(value: string | null) {
    const normalized = String(value || '').trim();
    return /^\d+$/.test(normalized) ? normalized : '';
}

export async function GET(req: NextRequest) {
    const userId = normalizeUserId(req.nextUrl.searchParams.get('userId'));
    if (!userId) {
        return fallbackAvatar(req);
    }

    const size = normalizeSize(req.nextUrl.searchParams.get('size'));
    const thumbnailUrl = new URL('https://thumbnails.roblox.com/v1/users/avatar-headshot');
    thumbnailUrl.searchParams.set('userIds', userId);
    thumbnailUrl.searchParams.set('size', `${size}x${size}`);
    thumbnailUrl.searchParams.set('format', 'Png');
    thumbnailUrl.searchParams.set('isCircular', 'false');

    const response = await fetch(thumbnailUrl, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
        return fallbackAvatar(req);
    }

    const payload = await response.json().catch(() => ({}));
    const imageUrl = Array.isArray(payload?.data) && typeof payload.data[0]?.imageUrl === 'string'
        ? payload.data[0].imageUrl
        : '';

    if (!imageUrl) {
        return fallbackAvatar(req);
    }

    const imageResponse = await fetch(imageUrl, {
        headers: { Accept: 'image/png,image/*' },
        next: { revalidate: 60 * 60 },
    });

    if (!imageResponse.ok || !imageResponse.body) {
        return fallbackAvatar(req);
    }

    return new NextResponse(imageResponse.body, {
        headers: {
            'Cache-Control': CACHE_CONTROL,
            'Content-Type': imageResponse.headers.get('content-type') || 'image/png',
        },
    });
}
