'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSuccessNotice } from '@/hooks/use-success-notice';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Rating, RatingItem } from '@/components/ui/rating';
import { Status, StatusLabel } from '@/components/ui/status';
import { Textarea } from '@/components/ui/textarea';

export interface ReviewSummary { moduleId: string; total: number; average: number }
interface Review { id: string; rating: number; comment: string; name: string; avatarUrl: string | null; createdAt: string; updatedAt: string; isOwn: boolean }
interface ReviewData {
    total: number;
    average: number;
    reviews: Review[];
    ownReview: Pick<Review, 'id' | 'rating' | 'comment'> | null;
    canReview: boolean;
    ownModule: boolean;
    hasMore: boolean;
}
export function ReviewRating({ value, label, readOnly = false, disabled = false, onValueChange }: { value: number; label: string; readOnly?: boolean; disabled?: boolean; onValueChange?: (value: number) => void }) {
    return <Rating {...(readOnly ? { role: 'img' as const, tabIndex: -1 } : {})} value={readOnly ? Math.round(value * 2) / 2 : value} step={readOnly ? 0.5 : 1} onValueChange={onValueChange} readOnly={readOnly} disabled={disabled} aria-label={label} className="text-amber-600 dark:text-amber-400" size="sm">
        {Array.from({ length: 5 }, (_, index) => <RatingItem key={index} index={index} aria-hidden={readOnly || undefined} aria-label={`${index + 1} star${index === 0 ? '' : 's'}`} />)}
    </Rating>;
}
function ReviewerAvatar({ review }: { review: Review }) {
    const [failed, setFailed] = useState(false);
    return review.avatarUrl && !failed
        ? <Image unoptimized width={32} height={32} src={review.avatarUrl} alt="" onError={() => setFailed(true)} className="size-8 shrink-0 rounded-full object-cover" />
        : <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{review.name.slice(0, 1)}</span>;
}

export default function ModuleReviews({ moduleId, onSummaryChange }: { moduleId: string; onSummaryChange: (summary: ReviewSummary | null) => void }) {
    const [data, setData] = useState<ReviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useSuccessNotice<string | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const activeRequest = useRef<AbortController | null>(null);
    const endpoint = `/api/dashboard/marketplace/${encodeURIComponent(moduleId)}/reviews`;
    const load = useCallback(async (nextOffset: number, resetForm = false) => {
        activeRequest.current?.abort();
        const controller = new AbortController();
        activeRequest.current = controller;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${endpoint}?offset=${nextOffset}`, { cache: 'no-store', signal: controller.signal });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Could not load reviews.');
            if (!Array.isArray(payload.reviews) || !Number.isFinite(payload.total) || !Number.isFinite(payload.average)) throw new Error('Reviews are temporarily unavailable.');
            if (controller.signal.aborted) return;
            setData(payload);
            setOffset(nextOffset);
            onSummaryChange({ moduleId, total: payload.total, average: payload.average });
            if (resetForm) { setRating(payload.ownReview?.rating || 0); setComment(payload.ownReview?.comment || ''); }
        } catch (failure) {
            if (controller.signal.aborted) return;
            setError(failure instanceof Error ? failure.message : 'Could not load reviews.');
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [endpoint, moduleId, onSummaryChange]);
    useEffect(() => {
        void load(0, true);
        return () => activeRequest.current?.abort();
    }, [load]);

    async function save(method: 'POST' | 'DELETE') {
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch(endpoint, {
                method,
                ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, comment }) } : {}),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not save your review.');
            setDeleteOpen(false);
            setNotice(method === 'DELETE' ? 'Review removed.' : 'Review saved.');
            await load(0, true);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not save your review.');
        } finally { setSaving(false); }
    }
    return <Card id="module-reviews">
        <CardHeader className="p-4">
            <div className="flex items-center justify-between gap-3"><CardTitle>Reviews</CardTitle>{data && <span className="text-xs text-muted-foreground">{data.total} review{data.total === 1 ? '' : 's'}</span>}</div>
            <CardDescription>Feedback from module creators and verified installers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
            {error && <Status role="alert" variant="error" className="w-full rounded-md"><StatusLabel className="whitespace-normal leading-relaxed">{error}</StatusLabel></Status>}
            {notice && <Status role="status" variant="success" className="w-full rounded-md"><StatusLabel>{notice}</StatusLabel></Status>}
            {loading && !data ? <p role="status" className="text-sm text-muted-foreground">Loading reviews…</p> : !data ? (
                <Button type="button" variant="outline" size="sm" onClick={() => load(0, true)}>Retry reviews</Button>
            ) : <>
                {data.canReview ? <form className="space-y-3 rounded-md border border-border p-4" onSubmit={event => { event.preventDefault(); void save('POST'); }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><p className="text-sm font-medium">{data.ownReview ? 'Edit your review' : 'Review this module'}</p>{data.ownModule && <p className="mt-1 text-xs text-muted-foreground">You are reviewing your own module.</p>}</div>
                        <ReviewRating label="Your rating" value={rating} onValueChange={setRating} disabled={saving || loading} />
                    </div>
                    <label className="sr-only" htmlFor="module-review-comment">Your review</label>
                    <Textarea id="module-review-comment" value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} required rows={4} disabled={saving || loading} placeholder="Share what worked well or what could be improved…" />
                    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{comment.length}/2000</span><Button type="submit" size="sm" disabled={saving || loading || !rating || !comment.trim()}>{saving ? 'Saving…' : data.ownReview ? 'Update review' : 'Publish review'}</Button></div>
                </form> : <p className="text-sm text-muted-foreground">Install this module on a server you manage to leave a review.</p>}
                {data.ownReview && <Button type="button" variant="ghost" size="sm" disabled={saving || loading} onClick={() => { setError(null); setDeleteOpen(true); }}>Delete your review</Button>}
                {data.reviews.length === 0 ? <div className="py-6 text-center"><p className="text-sm font-medium">No reviews yet</p><p className="mt-1 text-xs text-muted-foreground">Be the first to share feedback.</p></div> : <div className="divide-y divide-border">
                    {data.reviews.map(review => <article key={review.id} className="space-y-3 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><ReviewerAvatar key={review.avatarUrl || review.id} review={review} /><div className="min-w-0"><p className="truncate text-sm font-medium">{review.name}{review.isOwn ? ' · You' : ''}</p><time dateTime={review.createdAt} className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</time></div></div><ReviewRating value={review.rating} label={`${review.rating} out of 5 stars`} readOnly /></div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{review.comment}</p>
                    </article>)}
                </div>}
            </>}
        </CardContent>
        {data && (offset > 0 || data.hasMore) && <CardFooter className="justify-between px-4 pb-4"><Button type="button" variant="outline" size="sm" disabled={offset === 0 || loading || saving} onClick={() => load(Math.max(0, offset - 10))}>Previous reviews</Button><Button type="button" variant="outline" size="sm" disabled={!data.hasMore || loading || saving} onClick={() => load(offset + 10)}>Next reviews</Button></CardFooter>}
        <Dialog open={deleteOpen} onOpenChange={open => { if (!saving) setDeleteOpen(open); }}>
            <DialogContent><DialogHeader><DialogTitle>Delete your review?</DialogTitle><DialogDescription>Your rating and comment will be removed.</DialogDescription></DialogHeader>{error && <Status role="alert" variant="error" className="mt-4 w-full rounded-md"><StatusLabel className="whitespace-normal leading-relaxed">{error}</StatusLabel></Status>}<DialogFooter className="mt-6"><Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button><Button type="button" variant="destructive" disabled={saving} onClick={() => save('DELETE')}>Delete review</Button></DialogFooter></DialogContent>
        </Dialog>
    </Card>;
}
