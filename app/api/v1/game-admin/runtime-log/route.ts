import { NextResponse } from 'next/server';

import { DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from '@/lib/dgsuBanConstants';
import { getServerByApiKey, isDgsuGameAdminAccessError } from '@/lib/gameAdmin';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const MAX_BATCH_SIZE = 40;
const MAX_MESSAGE_LENGTH = 800;
const MAX_EVENT_TYPE_LENGTH = 80;
const MAX_METADATA_KEYS = 16;
const MAX_METADATA_VALUE_LENGTH = 240;
const LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const SOURCES = new Set(['server', 'client']);

function trim(value: unknown, maxLength = Number.MAX_SAFE_INTEGER) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function sanitizeMetadata(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value)
            .slice(0, MAX_METADATA_KEYS)
            .map(([key, entry]) => [trim(key, 64), trim(entry, MAX_METADATA_VALUE_LENGTH)])
            .filter(([key]) => Boolean(key)),
    );
}

function normalizeEvent(raw: unknown, defaults: Record<string, unknown>) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }

    const event = raw as Record<string, unknown>;
    const source = trim(event.source || defaults.source, 16).toLowerCase();
    const level = trim(event.level || 'info', 16).toLowerCase();
    const eventType = trim(event.eventType || event.event_type, MAX_EVENT_TYPE_LENGTH);
    const message = trim(event.message, MAX_MESSAGE_LENGTH);
    const jobId = trim(event.jobId || event.job_id || defaults.jobId, 160);

    if (!SOURCES.has(source) || !LEVELS.has(level) || !eventType || !message || !jobId) {
        return null;
    }

    return {
        job_id: jobId,
        place_id: trim(event.placeId || event.place_id || defaults.placeId, 40) || null,
        universe_id: trim(event.universeId || event.universe_id || defaults.universeId, 40) || null,
        source,
        level,
        event_type: eventType,
        roblox_user_id: trim(event.robloxUserId || event.roblox_user_id || event.userId, 40) || null,
        roblox_username: trim(event.robloxUsername || event.roblox_username || event.username, 80) || null,
        display_name: trim(event.displayName || event.display_name, 120) || null,
        message,
        metadata: sanitizeMetadata(event.metadata),
    };
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const auth = readServerApiKeyDetails(req, body.apiKey ?? body.key ?? body.serverKey ?? body.securityKey);
    if (!auth.key) {
        return NextResponse.json({ error: 'Missing API Key', auth: describeServerApiKeyDetails(auth) }, { status: 401 });
    }

    let server;
    try {
        server = await getServerByApiKey(auth.key);
    } catch (error) {
        if (isDgsuGameAdminAccessError(error)) {
            return NextResponse.json({ error: DGSU_BAN_ERROR_MESSAGE, code: 'dgsu_ban' }, { status: DGSU_BAN_ERROR_STATUS });
        }
        throw error;
    }

    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    const rawEvents: unknown[] = Array.isArray(body.events) ? body.events : [body];
    if (rawEvents.length === 0 || rawEvents.length > MAX_BATCH_SIZE) {
        return NextResponse.json({ error: `Send between 1 and ${MAX_BATCH_SIZE} runtime log events.` }, { status: 400 });
    }

    const defaults = {
        source: body.source,
        jobId: body.jobId || body.job_id,
        placeId: body.placeId || body.place_id,
        universeId: body.universeId || body.universe_id,
    };
    const events = rawEvents.map((event: unknown) => normalizeEvent(event, defaults));
    if (events.some((event) => !event)) {
        return NextResponse.json({ error: 'One or more runtime log events are invalid.' }, { status: 400 });
    }

    const rows = events.map((event: ReturnType<typeof normalizeEvent>) => ({ server_id: server.id, ...event! }));
    const { error } = await getSupabaseAdmin().from('runtime_logs').insert(rows);
    if (error) {
        console.error('[RoLinkAPI][RuntimeLog] Insert failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, accepted: rows.length });
}
