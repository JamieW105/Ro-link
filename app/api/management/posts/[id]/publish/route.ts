import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";
import { normalizeUpdatePost, normalizeUpdatePostStatus, sanitizeUpdatePostInput } from "@/lib/updatePosts";

export async function PATCH(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = String((session.user as { id?: unknown }).id ?? '');
    if (!(await hasPermission(userId, 'POST_UPDATES'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { data: post, error: loadError } = await supabase
        .from('update_posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (loadError) {
        return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    if (!post) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const sanitized = sanitizeUpdatePostInput(post, { requireUpdateSection: true });
    if ('error' in sanitized) {
        return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const status = normalizeUpdatePostStatus(post.status, post.published_at);
    const publishedAt = status === 'PUBLISHED' && post.published_at ? post.published_at : now;

    const { data, error } = await supabase
        .from('update_posts')
        .update({
            status: 'PUBLISHED',
            published_at: publishedAt,
            updated_at: now,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(normalizeUpdatePost(data));
}
