import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { buildDeliveryArgs, resolveLiveServerTargets, trimString, type CommandArgs, type DeliveryTarget } from '@/lib/commandDelivery';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import { logAction } from '@/lib/logger';
import { parseModuleLiveConfigValue, parseStoredModuleConfigSchema, type ModuleConfigField, type ModuleConfigSchema } from '@/lib/modules';
import { sendRobloxMessage } from '@/lib/roblox';
import { supabase } from '@/lib/supabase';

interface CustomModuleLiveRow {
    id: string;
    slug?: string | null;
    name?: string | null;
    enabled?: boolean | null;
    status?: string | null;
    config_schema?: unknown;
}

interface InstalledModuleLiveRow {
    enabled?: boolean | null;
    module?: Record<string, unknown> | Record<string, unknown>[] | null;
}

function canSendModuleLiveActions(permissions: Awaited<ReturnType<typeof resolveDashboardUserPermissions>>) {
    return permissions.is_admin || permissions.can_manage_settings;
}

async function requireServerAccess(serverId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = String((session.user as { id?: string }).id || '');
    const permissions = await resolveDashboardUserPermissions(serverId, userId);
    if (!canSendModuleLiveActions(permissions)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { session, userId, permissions };
}

async function getInstalledModuleForLiveAction(serverId: string, moduleId: string, userId: string) {
    const { data: customModule, error: customError } = await supabase
        .from('server_custom_modules')
        .select('id, slug, name, enabled, status, config_schema')
        .eq('server_id', serverId)
        .eq('id', moduleId)
        .maybeSingle<CustomModuleLiveRow>();

    if (customError) {
        throw new Error(customError.message);
    }

    if (customModule) {
        if (customModule.enabled === false || customModule.status !== 'READY') {
            return { error: 'This custom module is not enabled.' };
        }

        return {
            id: customModule.id,
            slug: trimString(customModule.slug),
            name: trimString(customModule.name) || 'Custom Module',
            schema: parseStoredModuleConfigSchema(customModule.config_schema),
        };
    }

    const { data: installedRow, error: installedError } = await supabase
        .from('server_addon_modules')
        .select(`
            enabled,
            module:addon_modules (
                id,
                slug,
                name,
                status,
                author_discord_id,
                config_schema
            )
        `)
        .eq('server_id', serverId)
        .eq('module_id', moduleId)
        .maybeSingle<InstalledModuleLiveRow>();

    if (installedError) {
        throw new Error(installedError.message);
    }

    const moduleRow = Array.isArray(installedRow?.module) ? installedRow?.module[0] : installedRow?.module;
    const canUseOwnUnpublished = moduleRow?.author_discord_id === userId
        && (moduleRow.status === 'DRAFT' || moduleRow.status === 'PENDING_REVIEW');

    if (!installedRow || !moduleRow || (moduleRow.status !== 'PUBLISHED' && !canUseOwnUnpublished)) {
        return { error: 'Installed module not found.' };
    }

    if (installedRow.enabled === false) {
        return { error: 'This module is not enabled.' };
    }

    return {
        id: trimString(moduleRow.id) || moduleId,
        slug: trimString(moduleRow.slug),
        name: trimString(moduleRow.name) || 'Marketplace Module',
        schema: parseStoredModuleConfigSchema(moduleRow.config_schema),
    };
}

function getLiveField(schema: ModuleConfigSchema, fieldKey: string) {
    const field = schema[fieldKey];
    return field?.live ? field : null;
}

function readRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function readDynamicJobId(value: unknown, includeGenericIds = false) {
    const record = readRecord(value);
    if (!record) return '';
    const explicitJobId = trimString(record.jobId || record.JobId || record.job_id);
    if (explicitJobId || !includeGenericIds) return explicitJobId;
    return trimString(record.id || record.Id || record.value);
}

function findSelectedJobId(value: unknown, field: ModuleConfigField): string {
    let directJobId = '';
    if (field.type === 'server') {
        directJobId = readDynamicJobId(value, true);
    } else if (field.type === 'player') {
        directJobId = readDynamicJobId(value);
    }
    if (directJobId) return directJobId;

    const record = readRecord(value);
    if (!record) return '';

    for (const subField of field.subFields) {
        const subJobId = findSelectedJobId(record[subField.key], subField);
        if (subJobId) return subJobId;
    }

    if (field.type !== 'group' && 'value' in record) {
        return readDynamicJobId(record.value, field.type === 'server');
    }

    return '';
}

async function resolveModuleLiveTargets(serverId: string, field: ModuleConfigField, value: unknown) {
    const selectedJobId = findSelectedJobId(value, field);
    if (selectedJobId) {
        return [{
            deliveryId: crypto.randomUUID(),
            jobId: selectedJobId,
            scope: 'SERVER',
        }] satisfies DeliveryTarget[];
    }

    return resolveLiveServerTargets(serverId);
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const serverId = trimString(body.serverId);
        const moduleId = trimString(body.moduleId);
        const fieldKey = trimString(body.fieldKey);

        if (!serverId || !moduleId || !fieldKey) {
            return NextResponse.json({ error: 'serverId, moduleId, and fieldKey are required.' }, { status: 400 });
        }

        const auth = await requireServerAccess(serverId);
        if ('error' in auth) return auth.error;

        const moduleResult = await getInstalledModuleForLiveAction(serverId, moduleId, auth.userId);
        if ('error' in moduleResult) {
            return NextResponse.json({ error: moduleResult.error }, { status: 404 });
        }

        const field = getLiveField(moduleResult.schema, fieldKey);
        if (!field) {
            return NextResponse.json({ error: 'That CONFIG field is not a live action.' }, { status: 400 });
        }

        const value = parseModuleLiveConfigValue(body.value, field);
        const deliveryTargets = await resolveModuleLiveTargets(serverId, field, value);
        if (deliveryTargets.length === 0) {
            return NextResponse.json({ error: 'No live servers are available for this module action.' }, { status: 400 });
        }
        const moderator = trimString(auth.session.user?.name) || 'Web Admin';
        const baseArgs: CommandArgs = {
            module_id: moduleResult.id,
            module_slug: moduleResult.slug,
            module_name: moduleResult.name,
            field_key: field.key,
            field_label: field.label,
            value,
            moderator,
        };

        const queueRows = deliveryTargets.map((target) => ({
            server_id: serverId,
            command: 'MODULE_LIVE',
            args: buildDeliveryArgs(baseArgs, target),
            status: 'PENDING',
        }));

        const { error: queueError } = await supabase
            .from('command_queue')
            .insert(queueRows);

        if (queueError) {
            return NextResponse.json({ error: queueError.message }, { status: 500 });
        }

        const realtimeResults = await Promise.all(
            deliveryTargets.map((target) => sendRobloxMessage(
                serverId,
                'MODULE_LIVE',
                buildDeliveryArgs(baseArgs, target),
            )),
        );

        const realtimeSuccess = realtimeResults.some((result) => result.success);
        const realtimeWarnings = realtimeResults
            .filter((result) => !result.success)
            .map((result) => trimString(result.error))
            .filter(Boolean);

        await logAction(
            serverId,
            'MODULE_LIVE',
            `${moduleResult.slug || moduleResult.id}.${field.key}`,
            moderator,
            `Live module action: ${field.label}`,
        );

        return NextResponse.json({
            success: true,
            queued: true,
            realtime: realtimeSuccess,
            warning: realtimeWarnings.length > 0 ? realtimeWarnings.join(' | ') : null,
            deliveredTargets: deliveryTargets.length,
        });
    } catch (error) {
        console.error('[Dashboard Module Live API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
