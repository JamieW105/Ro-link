import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const VALID_SIZES = new Set([48, 50, 60, 75, 100, 110, 150, 180, 352, 420, 720]);
const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';
const ROBLOX_HEADERS = {
    Accept: 'image/png,image/*,application/json',
    Referer: 'https://www.roblox.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
};

export const runtime = 'nodejs';

async function fallbackAvatar() {
    const fallbackPath = path.join(process.cwd(), 'public', 'Media', 'Roblox.png');
    const image = await readFile(fallbackPath);

    return new NextResponse(new Uint8Array(image), {
        headers: {
            'Cache-Control': CACHE_CONTROL,
            'Content-Type': 'image/png',
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

function buildThumbnailUrl(origin: string, userId: string, size: number) {
    const thumbnailUrl = new URL('/v1/users/avatar-headshot', origin);
    thumbnailUrl.searchParams.set('userIds', userId);
    thumbnailUrl.searchParams.set('size', `${size}x${size}`);
    thumbnailUrl.searchParams.set('format', 'Png');
    thumbnailUrl.searchParams.set('isCircular', 'false');
    return thumbnailUrl;
}

async function fetchThumbnailImageUrl(userId: string, size: number) {
    const thumbnailOrigins = [
        'https://thumbnails.roblox.com',
        'https://thumbnails.roproxy.com',
    ];

    for (const origin of thumbnailOrigins) {
        const response = await fetch(buildThumbnailUrl(origin, userId, size), {
            headers: ROBLOX_HEADERS,
            next: { revalidate: 60 * 60 },
        });

        if (!response.ok) {
            continue;
        }

        const payload = await response.json().catch(() => ({}));
        const imageUrl = Array.isArray(payload?.data) && typeof payload.data[0]?.imageUrl === 'string'
            ? payload.data[0].imageUrl
            : '';

        if (imageUrl) {
            return imageUrl;
        }
    }

    return '';
}

async function fetchAvatarImage(imageUrl: string) {
    const imageResponse = await fetch(imageUrl, {
        headers: ROBLOX_HEADERS,
        next: { revalidate: 60 * 60 },
    });

    if (!imageResponse.ok) {
        return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    if (!contentType.toLowerCase().startsWith('image/')) {
        return null;
    }

    return {
        contentType,
        body: await imageResponse.arrayBuffer(),
    };
}

export async function GET(req: NextRequest) {
    const userId = normalizeUserId(req.nextUrl.searchParams.get('userId'));
    if (!userId) {
        return fallbackAvatar();
    }

    const size = normalizeSize(req.nextUrl.searchParams.get('size'));
    const imageUrl = await fetchThumbnailImageUrl(userId, size);

    if (!imageUrl) {
        return fallbackAvatar();
    }

    const image = await fetchAvatarImage(imageUrl);
    if (!image) {
        return fallbackAvatar();
    }

    return new NextResponse(image.body, {
        headers: {
            'Cache-Control': CACHE_CONTROL,
            'Content-Type': image.contentType,
        },
    });
}
