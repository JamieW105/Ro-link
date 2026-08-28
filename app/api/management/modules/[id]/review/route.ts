import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import {
    bumpModuleProjectRevision,
    ensureModuleProjectForReview,
} from '@/lib/moduleIde';
import { checksumModuleSource, parseModuleConfigSchema, trimModuleString } from '@/lib/modules';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function requireReviewer() {
    const session = await getServerSession(authOptions);
    const userId = String((session?.user as { id?: string } | undefined)?.id || '').trim();
    if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
    if (!await hasPermission(userId, 'MANAGE_MODULES')) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
    }
    return { userId } as const;
}

function validReason(value: unknown, minimum = 10) {
    const reason = trimModuleString(value, 1000);
    return reason.length >= minimum ? reason : '';
}

async function logEdit(input: {
    moduleId: string;
    moderatorId: string;
    editType: 'CODE' | 'TITLE' | 'DESCRIPTION' | 'THUMBNAILS';
    target?: string;
    reason: string;
    beforeValue: unknown;
    afterValue: unknown;
}) {
    const client = getSupabaseAdmin();
    const { error } = await client.from('addon_module_moderation_edits').insert({
        module_id: input.moduleId,
        moderator_discord_id: input.moderatorId,
        edit_type: input.editType,
        target: input.target || '',
        reason: input.reason,
        before_value: input.beforeValue,
        after_value: input.afterValue,
    });
    if (error) throw new Error(error.message);
}

export async function GET(_req: Request, context: Context) {
    const auth = await requireReviewer();
    if ('error' in auth) return auth.error;
    const { id } = await context.params;
    try {
        const client = getSupabaseAdmin();
        const project = await ensureModuleProjectForReview(id);
        if (!project) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        const [edits, disputes] = await Promise.all([
            client.from('addon_module_moderation_edits').select('*').eq('module_id', id).order('created_at', { ascending: false }).limit(100),
            client.from('addon_module_disputes').select('*').eq('module_id', id).order('created_at', { ascending: false }).limit(50),
        ]);
        const auditAvailable = !edits.error && !disputes.error;
        return NextResponse.json({
            ...project,
            moderationEdits: auditAvailable ? edits.data || [] : [],
            disputes: auditAvailable ? disputes.data || [] : [],
            auditAvailable,
        });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load the review project.' }, { status: 500 });
    }
}

export async function PATCH(req: Request, context: Context) {
    const auth = await requireReviewer();
    if ('error' in auth) return auth.error;
    const { id } = await context.params;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = trimModuleString(body.action, 30).toLowerCase();
    const reason = validReason(body.reason);
    if (!reason) return NextResponse.json({ error: 'A justified edit reason of at least 10 characters is required.' }, { status: 400 });

    try {
        const client = getSupabaseAdmin();
        const auditProbe = await client.from('addon_module_moderation_edits').select('id', { head: true, count: 'exact' }).eq('module_id', id);
        if (auditProbe.error) {
            return NextResponse.json({ error: 'Moderation audit storage is unavailable. Configure SUPABASE_SERVICE_ROLE_KEY before making reviewer edits.' }, { status: 503 });
        }
        if (action === 'file') {
            const fileId = trimModuleString(body.fileId, 80);
            const sourceCode = typeof body.sourceCode === 'string' ? body.sourceCode : '';
            const expectedRevision = Number(body.expectedRevision);
            if (!fileId || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
                return NextResponse.json({ error: 'fileId and expectedRevision are required.' }, { status: 400 });
            }
            if (Buffer.byteLength(sourceCode, 'utf8') > 1024 * 1024) {
                return NextResponse.json({ error: 'A module file cannot exceed 1 MB.' }, { status: 400 });
            }
            const existing = await client.from('addon_module_files').select('*').eq('id', fileId).eq('module_id', id).maybeSingle();
            if (existing.error) throw new Error(existing.error.message);
            if (!existing.data) return NextResponse.json({ error: 'Module file not found.' }, { status: 404 });
            if (Number(existing.data.revision) !== expectedRevision) {
                return NextResponse.json({ error: 'Revision conflict. Reload the latest file before saving.', file: existing.data }, { status: 409 });
            }
            if (String(existing.data.source_code || '') === sourceCode) {
                return NextResponse.json({ error: 'Change the code before saving.' }, { status: 400 });
            }
            const update = await client.from('addon_module_files').update({
                source_code: sourceCode,
                revision: expectedRevision + 1,
                updated_at: new Date().toISOString(),
            }).eq('id', fileId).eq('module_id', id).eq('revision', expectedRevision).select('*').maybeSingle();
            if (update.error) throw new Error(update.error.message);
            if (!update.data) return NextResponse.json({ error: 'Revision conflict. Reload the latest file before saving.' }, { status: 409 });
            const projectRevision = await bumpModuleProjectRevision(id);
            const project = await ensureModuleProjectForReview(id);
            const serverEntrypoint = project?.project.manifest.entrypoints.server;
            if (existing.data.path === serverEntrypoint) {
                const moduleUpdate = await client.from('addon_modules').update({
                    source_code: sourceCode,
                    source_checksum: checksumModuleSource(sourceCode),
                    config_schema: parseModuleConfigSchema(sourceCode),
                    updated_at: new Date().toISOString(),
                }).eq('id', id);
                if (moduleUpdate.error) throw new Error(moduleUpdate.error.message);
            }
            await logEdit({
                moduleId: id,
                moderatorId: auth.userId,
                editType: 'CODE',
                target: String(existing.data.path || ''),
                reason,
                beforeValue: { sourceCode: existing.data.source_code, revision: expectedRevision },
                afterValue: { sourceCode, revision: expectedRevision + 1 },
            });
            return NextResponse.json({ file: update.data, projectRevision });
        }

        if (action === 'metadata') {
            const current = await client.from('addon_modules').select('name, description, thumbnail_url, thumbnail_urls').eq('id', id).maybeSingle();
            if (current.error) throw new Error(current.error.message);
            if (!current.data) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
            const field = trimModuleString(body.field, 30).toLowerCase();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            let editType: 'TITLE' | 'DESCRIPTION' | 'THUMBNAILS';
            let beforeValue: unknown;
            let afterValue: unknown;
            if (field === 'title') {
                const value = trimModuleString(body.value, 120);
                if (!value) return NextResponse.json({ error: 'Module title is required.' }, { status: 400 });
                updates.name = value;
                editType = 'TITLE';
                beforeValue = current.data.name;
                afterValue = value;
            } else if (field === 'description') {
                const value = trimModuleString(body.value, 2000);
                updates.description = value;
                editType = 'DESCRIPTION';
                beforeValue = current.data.description;
                afterValue = value;
            } else if (field === 'thumbnails') {
                const existingUrls = Array.isArray(current.data.thumbnail_urls)
                    ? current.data.thumbnail_urls.map(String).filter(Boolean).slice(0, 5)
                    : current.data.thumbnail_url ? [String(current.data.thumbnail_url)] : [];
                const value = Array.isArray(body.value) ? [...new Set(body.value.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 5) : [];
                if (value.some((url) => !existingUrls.includes(url))) {
                    return NextResponse.json({ error: 'Moderators may remove or reorder submitted thumbnails, not add unsubmitted images.' }, { status: 400 });
                }
                updates.thumbnail_urls = value;
                updates.thumbnail_url = value[0] || '';
                editType = 'THUMBNAILS';
                beforeValue = existingUrls;
                afterValue = value;
            } else {
                return NextResponse.json({ error: 'Editable metadata fields are title, description, and thumbnails.' }, { status: 400 });
            }
            const updated = await client.from('addon_modules').update(updates).eq('id', id).select('*').maybeSingle();
            if (updated.error) throw new Error(updated.error.message);
            await logEdit({ moduleId: id, moderatorId: auth.userId, editType, target: field, reason, beforeValue, afterValue });
            return NextResponse.json({ module: updated.data });
        }

        if (action === 'dispute') {
            const disputeId = trimModuleString(body.disputeId, 80);
            const status = trimModuleString(body.status, 20).toUpperCase();
            if (!disputeId || !['UPHELD', 'OVERTURNED', 'CLOSED'].includes(status)) {
                return NextResponse.json({ error: 'A dispute and valid resolution are required.' }, { status: 400 });
            }
            const resolved = await client.from('addon_module_disputes').update({
                status,
                moderator_response: reason,
                reviewed_by_discord_id: auth.userId,
                reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', disputeId).eq('module_id', id).select('*').maybeSingle();
            if (resolved.error) throw new Error(resolved.error.message);
            if (!resolved.data) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
            if (status === 'OVERTURNED') {
                const reopened = await client.from('addon_modules').update({
                    status: 'PENDING_REVIEW',
                    submitted_at: new Date().toISOString(),
                    reviewed_at: null,
                    reviewed_by_discord_id: null,
                    moderation_note: `Previous denial overturned: ${reason}`,
                    updated_at: new Date().toISOString(),
                }).eq('id', id);
                if (reopened.error) throw new Error(reopened.error.message);
            }
            return NextResponse.json({ dispute: resolved.data, moduleReopened: status === 'OVERTURNED' });
        }

        return NextResponse.json({ error: 'Unknown review edit action.' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save the review edit.' }, { status: 500 });
    }
}
