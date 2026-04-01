import { NextResponse } from 'next/server';

import { supabase } from "@/lib/supabase";
import { normalizeUpdatePost } from "@/lib/updatePosts";

export async function GET() {
    const { data, error } = await supabase
        .from('update_posts')
        .select('*')
        .order('published_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((post) => normalizeUpdatePost(post)).filter(Boolean));
}
