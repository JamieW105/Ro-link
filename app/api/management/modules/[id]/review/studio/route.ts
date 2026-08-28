import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { createModuleStudioPairing, getActiveBrowserStudioSession } from '@/lib/moduleStudioBridge';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function authorize() {
    const session = await getServerSession(authOptions);
    const userId = String((session?.user as { id?: string } | undefined)?.id || '').trim();
    return userId && await hasPermission(userId, 'MANAGE_MODULES') ? userId : '';
}

export async function GET(_req: Request, context: Context) {
    const userId = await authorize();
    if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    return NextResponse.json({ session: await getActiveBrowserStudioSession(id, userId, 'MODERATION_REVIEW') });
}

export async function POST(_req: Request, context: Context) {
    const userId = await authorize();
    if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const pairing = await createModuleStudioPairing(id, userId, 'MODERATION_REVIEW');
    if (!pairing) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
    return NextResponse.json(pairing, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
