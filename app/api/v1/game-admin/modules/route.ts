import { NextResponse } from 'next/server';

import { getServerByApiKey } from '@/lib/gameAdmin';
import { normalizeAddonModule, normalizeServerCustomModule, obfuscateModuleSourceForStudio, parseModuleConfigSettings, parseStoredModuleConfigSchema } from '@/lib/modules';
import { applyOfficialModuleLabels, getRoLinkStaffDiscordIds } from '@/lib/moduleOfficial';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ServerAddonModuleRow {
    enabled?: boolean | null;
    settings?: unknown;
    installed_by?: string | null;
    module?: Record<string, unknown> | Record<string, unknown>[] | null;
}

interface ServerCustomModuleRow {
    id: string;
    config_schema?: unknown;
    settings?: unknown;
}

export async function GET(req: Request) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const url = new URL(req.url);
    const configOnly = ['1', 'true', 'yes'].includes((url.searchParams.get('configOnly') || '').toLowerCase());
    const requestedModuleId = String(url.searchParams.get('moduleId') || url.searchParams.get('id') || '').trim();
    const requestedModuleSlug = String(url.searchParams.get('moduleSlug') || url.searchParams.get('slug') || '').trim();

    const server = await getServerByApiKey(apiKey);
    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    const addonModuleSelect = `
            enabled,
            settings,
            installed_by,
            module:addon_modules (
                id,
                slug,
                name,
                description,
                version,
                category,
                status,
                ${configOnly ? '' : 'source_code,'}
                source_checksum,
                config_schema,
                author_discord_id,
                created_at,
                updated_at,
                published_at
            )
        `;
    const customModuleSelect = [
        'id',
        'server_id',
        'slug',
        'name',
        'description',
        'version',
        ...(configOnly ? [] : ['source_code']),
        'source_checksum',
        'config_schema',
        'settings',
        'enabled',
        'status',
        'review_results',
        'uploaded_by',
        'uploaded_at',
        'updated_at',
    ].join(', ');

    const [{ data, error }, { data: customRows, error: customError }] = await Promise.all([
        supabase
        .from('server_addon_modules')
        .select(addonModuleSelect)
        .eq('server_id', server.id)
        .eq('enabled', true),
        supabase
            .from('server_custom_modules')
            .select(customModuleSelect)
            .eq('server_id', server.id)
            .eq('enabled', true),
    ]);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const customModuleStorageMissing = customError
        && /server_custom_modules|schema cache|could not find the table/i.test(customError.message || '');

    if (customError && !customModuleStorageMissing) {
        return NextResponse.json({ error: customError.message }, { status: 500 });
    }

    const addonRows = (data || []) as unknown as ServerAddonModuleRow[];
    const customModuleRows = (customModuleStorageMissing ? [] : customRows || []) as unknown as ServerCustomModuleRow[];

    const staffDiscordIds = await getRoLinkStaffDiscordIds();

    const marketplaceModules = addonRows
        .map((row: ServerAddonModuleRow) => {
            const moduleRow = Array.isArray(row.module) ? row.module[0] : row.module;
            const canRunCreatorPreview = moduleRow
                && row.installed_by === moduleRow.author_discord_id
                && (moduleRow.status === 'DRAFT' || moduleRow.status === 'PENDING_REVIEW');
            if (!moduleRow || (moduleRow.status !== 'PUBLISHED' && !canRunCreatorPreview)) {
                return null;
            }
            const configSchema = parseStoredModuleConfigSchema(moduleRow.config_schema);

            const [labeledModule] = applyOfficialModuleLabels([moduleRow], staffDiscordIds);
            const normalized = normalizeAddonModule(labeledModule, !configOnly);
            if (!normalized) {
                return null;
            }

            return {
                ...normalized,
                ...(configOnly ? {} : { sourceCode: obfuscateModuleSourceForStudio(String(normalized.sourceCode || '')) }),
                settings: parseModuleConfigSettings(row.settings, configSchema),
            };
        })
        .filter(Boolean);

    const customModules = customModuleRows
        .map((row) => {
            const configSchema = parseStoredModuleConfigSchema(row.config_schema);
            const normalized = normalizeServerCustomModule(row as unknown as Record<string, unknown>, !configOnly);
            if (!normalized || !normalized.enabled) {
                return null;
            }

            return {
                ...normalized,
                ...(configOnly ? {} : { sourceCode: obfuscateModuleSourceForStudio(String(normalized.sourceCode || '')) }),
                settings: parseModuleConfigSettings(row.settings, configSchema),
            };
        })
        .filter(Boolean);

    const modules = [...marketplaceModules, ...customModules];
    const filteredModules = requestedModuleId || requestedModuleSlug
        ? modules.filter((module) => {
            const row = module as { id?: string; slug?: string };
            return (requestedModuleId && row.id === requestedModuleId)
                || (requestedModuleSlug && row.slug === requestedModuleSlug);
        })
        : modules;

    if (configOnly) {
        if (requestedModuleId || requestedModuleSlug) {
            const module = filteredModules[0] || null;
            if (!module) {
                return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
            }

            return NextResponse.json(
                {
                    serverId: server.id,
                    module,
                },
                {
                    headers: {
                        'Cache-Control': 'no-store',
                    },
                },
            );
        }

        return NextResponse.json(
            {
                serverId: server.id,
                modules: filteredModules,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            },
        );
    }

    return NextResponse.json(
        {
            serverId: server.id,
            modules: filteredModules,
        },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        },
    );
}
