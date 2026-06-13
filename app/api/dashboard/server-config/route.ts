import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { canAccessDashboardOrLivePanel, canManageSettings, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { findBlockedServer, getBlockedServerMessage } from '@/lib/blockedServers';

const READ_COLUMNS = [
    'id',
    'api_key',
    'place_id',
    'universe_id',
    'open_cloud_key',
    'admin_cmds_enabled',
    'misc_cmds_enabled',
    'logging_channel_id',
    'reports_enabled',
    'reports_channel_id',
    'verification_enabled',
    'on_join_role',
    'verified_role',
    'block_unverified',
].join(', ');

const SETTINGS_FIELDS = new Set([
    'admin_cmds_enabled',
    'misc_cmds_enabled',
    'logging_channel_id',
    'reports_enabled',
    'reports_channel_id',
    'verification_enabled',
    'on_join_role',
    'verified_role',
    'block_unverified',
]);

function redactServerConfig(row: Record<string, unknown>, includeSecrets: boolean) {
    if (includeSecrets) {
        return row;
    }

    const { api_key: _apiKey, open_cloud_key: _openCloudKey, ...safeRow } = row;
    return safeRow;
}

function createApiKey() {
    return `rl_${randomBytes(18).toString('base64url')}`;
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireDashboardAccess(serverId, canAccessDashboardOrLivePanel);
    if ('error' in access) {
        return access.error;
    }

    const client = getSupabaseAdmin();
    const blocked = await findBlockedServer(client, serverId);
    if (blocked) {
        return NextResponse.json({ error: getBlockedServerMessage(blocked) }, { status: 403 });
    }

    const { data, error } = await client
        .from('servers')
        .select(READ_COLUMNS)
        .eq('id', serverId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
        data ? redactServerConfig(data, canManageSettings(access.permissions)) : null,
    );
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const serverId = trimString(body?.serverId);
    const access = await requireDashboardAccess(serverId, canManageSettings);
    if ('error' in access) {
        return access.error;
    }

    const apiKey = trimString(body?.apiKey) || createApiKey();
    const row = {
        id: serverId,
        place_id: trimString(body?.placeId),
        universe_id: trimString(body?.universeId),
        open_cloud_key: trimString(body?.openCloudKey),
        api_key: apiKey,
    };

    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('servers')
        .upsert(row)
        .select(READ_COLUMNS)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const serverId = trimString(body?.serverId);
    const access = await requireDashboardAccess(serverId, canManageSettings);
    if ('error' in access) {
        return access.error;
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body?.updates || {})) {
        if (!SETTINGS_FIELDS.has(key)) {
            continue;
        }

        updates[key] = value === '' ? null : value;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No supported updates provided' }, { status: 400 });
    }

    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('servers')
        .update(updates)
        .eq('id', serverId)
        .select(READ_COLUMNS)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
