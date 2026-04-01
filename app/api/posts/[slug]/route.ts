import { NextRequest, NextResponse } from 'next/server';

import { supabase } from "@/lib/supabase";
import { normalizeUpdatePost } from "@/lib/updatePosts";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    const { data, error } = await supabase
        .from('update_posts')
        .select('*')
        .eq('slug', decodeURIComponent(slug))
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeUpdatePost(data));
}
