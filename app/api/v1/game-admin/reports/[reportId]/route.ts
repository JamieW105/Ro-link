import { NextRequest, NextResponse } from 'next/server';

import { getServerByApiKey } from '@/lib/gameAdmin';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const VALID_REPORT_STATUSES = new Set(['PENDING', 'RESOLVED', 'DISMISSED']);

function trimString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

async function requireReportApiAccess(req: Request, bodyKey?: unknown) {
    const auth = readServerApiKeyDetails(req, bodyKey);
    if (!auth.key) {
        return {
            error: NextResponse.json(
                {
                    error: 'Missing API Key',
                    message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
                    received: describeServerApiKeyDetails(auth),
                },
                { status: 401 },
            ),
        };
    }

    const server = await getServerByApiKey(auth.key);
    if (!server) {
        return { error: NextResponse.json({ error: 'Invalid API Key' }, { status: 403 }) };
    }

    return { server };
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    const access = await requireReportApiAccess(req);
    if ('error' in access) return access.error;

    const { reportId } = await params;
    const { data, error } = await getSupabaseAdmin()
        .from('reports')
        .select('*')
        .eq('server_id', access.server.id)
        .eq('id', reportId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ serverId: access.server.id, report: data });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const access = await requireReportApiAccess(req, body.apiKey ?? body.key ?? body.serverKey ?? body.securityKey);
    if ('error' in access) return access.error;

    const status = trimString(body.status, 20).toUpperCase();
    const updates: Record<string, unknown> = {};

    if (status) {
        if (!VALID_REPORT_STATUSES.has(status)) {
            return NextResponse.json({ error: 'Invalid report status' }, { status: 400 });
        }
        updates.status = status;
        updates.resolved_at = status === 'PENDING' ? null : new Date().toISOString();
    }

    if ('moderatorNote' in body || 'moderator_note' in body) {
        updates.moderator_note = trimString(body.moderatorNote ?? body.moderator_note, 2000) || null;
    }

    if ('moderatorId' in body || 'moderator_id' in body) {
        updates.moderator_id = trimString(body.moderatorId ?? body.moderator_id, 120) || null;
    }

    if ('reason' in body) {
        const reason = trimString(body.reason, 2000);
        if (!reason) {
            return NextResponse.json({ error: 'reason cannot be empty.' }, { status: 400 });
        }
        updates.reason = reason;
    }

    if ('reportedRobloxUsername' in body || 'reported_roblox_username' in body || 'target' in body) {
        const target = trimString(body.reportedRobloxUsername ?? body.reported_roblox_username ?? body.target, 120);
        if (!target) {
            return NextResponse.json({ error: 'reportedRobloxUsername cannot be empty.' }, { status: 400 });
        }
        updates.reported_roblox_username = target;
    }

    if ('reporterRobloxUsername' in body || 'reporter_roblox_username' in body) {
        updates.reporter_roblox_username = trimString(body.reporterRobloxUsername ?? body.reporter_roblox_username, 120) || null;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No editable report fields were provided.' }, { status: 400 });
    }

    const { reportId } = await params;
    const { data, error } = await getSupabaseAdmin()
        .from('reports')
        .update(updates)
        .eq('server_id', access.server.id)
        .eq('id', reportId)
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ serverId: access.server.id, report: data });
}
