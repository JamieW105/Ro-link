import { NextResponse } from 'next/server';

import { getOwnedModule } from '@/lib/moduleIde';
import { requireModuleIdeUser } from '@/lib/moduleIdeAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ moduleId: string }> };

const THUMBNAIL_BUCKET = 'module-thumbnails';
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
    'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47] },
    'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
    'image/webp': { extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46] },
} as const;

function isValidImageSignature(bytes: Uint8Array, contentType: keyof typeof IMAGE_TYPES) {
    const expected = IMAGE_TYPES[contentType].signature;
    if (!expected.every((value, index) => bytes[index] === value)) return false;
    return contentType !== 'image/webp'
        || String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

function getStoredThumbnailPath(thumbnailUrl: string) {
    const marker = `/storage/v1/object/public/${THUMBNAIL_BUCKET}/`;
    const markerIndex = thumbnailUrl.indexOf(marker);
    return markerIndex === -1 ? '' : decodeURIComponent(thumbnailUrl.slice(markerIndex + marker.length).split('?')[0]);
}

async function ensureThumbnailBucket() {
    const client = getSupabaseAdmin();
    const { data } = await client.storage.getBucket(THUMBNAIL_BUCKET);
    if (data) return;

    const { error } = await client.storage.createBucket(THUMBNAIL_BUCKET, {
        public: true,
        allowedMimeTypes: Object.keys(IMAGE_TYPES),
        fileSizeLimit: MAX_THUMBNAIL_BYTES,
    });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
}

export async function POST(req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;

    const { moduleId } = await context.params;
    try {
        const ownedModule = await getOwnedModule(moduleId, auth.discordUserId);
        if (!ownedModule) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

        const formData = await req.formData();
        const file = formData.get('thumbnail');
        if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a thumbnail image.' }, { status: 400 });
        if (file.size === 0 || file.size > MAX_THUMBNAIL_BYTES) return NextResponse.json({ error: 'Thumbnail images must be no larger than 5 MB.' }, { status: 400 });
        if (!(file.type in IMAGE_TYPES)) return NextResponse.json({ error: 'Use a PNG, JPEG, or WebP image.' }, { status: 400 });

        const contentType = file.type as keyof typeof IMAGE_TYPES;
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!isValidImageSignature(bytes, contentType)) return NextResponse.json({ error: 'The selected file is not a valid image.' }, { status: 400 });

        await ensureThumbnailBucket();
        const client = getSupabaseAdmin();
        const objectPath = `${moduleId}/${crypto.randomUUID()}.${IMAGE_TYPES[contentType].extension}`;
        const { error: uploadError } = await client.storage.from(THUMBNAIL_BUCKET).upload(objectPath, bytes, {
            cacheControl: '31536000',
            contentType,
            upsert: false,
        });
        if (uploadError) throw new Error(uploadError.message);

        const { data: publicUrlData } = client.storage.from(THUMBNAIL_BUCKET).getPublicUrl(objectPath);
        const thumbnailUrl = publicUrlData.publicUrl;
        const { error: updateError } = await client
            .from('addon_modules')
            .update({ thumbnail_url: thumbnailUrl, updated_at: new Date().toISOString() })
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId);
        if (updateError) {
            await client.storage.from(THUMBNAIL_BUCKET).remove([objectPath]);
            throw new Error(updateError.message);
        }

        const oldPath = getStoredThumbnailPath(ownedModule.thumbnail_url || '');
        if (oldPath && oldPath !== objectPath) await client.storage.from(THUMBNAIL_BUCKET).remove([oldPath]);

        return NextResponse.json({ thumbnailUrl });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to upload thumbnail.' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;

    const { moduleId } = await context.params;
    try {
        const ownedModule = await getOwnedModule(moduleId, auth.discordUserId);
        if (!ownedModule) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

        const client = getSupabaseAdmin();
        const { error } = await client
            .from('addon_modules')
            .update({ thumbnail_url: '', updated_at: new Date().toISOString() })
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId);
        if (error) throw new Error(error.message);

        const oldPath = getStoredThumbnailPath(ownedModule.thumbnail_url || '');
        if (oldPath) await client.storage.from(THUMBNAIL_BUCKET).remove([oldPath]);
        return NextResponse.json({ thumbnailUrl: '' });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove thumbnail.' }, { status: 500 });
    }
}
