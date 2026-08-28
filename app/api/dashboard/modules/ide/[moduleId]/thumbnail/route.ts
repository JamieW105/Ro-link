import { NextResponse } from 'next/server';

import { getOwnedModule } from '@/lib/moduleIde';
import { requireModuleIdeUser } from '@/lib/moduleIdeAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ moduleId: string }> };

const THUMBNAIL_BUCKET = 'module-thumbnails';
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const MAX_MODULE_THUMBNAILS = 5;
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

function getModuleThumbnailUrls(module: { thumbnail_url: string; thumbnail_urls: unknown }) {
    const thumbnailUrls = Array.isArray(module.thumbnail_urls)
        ? module.thumbnail_urls.map((value) => String(value || '').trim()).filter(Boolean).slice(0, MAX_MODULE_THUMBNAILS)
        : [];
    if (thumbnailUrls.length === 0 && module.thumbnail_url) thumbnailUrls.push(module.thumbnail_url);
    return thumbnailUrls;
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
        const files = [...formData.getAll('thumbnails'), ...formData.getAll('thumbnail')]
            .filter((value): value is File => value instanceof File && value.size > 0);
        const currentThumbnailUrls = getModuleThumbnailUrls(ownedModule);
        let retainedThumbnailUrls: string[];
        try {
            const retainedValue = formData.get('retainedThumbnailUrls');
            retainedThumbnailUrls = retainedValue == null
                ? currentThumbnailUrls
                : (JSON.parse(String(retainedValue)) as unknown[]).map((value) => String(value || '').trim()).filter(Boolean);
        } catch {
            return NextResponse.json({ error: 'The retained thumbnail list is invalid.' }, { status: 400 });
        }
        retainedThumbnailUrls = [...new Set(retainedThumbnailUrls)];
        if (retainedThumbnailUrls.some((url) => !currentThumbnailUrls.includes(url))) {
            return NextResponse.json({ error: 'The retained thumbnail list contains an unknown image.' }, { status: 400 });
        }
        if (retainedThumbnailUrls.length + files.length > MAX_MODULE_THUMBNAILS) {
            return NextResponse.json({ error: `Modules can have up to ${MAX_MODULE_THUMBNAILS} thumbnails.` }, { status: 400 });
        }
        if (files.length === 0 && retainedThumbnailUrls.length === currentThumbnailUrls.length
            && retainedThumbnailUrls.every((url, index) => url === currentThumbnailUrls[index])) {
            return NextResponse.json({ thumbnailUrl: currentThumbnailUrls[0] || '', thumbnailUrls: currentThumbnailUrls });
        }

        const validatedFiles: Array<{ bytes: Uint8Array; contentType: keyof typeof IMAGE_TYPES }> = [];
        for (const file of files) {
            if (file.size > MAX_THUMBNAIL_BYTES) return NextResponse.json({ error: 'Each thumbnail must be no larger than 5 MB.' }, { status: 400 });
            if (!(file.type in IMAGE_TYPES)) return NextResponse.json({ error: 'Use PNG, JPEG, or WebP images.' }, { status: 400 });
            const contentType = file.type as keyof typeof IMAGE_TYPES;
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (!isValidImageSignature(bytes, contentType)) return NextResponse.json({ error: 'One of the selected files is not a valid image.' }, { status: 400 });
            validatedFiles.push({ bytes, contentType });
        }

        await ensureThumbnailBucket();
        const client = getSupabaseAdmin();
        const uploadedPaths: string[] = [];
        const uploadedUrls: string[] = [];
        for (const file of validatedFiles) {
            const objectPath = `${moduleId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.contentType].extension}`;
            const { error: uploadError } = await client.storage.from(THUMBNAIL_BUCKET).upload(objectPath, file.bytes, {
                cacheControl: '31536000',
                contentType: file.contentType,
                upsert: false,
            });
            if (uploadError) {
                if (uploadedPaths.length) await client.storage.from(THUMBNAIL_BUCKET).remove(uploadedPaths);
                throw new Error(uploadError.message);
            }
            uploadedPaths.push(objectPath);
            uploadedUrls.push(client.storage.from(THUMBNAIL_BUCKET).getPublicUrl(objectPath).data.publicUrl);
        }

        const thumbnailUrls = [...retainedThumbnailUrls, ...uploadedUrls];
        const thumbnailUrl = thumbnailUrls[0] || '';
        const { error: updateError } = await client
            .from('addon_modules')
            .update({ thumbnail_url: thumbnailUrl, thumbnail_urls: thumbnailUrls, updated_at: new Date().toISOString() })
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId);
        if (updateError) {
            if (uploadedPaths.length) await client.storage.from(THUMBNAIL_BUCKET).remove(uploadedPaths);
            throw new Error(updateError.message);
        }

        const removedPaths = currentThumbnailUrls
            .filter((url) => !retainedThumbnailUrls.includes(url))
            .map(getStoredThumbnailPath)
            .filter(Boolean);
        if (removedPaths.length) await client.storage.from(THUMBNAIL_BUCKET).remove(removedPaths);

        return NextResponse.json({ thumbnailUrl, thumbnailUrls });
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
            .update({ thumbnail_url: '', thumbnail_urls: [], updated_at: new Date().toISOString() })
            .eq('id', moduleId)
            .eq('author_discord_id', auth.discordUserId);
        if (error) throw new Error(error.message);

        const oldPaths = getModuleThumbnailUrls(ownedModule).map(getStoredThumbnailPath).filter(Boolean);
        if (oldPaths.length) await client.storage.from(THUMBNAIL_BUCKET).remove(oldPaths);
        return NextResponse.json({ thumbnailUrl: '', thumbnailUrls: [] });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove thumbnail.' }, { status: 500 });
    }
}
