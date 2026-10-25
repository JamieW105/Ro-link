'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload, FileUploadDropzone, FileUploadTrigger } from '@/components/ui/file-upload';
import { Sortable, SortableContent, SortableItem, SortableItemHandle } from '@/components/ui/sortable';
import { Status, StatusLabel } from '@/components/ui/status';
import { ModuleCoverImage } from '@/components/marketplace/ModuleCoverGallery';
import { COVER_ACCEPT, MAX_COVER_SOURCE_BYTES, MAX_MODULE_COVERS, isModuleCoverPath } from '@/lib/moduleCovers';
import { compressModuleCover } from '@/lib/compressModuleCover';

export function ModuleCoverEditor({ value, onChange, onBusyChange, disabled = false }: { value: string[]; onChange: (paths: string[]) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const uploading = useRef(false);
    const active = useRef(true);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; controller.current?.abort(); onBusyChange(false); };
    }, [onBusyChange]);
    async function upload(files: File[]) {
        if (disabled || uploading.current) return;
        if (value.length + files.length > MAX_MODULE_COVERS) { setError('You can upload up to four cover images.'); return; }
        uploading.current = true;
        controller.current = new AbortController();
        setBusy(true); onBusyChange(true); setError(null);
        const paths = [...value];
        try {
            for (const file of files) {
                try {
                    const compressed = await compressModuleCover(file);
                    if (!active.current) return;
                    const form = new FormData(); form.append('file', compressed);
                    const response = await fetch('/api/dashboard/creator/module-covers', { method: 'POST', body: form, signal: controller.current.signal });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok || !isModuleCoverPath(result.path)) throw new Error(result.error || 'Cover upload failed. Please try again.');
                    paths.push(result.path);
                } catch (failure) { if (!active.current) return; setError(failure instanceof Error ? failure.message : 'Cover upload failed.'); }
            }
            if (active.current) onChange(paths);
        } finally { uploading.current = false; if (active.current) { setBusy(false); onBusyChange(false); } }
    }
    function move(index: number, delta: number) {
        const paths = [...value];
        [paths[index], paths[index + delta]] = [paths[index + delta], paths[index]];
        onChange(paths);
    }
    return <Card>
        <CardHeader className="p-4"><CardTitle>Cover images</CardTitle><CardDescription>Upload up to four JPG, PNG, or WebP images, up to 9 MB each. Images are compressed to 2 MB or less. The first image is the marketplace cover. Drag to reorder, or use the arrow buttons.</CardDescription></CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
            {error && <Status role="alert" variant="error"><StatusLabel className="whitespace-normal">{error}</StatusLabel></Status>}
            <FileUpload value={[]} label="Upload cover images" accept={COVER_ACCEPT} maxFiles={Math.max(1, MAX_MODULE_COVERS - value.length)} maxSize={MAX_COVER_SOURCE_BYTES} multiple disabled={disabled || busy || value.length >= MAX_MODULE_COVERS} onAccept={upload} onFileReject={(_file, message) => setError(message)}>
                <FileUploadDropzone className="p-4">
                    <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">{value.length >= MAX_MODULE_COVERS ? 'All four cover slots are filled.' : 'Drop images here or choose files.'}</p>
                    <FileUploadTrigger render={<Button type="button" variant="outline" size="sm" />}>Choose cover images</FileUploadTrigger>
                </FileUploadDropzone>
            </FileUpload>
            {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Compressing and uploading images…</p>}
            {value.length ? <Sortable value={value} onValueChange={onChange} orientation="mixed">
                <SortableContent className="grid gap-3 sm:grid-cols-2">
                    {value.map((path, index) => <SortableItem key={path} value={path} disabled={disabled || busy} className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="relative flex aspect-video items-center justify-center bg-background"><ModuleCoverImage key={path} path={path} alt={`Cover ${index + 1}`} compact /></div>
                        <div className="flex items-center gap-1 border-t border-border p-2">
                            <SortableItemHandle render={<Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Drag cover ${index + 1} to reorder`} />}><GripVertical className="size-4" /></SortableItemHandle>
                            <span className="mr-auto text-xs text-muted-foreground">{index === 0 ? 'Marketplace cover' : `Cover ${index + 1}`}</span>
                            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move cover ${index + 1} earlier`} disabled={disabled || busy || index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move cover ${index + 1} later`} disabled={disabled || busy || index === value.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Remove cover ${index + 1}`} disabled={disabled || busy} onClick={() => onChange(value.filter(item => item !== path))}><X className="size-4" /></Button>
                        </div>
                    </SortableItem>)}
                </SortableContent>
            </Sortable> : <p className="text-xs text-muted-foreground">No images uploaded. The default module preview will be shown.</p>}
            <p className="text-xs text-muted-foreground">{value.length} / {MAX_MODULE_COVERS} images. Save the module to keep changes to the images and their order.</p>
        </CardContent>
    </Card>;
}
