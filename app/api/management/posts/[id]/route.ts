import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";
import { normalizeUpdatePost, sanitizeUpdatePostInput } from "@/lib/updatePosts";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_UPDATES'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { data, error } = await supabase
        .from('update_posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeUpdatePost(data));
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_UPDATES'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeUpdatePostInput(body);
    if ('error' in sanitized) {
        return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('update_posts')
        .update({
            ...sanitized,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(normalizeUpdatePost(data));
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_UPDATES'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { error } = await supabase
        .from('update_posts')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
