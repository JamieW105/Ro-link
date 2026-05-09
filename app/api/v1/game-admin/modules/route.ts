import { NextResponse } from 'next/server';

import { getServerByApiKey } from '@/lib/gameAdmin';
import { normalizeAddonModule, obfuscateModuleSourceForStudio, parseModuleConfigSettings, parseStoredModuleConfigSchema } from '@/lib/modules';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ServerAddonModuleRow {
    enabled?: boolean | null;
    settings?: unknown;
    module?: Record<string, unknown> | Record<string, unknown>[] | null;
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

    const { data, error } = await supabase
        .from('server_addon_modules')
        .select(`
            enabled,
            settings,
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
        .eq('enabled', true);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const modules = (data || [])
        .map((row: ServerAddonModuleRow) => {
            const moduleRow = Array.isArray(row.module) ? row.module[0] : row.module;
            if (!moduleRow || moduleRow.status !== 'PUBLISHED') {
                return null;
            }
            const configSchema = parseStoredModuleConfigSchema(moduleRow.config_schema);

            const normalized = normalizeAddonModule(moduleRow, true);
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

    return NextResponse.json(
        {
            serverId: server.id,
            modules,
        },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        },
    );
}
