import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import {
    checksumModuleSource,
    MAX_SERVER_ADDON_MODULES,
    MAX_SERVER_CUSTOM_MODULES,
    normalizeAddonModule,
    normalizeServerCustomModule,
    parseModuleConfigSchema,
    parseModuleConfigSettings,
    parseModuleConfigVersion,
    parseStoredModuleConfigSchema,
    slugifyModuleName,
    trimModuleString,
} from '@/lib/modules';
import { applyVerifiedCreatorBadges } from '@/lib/moduleCreatorVerification';
import { applyOfficialModuleLabels, getRoLinkStaffDiscordIds } from '@/lib/moduleOfficial';
import { supabase } from '@/lib/supabase';

interface InstalledModuleRow {
    module_id: string;
    enabled?: boolean | null;
    settings?: unknown;
    installed_at?: string | null;
    updated_at?: string | null;
}

interface ServerCustomModuleRow {
    id: string;
    slug?: string | null;
    name?: string | null;
    description?: string | null;
    version?: string | null;
    source_code?: string | null;
    source_checksum?: string | null;
    config_schema?: unknown;
    settings?: unknown;
    enabled?: boolean | null;
    status?: string | null;
    review_results?: unknown;
    uploaded_by?: string | null;
    uploaded_at?: string | null;
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

async function buildUniqueCustomModuleSlug(serverId: string, seed: string, existingId?: string) {
    const baseSlug = slugifyModuleName(seed);
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
        let query = supabase
            .from('server_custom_modules')
            .select('id')
            .eq('server_id', serverId)
            .eq('slug', slug);

        if (existingId) {
            query = query.neq('id', existingId);
        }

        const { data, error } = await query.maybeSingle<{ id: string }>();

        if (error) {
            throw new Error(error.message);
        }

        if (!data) {
            return slug;
        }

        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = trimModuleString(searchParams.get('serverId'), 80);

    if (!serverId) {
        return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    const auth = await requireServerModuleAccess(serverId);
    if ('error' in auth) return auth.error;

    const moduleQuery = supabase
        .from('addon_modules')
        .select('id, slug, name, description, version, category, status, source_checksum, config_schema, author_discord_id, submitted_at, reviewed_at, reviewed_by_discord_id, moderation_note, created_at, updated_at, published_at')
        .order('name', { ascending: true });

    const [{ data: modules, error: modulesError }, { data: installedRows, error: installedError }, { data: customRows, error: customError }] = await Promise.all([
        moduleQuery.or(`status.eq.PUBLISHED,author_discord_id.eq.${auth.userId}`),
        supabase
            .from('server_addon_modules')
            .select('module_id, enabled, settings, installed_by, installed_at, updated_at')
            .eq('server_id', serverId),
        supabase
            .from('server_custom_modules')
            .select('id, server_id, slug, name, description, version, source_checksum, config_schema, settings, enabled, status, review_results, uploaded_by, uploaded_at, updated_at')
            .eq('server_id', serverId)
            .order('updated_at', { ascending: false }),
    ]);

    if (modulesError) {
        return NextResponse.json({ error: modulesError.message }, { status: 500 });
    }

    if (installedError) {
        return NextResponse.json({ error: installedError.message }, { status: 500 });
    }

    if (customError) {
        return NextResponse.json({ error: customError.message }, { status: 500 });
    }

    const installedByModule = new Map(((installedRows || []) as InstalledModuleRow[]).map((row) => [String(row.module_id), row]));
    const staffDiscordIds = await getRoLinkStaffDiscordIds();

    const labeledModules = await applyVerifiedCreatorBadges(
        applyOfficialModuleLabels((modules || []) as Record<string, unknown>[], staffDiscordIds),
    );

    const marketplaceModules = labeledModules
        .filter((row) => (
            row.status === 'PUBLISHED'
            || (row.author_discord_id === auth.userId && (row.status === 'DRAFT' || row.status === 'PENDING_REVIEW'))
        ))
        .map((row) => {
            const installed = installedByModule.get(String(row.id));
            const configSchema = parseStoredModuleConfigSchema(row.config_schema);
            return {
                ...normalizeAddonModule(row, false),
                isCustom: false,
                installed: Boolean(installed),
                enabled: installed ? installed.enabled !== false : false,
                settings: parseModuleConfigSettings(installed?.settings, configSchema),
                installedAt: installed?.installed_at || null,
                serverModuleUpdatedAt: installed?.updated_at || null,
            };
        })
        .filter((module) => module && module.installed);

    const customModules = ((customRows || []) as ServerCustomModuleRow[])
        .map((row) => {
            const configSchema = parseStoredModuleConfigSchema(row.config_schema);
            return {
                ...normalizeServerCustomModule(row as unknown as Record<string, unknown>, false),
                settings: parseModuleConfigSettings(row.settings, configSchema),
            };
        })
        .filter(Boolean);

    return NextResponse.json({
        moduleLimit: MAX_SERVER_ADDON_MODULES,
        customModuleLimit: MAX_SERVER_CUSTOM_MODULES,
        installedCount: installedByModule.size,
        customInstalledCount: customModules.length,
        modules: [...customModules, ...marketplaceModules],
    });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const serverId = trimModuleString(body.serverId, 80);
    const moduleId = trimModuleString(body.moduleId, 80);
    const action = trimModuleString(body.action, 40).toLowerCase();

    if (!serverId || !action) {
        return NextResponse.json({ error: 'serverId and action are required.' }, { status: 400 });
    }

    const auth = await requireServerModuleAccess(serverId);
    if ('error' in auth) return auth.error;

    if (action.startsWith('custom-')) {
        const customAction = action.slice('custom-'.length);

        if (customAction === 'create' || customAction === 'reupload') {
            const sourceCode = trimModuleString(body.sourceCode ?? body.source_code, 250_000);
            const name = trimModuleString(body.name, 120);
            const description = trimModuleString(body.description, 2000);

            if (!name || !sourceCode) {
                return NextResponse.json({ error: 'Custom module name and source code are required.' }, { status: 400 });
            }

            if (customAction === 'create') {
                const { count, error: countError } = await supabase
                    .from('server_custom_modules')
                    .select('id', { count: 'exact', head: true })
                    .eq('server_id', serverId);

                if (countError) {
                    return NextResponse.json({ error: countError.message }, { status: 500 });
                }

                if ((count || 0) >= MAX_SERVER_CUSTOM_MODULES) {
                    return NextResponse.json({
                        error: `Servers can only have ${MAX_SERVER_CUSTOM_MODULES} custom modules uploaded at one time. Remove a module before uploading another.`,
                        customModuleLimit: MAX_SERVER_CUSTOM_MODULES,
                        customInstalledCount: count || 0,
                    }, { status: 409 });
                }
            } else if (!moduleId) {
                return NextResponse.json({ error: 'moduleId is required when reuploading a custom module.' }, { status: 400 });
            }

            const configSchema = parseModuleConfigSchema(sourceCode);
            const version = trimModuleString(body.version, 40) || parseModuleConfigVersion(sourceCode) || '1.0.0';
            const slug = customAction === 'create'
                ? await buildUniqueCustomModuleSlug(serverId, trimModuleString(body.slug, 80) || name)
                : undefined;
            const now = new Date().toISOString();
            const payload = {
                server_id: serverId,
                name,
                description,
                version,
                source_code: sourceCode,
                source_checksum: checksumModuleSource(sourceCode),
                config_schema: configSchema,
                settings: parseModuleConfigSettings(body.settings, configSchema),
                enabled: true,
                status: 'READY',
                review_results: [],
                uploaded_by: auth.userId,
                updated_at: now,
            };

            const query = customAction === 'create'
                ? supabase
                    .from('server_custom_modules')
                    .insert({ ...payload, slug, uploaded_at: now })
                    .select('*')
                    .single()
                : supabase
                    .from('server_custom_modules')
                    .update(payload)
                    .eq('server_id', serverId)
                    .eq('id', moduleId)
                    .select('*')
                    .single();

            const { data, error } = await query;

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            const module = normalizeServerCustomModule(data as Record<string, unknown>, false);

            return NextResponse.json({
                success: true,
                module,
            }, { status: customAction === 'create' ? 201 : 200 });
        }

        if (!moduleId) {
            return NextResponse.json({ error: 'moduleId is required for custom module actions.' }, { status: 400 });
        }

        if (customAction === 'remove') {
            const { error } = await supabase
                .from('server_custom_modules')
                .delete()
                .eq('server_id', serverId)
                .eq('id', moduleId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        const { data: customModule, error: customModuleError } = await supabase
            .from('server_custom_modules')
            .select('id, config_schema')
            .eq('server_id', serverId)
            .eq('id', moduleId)
            .maybeSingle<{ id: string; config_schema?: unknown }>();

        if (customModuleError) {
            return NextResponse.json({ error: customModuleError.message }, { status: 500 });
        }

        if (!customModule) {
            return NextResponse.json({ error: 'Custom module not found.' }, { status: 404 });
        }

        if (customAction === 'enable' || customAction === 'disable' || customAction === 'settings') {
            const updates: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
            };

            if (customAction === 'enable') updates.enabled = true;
            if (customAction === 'disable') updates.enabled = false;
            if (customAction === 'settings') updates.settings = parseModuleConfigSettings(body.settings, parseStoredModuleConfigSchema(customModule.config_schema));

            const { error } = await supabase
                .from('server_custom_modules')
                .update(updates)
                .eq('server_id', serverId)
                .eq('id', moduleId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown custom module action.' }, { status: 400 });
    }

    if (!moduleId) {
        return NextResponse.json({ error: 'moduleId is required.' }, { status: 400 });
    }

    const { data: moduleRow, error: moduleError } = await supabase
        .from('addon_modules')
        .select('id, status, config_schema, author_discord_id')
        .eq('id', moduleId)
        .maybeSingle<{ id: string; status: string; config_schema?: unknown; author_discord_id?: string | null }>();

    if (moduleError) {
        return NextResponse.json({ error: moduleError.message }, { status: 500 });
    }

    const canUseOwnUnpublished = moduleRow?.author_discord_id === auth.userId
        && (moduleRow.status === 'DRAFT' || moduleRow.status === 'PENDING_REVIEW');

    if (!moduleRow || (moduleRow.status !== 'PUBLISHED' && !canUseOwnUnpublished)) {
        return NextResponse.json({ error: 'Published module not found.' }, { status: 404 });
    }

    const configSchema = parseStoredModuleConfigSchema(moduleRow.config_schema);

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
        const { data: existingInstall, error: existingInstallError } = await supabase
            .from('server_addon_modules')
            .select('module_id')
            .eq('server_id', serverId)
            .eq('module_id', moduleId)
            .maybeSingle<{ module_id: string }>();

        if (existingInstallError) {
            return NextResponse.json({ error: existingInstallError.message }, { status: 500 });
        }

        if (!existingInstall) {
            const { count, error: countError } = await supabase
                .from('server_addon_modules')
                .select('module_id', { count: 'exact', head: true })
                .eq('server_id', serverId);

            if (countError) {
                return NextResponse.json({ error: countError.message }, { status: 500 });
            }

            if ((count || 0) >= MAX_SERVER_ADDON_MODULES) {
                return NextResponse.json({
                    error: `Servers can only have ${MAX_SERVER_ADDON_MODULES} custom modules installed at one time. Remove a module before installing another.`,
                    moduleLimit: MAX_SERVER_ADDON_MODULES,
                    installedCount: count || 0,
                }, { status: 409 });
            }
        }

        const { error } = await supabase
            .from('server_addon_modules')
            .upsert({
                server_id: serverId,
                module_id: moduleId,
                enabled: true,
                settings: parseModuleConfigSettings(body.settings, configSchema),
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
        if (action === 'settings') updates.settings = parseModuleConfigSettings(body.settings, configSchema);

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
