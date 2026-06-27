import { NextResponse } from 'next/server';

import { getServerByApiKey } from '@/lib/gameAdmin';
import { resolveReportServerContext } from '@/lib/reportServerContext';
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

export async function GET(req: Request) {
    const access = await requireReportApiAccess(req);
    if ('error' in access) return access.error;

    const { searchParams } = new URL(req.url);
    const status = trimString(searchParams.get('status'), 20).toUpperCase();
    const target = trimString(searchParams.get('target') ?? searchParams.get('reportedRobloxUsername'), 120);
    const reporter = trimString(searchParams.get('reporter') ?? searchParams.get('reporterDiscordId'), 120);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);

    let query = getSupabaseAdmin()
        .from('reports')
        .select('*')
        .eq('server_id', access.server.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status && status !== 'ALL') {
        if (!VALID_REPORT_STATUSES.has(status)) {
            return NextResponse.json({ error: 'Invalid report status' }, { status: 400 });
        }
        query = query.eq('status', status);
    }

    if (target) {
        query = query.ilike('reported_roblox_username', target.includes('%') ? target : `%${target}%`);
    }

    if (reporter) {
        query = query.eq('reporter_discord_id', reporter);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
        {
            serverId: access.server.id,
            reports: data || [],
        },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        },
    );
}

export async function POST(req: Request) {
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const access = await requireReportApiAccess(req, body.apiKey ?? body.key ?? body.serverKey ?? body.securityKey);
    if ('error' in access) return access.error;

    const reporterDiscordId = trimString(body.reporterDiscordId ?? body.reporter_discord_id ?? body.discordId, 120);
    const reporterRobloxUsername = trimString(body.reporterRobloxUsername ?? body.reporter_roblox_username, 120) || null;
    const reporterLiveServerId = trimString(body.reporterLiveServerId ?? body.reporter_live_server_id ?? body.jobId ?? body.job_id, 200);
    const reportedRobloxUsername = trimString(body.reportedRobloxUsername ?? body.reported_roblox_username ?? body.target, 120);
    const reason = trimString(body.reason ?? body.message, 2000);

    if (!reportedRobloxUsername || !reason) {
        return NextResponse.json({ error: 'reportedRobloxUsername and reason are required.' }, { status: 400 });
    }

    const liveServerContext = await resolveReportServerContext({
        serverId: access.server.id,
        placeId: access.server.place_id,
        reporterDiscordId,
        reporterRobloxUsername,
        reporterLiveServerId,
        reportedRobloxUsername,
    });

    const { data, error } = await getSupabaseAdmin()
        .from('reports')
        .insert({
            server_id: access.server.id,
            reporter_discord_id: reporterDiscordId || 'rolink-module',
            reporter_roblox_username: reporterRobloxUsername,
            reported_roblox_username: reportedRobloxUsername,
            reason,
            status: 'PENDING',
            ...liveServerContext,
        })
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ serverId: access.server.id, report: data }, { status: 201 });
}
