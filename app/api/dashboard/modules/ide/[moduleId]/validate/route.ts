import { NextResponse } from 'next/server';

import { ensureOwnedModuleProject, validateModuleProject } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ moduleId: string }> };

export async function GET(_req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    try {
        const { moduleId } = await context.params;
        const project = await ensureOwnedModuleProject(moduleId, auth.discordUserId);
        if (!project) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        const problems = validateModuleProject({ manifest: project.project.manifest, files: project.files });
        return noStoreJson({
            ready: !problems.some((problem) => problem.severity === 'error'),
            problems,
            summary: {
                scripts: project.files.filter((file) => ['server_script', 'client_script', 'shared_module'].includes(file.kind)).length,
                uiRoots: project.files.filter((file) => file.kind === 'ui').length,
                warnings: problems.filter((problem) => problem.severity === 'warning').length,
                errors: problems.filter((problem) => problem.severity === 'error').length,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Module validation failed.' }, { status: 500 });
    }
}
