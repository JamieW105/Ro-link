import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { trimModuleString } from '@/lib/modules';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function identity() {
    const session = await getServerSession(authOptions);
    return String((session?.user as { id?: string } | undefined)?.id || '').trim();
}

export async function GET(_req: Request, context: Context) {
    const userId = await identity();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const client = getSupabaseAdmin();
    const moduleResult = await client.from('addon_modules').select('id').eq('id', id).eq('author_discord_id', userId).maybeSingle();
    if (!moduleResult.data) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
    const disputes = await client.from('addon_module_disputes').select('*').eq('module_id', id).eq('author_discord_id', userId).order('created_at', { ascending: false });
    if (disputes.error) return NextResponse.json({ error: disputes.error.message }, { status: 500 });
    return NextResponse.json({ disputes: disputes.data || [] });
}

export async function POST(req: Request, context: Context) {
    const userId = await identity();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const reason = trimModuleString(body.reason, 2000);
    if (reason.length < 20) return NextResponse.json({ error: 'Explain the dispute in at least 20 characters.' }, { status: 400 });
    const client = getSupabaseAdmin();
    const moduleResult = await client.from('addon_modules').select('id, status').eq('id', id).eq('author_discord_id', userId).maybeSingle();
    if (!moduleResult.data) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
    if (moduleResult.data.status !== 'REJECTED') return NextResponse.json({ error: 'Only a denied module can be disputed.' }, { status: 409 });
    const inserted = await client.from('addon_module_disputes').insert({ module_id: id, author_discord_id: userId, reason }).select('*').single();
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 });
    return NextResponse.json({ dispute: inserted.data }, { status: 201 });
}
