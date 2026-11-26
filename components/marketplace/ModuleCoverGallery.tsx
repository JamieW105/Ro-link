'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { moduleCoverUrl } from '@/lib/moduleCovers';

export function ModuleCoverImage({ path, alt, compact = false }: { path?: string; alt: string; compact?: boolean }) {
    const [failed, setFailed] = useState(false);
    return path && !failed ? <Image unoptimized fill src={moduleCoverUrl(path)} alt={alt} sizes={compact ? '(min-width: 1024px) 320px, 100vw' : '(min-width: 768px) 640px, 100vw'} className={compact ? 'object-cover' : 'object-contain'} onError={() => setFailed(true)} />
        : <><Package className={`${compact ? 'size-8' : 'size-12'} text-muted-foreground`} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">No preview image available</span></>;
}
export function ModuleCoverGallery({ paths, name }: { paths: string[]; name: string }) {
    const [selected, setSelected] = useState(0);
    const index = selected < paths.length ? selected : 0;
    return <Card aria-label="Module preview" className="overflow-hidden p-2">
        <div data-slot="module-product-preview" className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            <ModuleCoverImage key={paths[index] || 'empty'} path={paths[index]} alt={`${name} cover ${index + 1}`} />
        </div>
        {paths.length > 1 && <div aria-label="Module cover images" className="mt-2 grid grid-cols-4 gap-2">
            {paths.map((path, imageIndex) => <Button type="button" key={path} variant="outline" aria-label={`Show cover ${imageIndex + 1}`} aria-pressed={index === imageIndex} onClick={() => setSelected(imageIndex)} className="relative aspect-video h-auto overflow-hidden p-0 aria-pressed:ring-2 aria-pressed:ring-ring">
                <ModuleCoverImage key={path} path={path} alt="" compact />
            </Button>)}
        </div>}
    </Card>;
}
