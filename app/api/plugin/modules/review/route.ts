import { NextResponse } from 'next/server';

import { buildModuleProjectPackage, ensureModuleProjectForReview, validateModuleProject } from '@/lib/moduleIde';
import { claimModuleStudioPairing, getStudioBridgeSessionByCredential, readBearerToken, touchStudioBridgeSession } from '@/lib/moduleStudioBridge';
import { requireAuthorizedStudioPluginSession, StudioPluginError } from '@/lib/studioPlugin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const pluginSession = await requireAuthorizedStudioPluginSession(req);
        if (!pluginSession) return NextResponse.json({ error: 'Ro-Link account authorization is missing or expired.' }, { status: 401 });
        const body = await req.json().catch(() => ({})) as Record<string, unknown>;
        const code = String(body.code || '').trim().toUpperCase();
        if (!/^[A-Z2-9]{8}$/.test(code)) return NextResponse.json({ error: 'Enter the eight-character review code.' }, { status: 400 });
        const result = await claimModuleStudioPairing(pluginSession, {
            code,
            placeId: String(body.placeId || ''),
            universeId: String(body.universeId || ''),
            placeName: String(body.placeName || ''),
        });
        if (!result || result.purpose !== 'MODERATION_REVIEW') {
            return NextResponse.json({ error: 'Review code is invalid, expired, already used, or belongs to another moderator.' }, { status: 404 });
        }
        return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to connect the review game.' }, { status: error instanceof StudioPluginError ? error.status : 500 });
    }
}

export async function GET(req: Request) {
    try {
        const credential = readBearerToken(req);
        const session = credential ? await getStudioBridgeSessionByCredential(credential) : null;
        if (!session || session.purpose !== 'MODERATION_REVIEW') {
            return NextResponse.json({ error: 'Review credential is missing, expired, or revoked.' }, { status: 401 });
        }
        const project = await ensureModuleProjectForReview(String(session.module_id || ''));
        if (!project) return NextResponse.json({ error: 'The review project no longer exists.' }, { status: 404 });
        const problems = validateModuleProject({ manifest: project.project.manifest, files: project.files });
        const modulePackage = buildModuleProjectPackage(project);
        await touchStudioBridgeSession(String(session.id));
        return NextResponse.json({
            protocolVersion: Number(session.protocol_version || 1),
            reviewOnly: true,
            problems,
            packageHash: modulePackage.packageHash,
            package: modulePackage.packagePayload,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load the review package.' }, { status: 500 });
    }
}
