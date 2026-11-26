import { COVER_ACCEPT, MAX_COVER_SOURCE_BYTES, MAX_COVER_STORED_BYTES } from './moduleCovers';

export async function compressModuleCover(file: File): Promise<File> {
    if (file.size > MAX_COVER_SOURCE_BYTES) throw new Error('Each cover image must be 9 MB or smaller.');
    if (!COVER_ACCEPT.split(',').includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('This image could not be opened. Try another JPG, PNG, or WebP image.'); }
    try {
        if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Image dimensions are too large. Use an image under 40 megapixels.');
        const canvas = document.createElement('canvas');
        for (const maxEdge of [2048, 1536, 1024, 768, 512]) {
            const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Image compression is unavailable in this browser.');
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            for (const quality of [0.85, 0.65, 0.45]) {
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
                if (blob && blob.size <= MAX_COVER_STORED_BYTES) return new File([blob], 'cover.webp', { type: blob.type });
            }
        }
        throw new Error('Could not compress this image below 2 MB. Try a smaller image.');
    } finally { bitmap.close(); }
}
