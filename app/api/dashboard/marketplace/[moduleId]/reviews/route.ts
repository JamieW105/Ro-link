import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { trimModuleString } from '@/lib/modules';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{
        moduleId: string;
    }>;
};

type SessionUser = {
    id?: string;
    name?: string | null;
    image?: string | null;
};

type ReviewRow = {
    id: string;
    reviewer_discord_id: string;
    reviewer_name: string;
    reviewer_avatar_url: string;
    rating: number;
    comment: string;
    created_at: string;
    updated_at: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getReviewClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Module reviews require SUPABASE_SERVICE_ROLE_KEY to be configured.');
    }
    return getSupabaseAdmin();
}

function normalizeReview(row: ReviewRow, userId: string) {
    return {
        id: row.id,
        reviewerName: row.reviewer_name || 'Ro-Link user',
        reviewerAvatarUrl: row.reviewer_avatar_url || '',
        rating: Number(row.rating || 0),
        comment: row.comment || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isOwn: row.reviewer_discord_id === userId,
        verifiedInstall: true,
    };
}

async function getModuleReviewAccess(moduleId: string, userId: string) {
    const client = getReviewClient();
    const { data: addon, error } = await client
        .from('addon_modules')
        .select('id, status, author_discord_id')
        .eq('id', moduleId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!addon || (addon.status !== 'PUBLISHED' && addon.author_discord_id !== userId)) return null;

    const isCreator = addon.author_discord_id === userId;
    let hasInstalled = false;

    if (addon.status === 'PUBLISHED' && !isCreator) {
        const { data: installation, error: installationError } = await client
            .from('server_addon_modules')
            .select('module_id')
            .eq('module_id', moduleId)
            .eq('installed_by', userId)
            .limit(1)
            .maybeSingle();

        if (installationError) throw new Error(installationError.message);
        hasInstalled = Boolean(installation);
    }

    return {
        addon,
        canReview: addon.status === 'PUBLISHED' && !isCreator && hasInstalled,
        isCreator,
    };
}

export async function GET(_req: Request, context: RouteContext) {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    const userId = String(user?.id || '');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { moduleId } = await context.params;
    if (!UUID_PATTERN.test(moduleId)) {
        return NextResponse.json({ error: 'Invalid module ID.' }, { status: 400 });
    }

    try {
        const access = await getModuleReviewAccess(moduleId, userId);
        if (!access) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

        const client = getReviewClient();
        const [{ data: reviewRows, error: reviewsError }, { data: ratingRows, error: ratingsError }] = await Promise.all([
            client
                .from('addon_module_reviews')
                .select('id, reviewer_discord_id, reviewer_name, reviewer_avatar_url, rating, comment, created_at, updated_at')
                .eq('module_id', moduleId)
                .order('created_at', { ascending: false })
                .limit(50),
            client
                .from('addon_module_reviews')
                .select('rating')
                .eq('module_id', moduleId),
        ]);

        if (reviewsError) throw new Error(reviewsError.message);
        if (ratingsError) throw new Error(ratingsError.message);

        const ratings = (ratingRows || []).map((row: { rating?: number }) => Number(row.rating || 0)).filter((rating: number) => rating >= 1 && rating <= 5);
        const reviews = ((reviewRows || []) as ReviewRow[]).map((row) => normalizeReview(row, userId));

        return NextResponse.json({
            reviews,
            reviewCount: ratings.length,
            averageRating: ratings.length ? ratings.reduce((total: number, rating: number) => total + rating, 0) / ratings.length : 0,
            canReview: access.canReview,
            isCreator: access.isCreator,
            yourReview: reviews.find((review) => review.isOwn) || null,
        });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load reviews.' }, { status: 500 });
    }
}

export async function POST(req: Request, context: RouteContext) {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    const userId = String(user?.id || '');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { moduleId } = await context.params;
    if (!UUID_PATTERN.test(moduleId)) {
        return NextResponse.json({ error: 'Invalid module ID.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rating = Number(body.rating);
    const comment = trimModuleString(body.comment, 1000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Choose a rating from 1 to 5 stars.' }, { status: 400 });
    }

    try {
        const access = await getModuleReviewAccess(moduleId, userId);
        if (!access) return NextResponse.json({ error: 'Published module not found.' }, { status: 404 });
        if (access.isCreator) return NextResponse.json({ error: 'Creators cannot review their own modules.' }, { status: 403 });
        if (!access.canReview) {
            return NextResponse.json({ error: 'Install this module to a server before reviewing it.' }, { status: 403 });
        }

        const now = new Date().toISOString();
        const { data, error } = await getReviewClient()
            .from('addon_module_reviews')
            .upsert({
                module_id: moduleId,
                reviewer_discord_id: userId,
                reviewer_name: trimModuleString(user?.name, 120) || 'Ro-Link user',
                reviewer_avatar_url: trimModuleString(user?.image, 2048),
                rating,
                comment,
                updated_at: now,
            }, { onConflict: 'module_id,reviewer_discord_id' })
            .select('id, reviewer_discord_id, reviewer_name, reviewer_avatar_url, rating, comment, created_at, updated_at')
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ review: normalizeReview(data as ReviewRow, userId) });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save review.' }, { status: 500 });
    }
}
