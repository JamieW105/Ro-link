import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { normalizeAddonModule, parseModuleSettings, trimModuleString } from '@/lib/modules';
import { supabase } from '@/lib/supabase';

interface InstalledModuleRow {
    module_id: string;
    enabled?: boolean | null;
    settings?: unknown;
    installed_at?: string | null;
    updated_at?: string | null;
}

function canManageModules(permissions: Awaited<ReturnType<typeof resolveDashboardUserPermissions>>) {
    return permissions.is_admin || permissions.can_manage_settings;
}

async function requireServerModuleAccess(serverId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = String((session.user as { id?: string }).id || '');
    const permissions = await resolveDashboardUserPermissions(serverId, userId);
    if (!canManageModules(permissions)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { session, userId, permissions };
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = trimModuleString(searchParams.get('serverId'), 80);

    if (!serverId) {
        return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    const auth = await requireServerModuleAccess(serverId);
    if ('error' in auth) return auth.error;

    const [{ data: modules, error: modulesError }, { data: installedRows, error: installedError }] = await Promise.all([
        supabase
            .from('addon_modules')
            .select('id, slug, name, description, version, category, status, source_checksum, author_discord_id, created_at, updated_at, published_at')
            .eq('status', 'PUBLISHED')
            .order('name', { ascending: true }),
        supabase
            .from('server_addon_modules')
            .select('module_id, enabled, settings, installed_by, installed_at, updated_at')
            .eq('server_id', serverId),
    ]);

    if (modulesError) {
        return NextResponse.json({ error: modulesError.message }, { status: 500 });
    }

    if (installedError) {
        return NextResponse.json({ error: installedError.message }, { status: 500 });
    }

    const installedByModule = new Map(((installedRows || []) as InstalledModuleRow[]).map((row) => [String(row.module_id), row]));

    return NextResponse.json({
        modules: ((modules || []) as Record<string, unknown>[]).map((row) => {
            const installed = installedByModule.get(String(row.id));
            return {
                ...normalizeAddonModule(row, false),
                installed: Boolean(installed),
                enabled: installed ? installed.enabled !== false : false,
                settings: parseModuleSettings(installed?.settings),
                installedAt: installed?.installed_at || null,
                serverModuleUpdatedAt: installed?.updated_at || null,
            };
        }).filter(Boolean),
    });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const serverId = trimModuleString(body.serverId, 80);
    const moduleId = trimModuleString(body.moduleId, 80);
    const action = trimModuleString(body.action, 40).toLowerCase();

    if (!serverId || !moduleId || !action) {
        return NextResponse.json({ error: 'serverId, moduleId, and action are required.' }, { status: 400 });
    }

    const auth = await requireServerModuleAccess(serverId);
    if ('error' in auth) return auth.error;

    const { data: moduleRow, error: moduleError } = await supabase
        .from('addon_modules')
        .select('id, status')
        .eq('id', moduleId)
        .maybeSingle<{ id: string; status: string }>();

    if (moduleError) {
        return NextResponse.json({ error: moduleError.message }, { status: 500 });
    }

    if (!moduleRow || moduleRow.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Published module not found.' }, { status: 404 });
    }

    if (action === 'remove') {
        const { error } = await supabase
            .from('server_addon_modules')
            .delete()
            .eq('server_id', serverId)
            .eq('module_id', moduleId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }

    if (action === 'install') {
        const { error } = await supabase
            .from('server_addon_modules')
            .upsert({
                server_id: serverId,
                module_id: moduleId,
                enabled: true,
                settings: parseModuleSettings(body.settings),
                installed_by: auth.userId,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'server_id,module_id' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }

    if (action === 'enable' || action === 'disable' || action === 'settings') {
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (action === 'enable') updates.enabled = true;
        if (action === 'disable') updates.enabled = false;
        if (action === 'settings') updates.settings = parseModuleSettings(body.settings);

        const { error } = await supabase
            .from('server_addon_modules')
            .update(updates)
            .eq('server_id', serverId)
            .eq('module_id', moduleId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown module action.' }, { status: 400 });
}
