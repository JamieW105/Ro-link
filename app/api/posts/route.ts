import { NextResponse } from 'next/server';

import { coalesceRead } from '@/lib/coalesceRead';
import { supabase } from "@/lib/supabase";
import { normalizeUpdatePost } from "@/lib/updatePosts";

const loadPublishedPosts = coalesceRead(async () => {
    const { data, error } = await supabase
        .from('update_posts')
        .select('*')
        .eq('status', 'PUBLISHED')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false });

    if (error) {
        return { body: { error: error.message }, status: 500 };
    }

    return { body: (data || []).map((post) => normalizeUpdatePost(post)).filter(Boolean), status: 200 };
});

export async function GET() {
    const { body, status } = await loadPublishedPosts();
    return NextResponse.json(body, { status });
}
