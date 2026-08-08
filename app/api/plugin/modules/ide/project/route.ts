import { NextResponse } from 'next/server';

import { buildModuleProjectPackage, ensureOwnedModuleProject, validateModuleProject } from '@/lib/moduleIde';
import { getStudioBridgeSessionByCredential, readBearerToken, touchStudioBridgeSession } from '@/lib/moduleStudioBridge';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const credential = readBearerToken(req);
        const session = credential ? await getStudioBridgeSessionByCredential(credential) : null;
        if (!session) return NextResponse.json({ error: 'Studio bridge credential is missing, expired, or revoked.' }, { status: 401 });
        const moduleId = String(session.module_id || '');
        const discordUserId = String(session.discord_user_id || '');
        const project = await ensureOwnedModuleProject(moduleId, discordUserId);
        if (!project) return NextResponse.json({ error: 'The paired module project no longer exists.' }, { status: 404 });
        const problems = validateModuleProject({ manifest: project.project.manifest, files: project.files, remotes: project.remotes });
        if (problems.some((problem) => problem.severity === 'error')) {
            return NextResponse.json({ error: 'Fix module validation errors before syncing the project into Studio.', problems }, { status: 422 });
        }
        const built = buildModuleProjectPackage(project);
        await touchStudioBridgeSession(String(session.id));
        return NextResponse.json({
            projectPackage: built.packagePayload,
            packageHash: built.packageHash,
            problems,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Module project sync failed.' }, { status: 500 });
    }
}
