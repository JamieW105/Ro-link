import { LoaderCircle } from 'lucide-react';
export function PublicLoading() {
    return <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading…</div>;
}
