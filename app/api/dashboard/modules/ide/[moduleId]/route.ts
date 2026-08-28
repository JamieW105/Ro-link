import { NextResponse } from 'next/server';

import { ensureOwnedModuleProject } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { isModuleIdeVisibleFile } from '@/lib/moduleFileRules';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ moduleId: string }> };

export async function GET(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    try {
        const { moduleId } = await context.params;
        const project = await ensureOwnedModuleProject(moduleId, auth.discordUserId);
        if (!project) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        return noStoreJson({ ...project, files: project.files.filter(isModuleIdeVisibleFile) });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load module project.' }, { status: 500 });
    }
}
