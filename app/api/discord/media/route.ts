import { NextResponse } from 'next/server';

import { parseAllowedDiscordMediaUrl } from '@/lib/discordMedia';

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

export async function GET(req: Request) {
    const requestedUrl = new URL(req.url).searchParams.get('url');
    const discordUrl = parseAllowedDiscordMediaUrl(requestedUrl);

    if (!discordUrl) {
        return NextResponse.json({ error: 'Invalid Discord media URL.' }, { status: 400 });
    }

    try {
        const response = await fetch(discordUrl, {
            cache: 'force-cache',
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Discord media could not be loaded.' },
                { status: response.status === 404 ? 404 : 502 },
            );
        }

        const contentType = response.headers.get('content-type') || '';
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (!contentType.toLowerCase().startsWith('image/')) {
            return NextResponse.json({ error: 'Discord returned non-image content.' }, { status: 502 });
        }
        if (contentLength > MAX_MEDIA_BYTES) {
            return NextResponse.json({ error: 'Discord media is too large.' }, { status: 413 });
        }

        const body = await response.arrayBuffer();
        if (body.byteLength > MAX_MEDIA_BYTES) {
            return NextResponse.json({ error: 'Discord media is too large.' }, { status: 413 });
        }

        return new Response(body, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('[DiscordMedia] Failed to proxy Discord media.', {
            error: error instanceof Error ? error.message : error,
        });
        return NextResponse.json({ error: 'Discord media could not be loaded.' }, { status: 502 });
    }
}
