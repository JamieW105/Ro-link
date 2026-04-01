import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";
import { normalizeUpdatePost, sanitizeUpdatePostInput, slugifyUpdatePostTitle } from "@/lib/updatePosts";

async function buildUniqueSlug(title: string) {
    const baseSlug = slugifyUpdatePostTitle(title);
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
        const { data, error } = await supabase
            .from('update_posts')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (error) {
            throw new Error(error.message);
        }

        if (!data) {
            return slug;
        }

        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_UPDATES'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('update_posts')
        .select('*')
        .order('published_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((post) => normalizeUpdatePost(post)).filter(Boolean));
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_UPDATES'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeUpdatePostInput(body);
    if ('error' in sanitized) {
        return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    try {
        const slug = await buildUniqueSlug(sanitized.title);
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('update_posts')
            .insert({
                ...sanitized,
                slug,
                author_discord_id: userId,
                published_at: now,
                updated_at: now,
            })
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(normalizeUpdatePost(data));
    } catch (error) {
        return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
    }
}
