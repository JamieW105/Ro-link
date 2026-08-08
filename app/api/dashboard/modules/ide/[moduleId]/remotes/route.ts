import { NextResponse } from 'next/server';

import { bumpModuleProjectRevision, ensureOwnedModuleProject } from '@/lib/moduleIde';
import { requireModuleIdeUser, noStoreJson } from '@/lib/moduleIdeAuth';
import { trimModuleString } from '@/lib/modules';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ moduleId: string }> };

export async function POST(req: Request, context: Context) {
    const auth = await requireModuleIdeUser();
    if ('error' in auth) return auth.error;
    const { moduleId } = await context.params;
    try {
        if (!await ensureOwnedModuleProject(moduleId, auth.discordUserId)) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        const action = String(body?.action || '');
        const client = getSupabaseAdmin();
        if (action === 'create' || action === 'update') {
            const name = trimModuleString(body?.name, 64);
            const remoteType = String(body?.remoteType || 'event');
            const direction = String(body?.direction || 'bidirectional');
            if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)) return NextResponse.json({ error: 'Remote names must start with a letter and contain only letters, numbers, or underscores.' }, { status: 400 });
            if (!['event', 'function'].includes(remoteType) || !['client_to_server', 'server_to_client', 'bidirectional'].includes(direction)) return NextResponse.json({ error: 'Remote type or direction is invalid.' }, { status: 400 });
            const values = { name, remote_type: remoteType, direction, schema: body?.schema && typeof body.schema === 'object' ? body.schema : {} };
            const query = action === 'create'
                ? client.from('addon_module_remotes').insert({ module_id: moduleId, ...values })
                : client.from('addon_module_remotes').update({ ...values, updated_at: new Date().toISOString() }).eq('module_id', moduleId).eq('id', String(body?.id || ''));
            const { data, error } = await query.select('*').single();
            if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 400 });
            const revision = await bumpModuleProjectRevision(moduleId);
            return noStoreJson({ remote: data, projectRevision: revision }, { status: action === 'create' ? 201 : 200 });
        }
        if (action === 'delete') {
            const { error } = await client.from('addon_module_remotes').delete().eq('module_id', moduleId).eq('id', String(body?.id || ''));
            if (error) throw new Error(error.message);
            const revision = await bumpModuleProjectRevision(moduleId);
            return noStoreJson({ success: true, projectRevision: revision });
        }
        return NextResponse.json({ error: 'Unsupported remote action.' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Remote operation failed.' }, { status: 500 });
    }
}
