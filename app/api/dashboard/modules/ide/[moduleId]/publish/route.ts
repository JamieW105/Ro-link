import { NextResponse } from 'next/server';

import { publishModuleProject } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ moduleId: string }> };

export async function POST(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    try {
        const { moduleId } = await context.params;
        const result = await publishModuleProject(moduleId, auth.discordUserId);
        if (!result) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        if (!result.ok) return noStoreJson(result, { status: 422 });
        return noStoreJson(result, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Module publish failed.' }, { status: 500 });
    }
}
