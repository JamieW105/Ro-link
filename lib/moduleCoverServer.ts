import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_COVER_SOURCE_BYTES, MAX_COVER_STORED_BYTES, MODULE_COVER_BUCKET, parseModuleCoverPaths } from './moduleCovers';

export async function encodeModuleCover(input: Uint8Array) {
    if (!input.byteLength || input.byteLength > MAX_COVER_SOURCE_BYTES) throw new Error('Each cover image must be 9 MB or smaller.');
    const image = sharp(input, { limitInputPixels: 40_000_000, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) throw new Error('Choose a JPG, PNG, or WebP image.');
    for (const width of [2048, 1536, 1024, 768, 512]) {
        for (const quality of [85, 65, 45]) {
            const output = await image.clone().rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
            if (output.length <= MAX_COVER_STORED_BYTES) return output;
        }
    }
    throw new Error('Could not compress this image below 2 MB.');
}
export async function validateModuleCoverSelection(db: SupabaseClient, value: unknown, ownerId: string) {
    const paths = parseModuleCoverPaths(value);
    if (!paths || paths.some(path => !path.startsWith(`${ownerId}/`))) return false;
    if (!paths.length) return true;
    const { data, error } = await db.from('addon_module_cover_uploads').select('path').eq('owner_discord_id', ownerId).in('path', paths);
    if (error) throw error;
    return data?.length === paths.length;
}
interface CoverDependencies {
    session: () => Promise<{ user?: { id?: string }; error?: string } | null>;
    db: () => SupabaseClient;
    configured: () => boolean;
}
export function createModuleCoverUploadHandler(deps: CoverDependencies) {
    return async function POST(request: Request) {
        const session = await deps.session();
        const ownerId = session?.user?.id;
        if (!ownerId || session?.error) return Response.json({ error: 'Sign in to upload cover images.' }, { status: 401 });
        if (!deps.configured()) return Response.json({ error: 'Cover image storage is not configured.' }, { status: 503 });
        const db = deps.db();
        try {
            const { data: block, error: blockError } = await db.from('addon_module_creator_blocks').select('discord_id').eq('discord_id', ownerId).eq('active', true).maybeSingle();
            if (blockError) throw blockError;
            if (block) return Response.json({ error: 'Your creator account cannot upload cover images.' }, { status: 403 });
            // Bound the body even when Content-Length is absent or dishonest.
            const limit = MAX_COVER_SOURCE_BYTES + 64 * 1024;
            if (Number(request.headers.get('content-length')) > limit) return Response.json({ error: 'Each cover image must be 9 MB or smaller.' }, { status: 413 });
            const reader = request.body?.getReader();
            if (!reader) return Response.json({ error: 'Choose an image to upload.' }, { status: 400 });
            const chunks: Uint8Array[] = [];
            let size = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.length;
                if (size > limit) { await reader.cancel(); return Response.json({ error: 'Each cover image must be 9 MB or smaller.' }, { status: 413 }); }
                chunks.push(value);
            }
            const body = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData().catch(() => null);
            const file = body?.get('file');
            if (!(file instanceof File)) return Response.json({ error: 'Choose an image to upload.' }, { status: 400 });
            if (file.size > MAX_COVER_SOURCE_BYTES) return Response.json({ error: 'Each cover image must be 9 MB or smaller.' }, { status: 413 });
            let output: Buffer;
            try { output = await encodeModuleCover(new Uint8Array(await file.arrayBuffer())); }
            catch { return Response.json({ error: 'Could not process this image. Use a JPG, PNG, or WebP under 9 MB and 40 megapixels.' }, { status: 400 }); }
            const path = `${ownerId}/${randomUUID()}.webp`;
            const bucket = db.storage.from(MODULE_COVER_BUCKET);
            const { error: uploadError } = await bucket.upload(path, output, { contentType: 'image/webp', upsert: false });
            if (uploadError) throw uploadError;
            const { error: recordError } = await db.from('addon_module_cover_uploads').insert({ path, owner_discord_id: ownerId, size_bytes: output.length });
            if (recordError) { await bucket.remove([path]); throw recordError; }
            return Response.json({ path, size: output.length }, { status: 201 });
        } catch (error) {
            console.error('[Module covers]', { code: error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN' });
            return Response.json({ error: 'Cover upload failed. Please try again.' }, { status: 503 });
        }
    };
}

export function createModuleCoverReadHandler(deps: CoverDependencies) {
    return async function GET(path: string) {
        const session = await deps.session();
        const userId = session?.user?.id;
        if (!userId || session?.error) return new Response(null, { status: 401 });
        const paths = parseModuleCoverPaths([path]);
        if (!paths) return new Response(null, { status: 404 });
        if (!deps.configured()) return new Response(null, { status: 503 });
        const own = path.startsWith(`${userId}/`);
        try {
            const db = deps.db();
            if (!own) {
                const { data, error } = await db.from('addon_modules').select('id').contains('cover_images', [path]).eq('status', 'PUBLISHED').limit(1);
                if (error) throw error;
                if (!data?.length) return new Response(null, { status: 404 });
            }
            const { data, error } = await db.storage.from(MODULE_COVER_BUCKET).download(path);
            if (error || !data) return new Response(null, { status: 404 });
            return new Response(data, { headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': own ? 'private, no-store' : 'private, max-age=300' } });
        } catch { return new Response(null, { status: 503 }); }
    };
}
