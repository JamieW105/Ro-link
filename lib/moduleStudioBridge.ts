import { createHmac, randomBytes, randomUUID } from 'crypto';

import { getOwnedModule } from '@/lib/moduleIde';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const MODULE_STUDIO_PROTOCOL_VERSION = 2;
const PAIRING_TTL_MS = 10 * 60 * 1000;
const STUDIO_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_EVENT_BYTES = 512 * 1024;
const MAX_EVENT_BATCH = 100;

export const STUDIO_MESSAGE_TYPES = new Set([
    'studio.connected',
    'studio.disconnected',
    'tree.snapshot',
    'tree.children',
    'tree.instanceCreated',
    'tree.instanceDeleted',
    'tree.instanceMoved',
    'tree.instanceRenamed',
    'ui.rename',
    'ui.renamed',
    'ui.import',
    'ui.importResult',
    'module.saved',
    'module.updated',
    'sync.error',
]);

export interface StudioBridgeEventInput {
    type: string;
    requestId?: string;
    revision?: string;
    payload?: Record<string, unknown>;
}

interface PluginSessionIdentity {
    id: string;
    discord_user_id?: string | null;
}

function bridgeSecret() {
    const configured = process.env.MODULE_STUDIO_BRIDGE_SECRET
        || process.env.AUTH_SECRET
        || process.env.NEXTAUTH_SECRET;
    if (configured) return configured;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('MODULE_STUDIO_BRIDGE_SECRET (or AUTH_SECRET) is required in production.');
    }
    return 'development-module-studio-secret';
}

function digest(value: string) {
    return createHmac('sha256', bridgeSecret()).update(value, 'utf8').digest('hex');
}

function generatePairingCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function generateStudioCredential() {
    return `rst_${randomBytes(32).toString('hex')}`;
}

export async function createModuleStudioPairing(moduleId: string, discordUserId: string) {
    const ownedModule = await getOwnedModule(moduleId, discordUserId);
    if (!ownedModule) return null;
    const client = getSupabaseAdmin();
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    const { data, error } = await client.from('module_studio_pairings').insert({
        module_id: moduleId,
        discord_user_id: discordUserId,
        code_hash: digest(code),
        expires_at: expiresAt,
    }).select('id').single();
    if (error) throw new Error(error.message);

    return {
        pairingId: String((data as { id: string }).id),
        code,
        expiresAt,
        module: { id: ownedModule.id, name: ownedModule.name, version: ownedModule.version },
        protocolVersion: MODULE_STUDIO_PROTOCOL_VERSION,
    };
}

export async function claimModuleStudioPairing(pluginSession: PluginSessionIdentity, input: {
    code: string;
    placeId?: string;
    universeId?: string;
    placeName?: string;
}) {
    const discordUserId = String(pluginSession.discord_user_id || '').trim();
    if (!discordUserId) return null;
    const client = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: pairing, error } = await client
        .from('module_studio_pairings')
        .select('id, module_id, discord_user_id, expires_at, used_at')
        .eq('code_hash', digest(input.code.trim().toUpperCase()))
        .eq('discord_user_id', discordUserId)
        .is('used_at', null)
        .gt('expires_at', now)
        .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pairing) return null;
    const claimedPairing = pairing as { id: string; module_id: string; discord_user_id: string; expires_at: string; used_at?: string | null };

    const ownedModule = await getOwnedModule(claimedPairing.module_id, discordUserId);
    if (!ownedModule) return null;
    const credential = generateStudioCredential();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + STUDIO_SESSION_TTL_MS).toISOString();

    const markUsed = await client
        .from('module_studio_pairings')
        .update({ used_at: now })
        .eq('id', claimedPairing.id)
        .is('used_at', null)
        .select('id')
        .maybeSingle();
    if (markUsed.error) throw new Error(markUsed.error.message);
    if (!markUsed.data) return null;

    const activeSessions = await client
        .from('module_studio_sessions')
        .update({ revoked_at: now })
        .eq('module_id', ownedModule.id)
        .eq('discord_user_id', discordUserId)
        .is('revoked_at', null);
    if (activeSessions.error) throw new Error(activeSessions.error.message);

    const sessionInsert = await client.from('module_studio_sessions').insert({
        id: sessionId,
        module_id: ownedModule.id,
        discord_user_id: discordUserId,
        plugin_session_id: pluginSession.id,
        credential_hash: digest(credential),
        protocol_version: MODULE_STUDIO_PROTOCOL_VERSION,
        place_id: String(input.placeId || '').slice(0, 40),
        universe_id: String(input.universeId || '').slice(0, 40),
        place_name: String(input.placeName || '').slice(0, 120),
        expires_at: expiresAt,
    });
    if (sessionInsert.error) throw new Error(sessionInsert.error.message);

    return {
        sessionId,
        credential,
        expiresAt,
        protocolVersion: MODULE_STUDIO_PROTOCOL_VERSION,
        module: { id: ownedModule.id, name: ownedModule.name, version: ownedModule.version },
    };
}

export async function getStudioBridgeSessionByCredential(credential: string) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('module_studio_sessions')
        .select('*')
        .eq('credential_hash', digest(credential))
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
}

export async function getActiveBrowserStudioSession(moduleId: string, discordUserId: string) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('module_studio_sessions')
        .select('id, module_id, discord_user_id, protocol_version, place_id, universe_id, place_name, connected_at, last_seen_at, expires_at')
        .eq('module_id', moduleId)
        .eq('discord_user_id', discordUserId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
}

export function validateBridgeEvent(input: unknown): StudioBridgeEventInput {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Event must be an object.');
    const raw = input as Record<string, unknown>;
    const type = String(raw.type || '');
    if (!STUDIO_MESSAGE_TYPES.has(type)) throw new Error('Unsupported Studio event type.');
    const payload = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? raw.payload as Record<string, unknown>
        : {};
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_EVENT_BYTES) throw new Error('Studio event payload is too large.');
    return {
        type,
        requestId: raw.requestId ? String(raw.requestId).slice(0, 100) : undefined,
        revision: raw.revision ? String(raw.revision).slice(0, 128) : undefined,
        payload,
    };
}

export async function enqueueStudioBridgeEvents(sessionId: string, direction: 'to_browser' | 'to_studio', events: unknown[]) {
    const client = getSupabaseAdmin();
    if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENT_BATCH) {
        throw new Error(`Event batches must contain 1-${MAX_EVENT_BATCH} events.`);
    }
    const rows = events.map((event) => {
        const validated = validateBridgeEvent(event);
        return {
            session_id: sessionId,
            direction,
            message_type: validated.type,
            request_id: validated.requestId || null,
            revision: validated.revision || null,
            payload: validated.payload || {},
        };
    });
    const { data, error } = await client.from('module_studio_events').insert(rows).select('id');
    if (error) throw new Error(error.message);
    return ((data || []) as Array<{ id: number }>).map((row) => Number(row.id));
}

export async function pollStudioBridgeEvents(sessionId: string, direction: 'to_browser' | 'to_studio', cursor: number) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('module_studio_events')
        .select('id, message_type, request_id, revision, payload, created_at')
        .eq('session_id', sessionId)
        .eq('direction', direction)
        .gt('id', Math.max(0, cursor || 0))
        .order('id')
        .limit(MAX_EVENT_BATCH);
    if (error) throw new Error(error.message);
    const events = ((data || []) as Array<{
        id: number;
        message_type: string;
        request_id?: string | null;
        revision?: string | null;
        payload?: Record<string, unknown> | null;
        created_at: string;
    }>).map((row) => ({
        id: Number(row.id),
        protocolVersion: MODULE_STUDIO_PROTOCOL_VERSION,
        type: String(row.message_type),
        requestId: row.request_id || undefined,
        revision: row.revision || undefined,
        timestamp: row.created_at,
        payload: row.payload || {},
    }));
    return { events, cursor: events.at(-1)?.id || Math.max(0, cursor || 0) };
}

export async function touchStudioBridgeSession(sessionId: string) {
    const client = getSupabaseAdmin();
    const { error } = await client.from('module_studio_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', sessionId);
    if (error) throw new Error(error.message);
}

export async function revokeStudioBridgeSession(sessionId: string, discordUserId?: string) {
    const client = getSupabaseAdmin();
    let query = client.from('module_studio_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId);
    if (discordUserId) query = query.eq('discord_user_id', discordUserId);
    const { error } = await query;
    if (error) throw new Error(error.message);
}

export function readBearerToken(req: Request) {
    const authorization = req.headers.get('authorization') || '';
    return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}
