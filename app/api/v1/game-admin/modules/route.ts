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

    const server = await getServerByApiKey(apiKey);
    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    const [{ data, error }, { data: customRows, error: customError }] = await Promise.all([
        supabase
        .from('server_addon_modules')
        .select(`
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
                source_code,
                source_checksum,
                config_schema,
                author_discord_id,
                created_at,
                updated_at,
                published_at
            )
        `)
        .eq('server_id', server.id)
        .eq('enabled', true),
        supabase
            .from('server_custom_modules')
            .select('id, server_id, slug, name, description, version, source_code, source_checksum, config_schema, settings, enabled, status, review_results, uploaded_by, uploaded_at, updated_at')
            .eq('server_id', server.id)
            .eq('enabled', true)
            .eq('status', 'READY'),
    ]);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const customModuleStorageMissing = customError
        && /server_custom_modules|schema cache|could not find the table/i.test(customError.message || '');

    if (customError && !customModuleStorageMissing) {
        return NextResponse.json({ error: customError.message }, { status: 500 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();

    const marketplaceModules = (data || [])
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
            const normalized = normalizeAddonModule(labeledModule, true);
            if (!normalized) {
                return null;
            }

            return {
                ...normalized,
                sourceCode: obfuscateModuleSourceForStudio(String(normalized.sourceCode || '')),
                settings: parseModuleConfigSettings(row.settings, configSchema),
            };
        })
        .filter(Boolean);

    const customModules = ((customModuleStorageMissing ? [] : customRows || []) as ServerCustomModuleRow[])
        .map((row) => {
            const configSchema = parseStoredModuleConfigSchema(row.config_schema);
            const normalized = normalizeServerCustomModule(row as unknown as Record<string, unknown>, true);
            if (!normalized || normalized.status !== 'READY' || !normalized.enabled) {
                return null;
            }

            return {
                ...normalized,
                sourceCode: obfuscateModuleSourceForStudio(String(normalized.sourceCode || '')),
                settings: parseModuleConfigSettings(row.settings, configSchema),
            };
        })
        .filter(Boolean);

    return NextResponse.json(
        {
            serverId: server.id,
            modules: [...marketplaceModules, ...customModules],
        },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        },
    );
}
