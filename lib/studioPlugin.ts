import { randomBytes, randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';

import { resolveDashboardUserPermissions } from './gameAdmin';
import { DiscordAccessTokenError, hasDiscordGuildManagePermission, listVisibleGuildsForDiscordSession } from './dashboardGuilds';
import { supabase } from './supabase';

const PLUGIN_SESSION_TTL_MS = 60 * 60 * 1000;
const PLUGIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

const supabaseParams = {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
};

export class StudioPluginError extends Error {
    status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = 'StudioPluginError';
        this.status = status;
    }
}

interface StudioPluginSessionRecord {
    id: string;
    code: string;
    status: string;
    discord_user_id?: string | null;
    discord_username?: string | null;
    discord_access_token?: string | null;
    plugin_token?: string | null;
    expires_at: string;
    token_expires_at?: string | null;
    authorized_at?: string | null;
}

interface ServerSetupRecord {
    id: string;
    place_id?: string | null;
    universe_id?: string | null;
    open_cloud_key?: string | null;
    api_key?: string | null;
}

interface VerifiedUserRecord {
    discord_id: string;
    roblox_id: string;
    roblox_username: string;
}

interface DiscordTokenState {
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
}

export interface StudioPluginServerSummary {
    id: string;
    name: string;
    icon?: string | null;
    iconUrl: string | null;
    owner: boolean;
    hasBot: boolean;
    placeId: string;
    universeId: string;
    hasOpenCloudKey: boolean;
    hasApiKey: boolean;
    isConfigured: boolean;
    setupUrl: string;
}

export interface StudioPluginServerListPayload {
    user: {
        discordUserId: string;
        discordUsername: string;
        robloxLinked: boolean;
        robloxId: string | null;
        robloxUsername: string | null;
        verifyUrl: string;
    };
    servers: StudioPluginServerSummary[];
}

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && serviceKey) {
        return createClient(url, serviceKey, supabaseParams);
    }

    return supabase;
}

export function buildPublicBaseUrl(req?: Request) {
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
    }

    if (!req) {
        return 'http://localhost:3000';
    }

    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    return `${protocol}://${host}`.replace(/\/+$/, '');
}

function generatePluginCode() {
    return randomBytes(4).toString('hex').slice(0, 8).toUpperCase();
}

function generatePluginToken() {
    return `rplg_${randomBytes(24).toString('hex')}`;
}

function generateServerApiKey() {
    return `rl_${randomBytes(24).toString('hex')}`;
}

function buildDiscordIconUrl(serverId: string, icon?: string | null) {
    if (!icon) {
        return null;
    }

    return `https://cdn.discordapp.com/icons/${serverId}/${icon}.png?size=128`;
}

function getBearerToken(req: Request) {
    const header = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!header || !header.startsWith('Bearer ')) {
        return null;
    }

    return header.slice('Bearer '.length).trim();
}

function parseDiscordTokenState(serialized: string | null | undefined): DiscordTokenState | null {
    const value = typeof serialized === 'string' ? serialized.trim() : '';
    if (!value) {
        return null;
    }

    if (!value.startsWith('{')) {
        return { accessToken: value };
    }

    try {
        const parsed = JSON.parse(value) as Partial<DiscordTokenState>;
        if (typeof parsed.accessToken !== 'string' || parsed.accessToken.trim() === '') {
            return null;
        }

        return {
            accessToken: parsed.accessToken,
            refreshToken: typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim() !== '' ? parsed.refreshToken : undefined,
            accessTokenExpiresAt: typeof parsed.accessTokenExpiresAt === 'number' ? parsed.accessTokenExpiresAt : undefined,
        };
    } catch {
        return { accessToken: value };
    }
}

function serializeDiscordTokenState(tokenState: DiscordTokenState) {
    return JSON.stringify(tokenState);
}

function isDiscordTokenExpired(tokenState: DiscordTokenState) {
    return typeof tokenState.accessTokenExpiresAt === 'number'
        && Date.now() >= tokenState.accessTokenExpiresAt - 60_000;
}

async function refreshDiscordTokenState(tokenState: DiscordTokenState) {
    if (!tokenState.refreshToken) {
        throw new StudioPluginError('Discord sign-in expired. Sign in with Discord again to reconnect Studio.', 401);
    }

    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID || '',
            client_secret: process.env.DISCORD_CLIENT_SECRET || '',
            grant_type: 'refresh_token',
            refresh_token: tokenState.refreshToken,
        }),
        cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({})) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
    };

    if (!response.ok || !payload.access_token) {
        if (response.status === 400 || response.status === 401) {
            throw new StudioPluginError('Discord sign-in expired. Sign in with Discord again to reconnect Studio.', 401);
        }

        throw new StudioPluginError(
            payload.error_description || payload.error || 'Failed to refresh the Discord access token for the Studio plugin.',
            500,
        );
    }

    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || tokenState.refreshToken,
        accessTokenExpiresAt: Date.now() + Number(payload.expires_in || 0) * 1000,
    } satisfies DiscordTokenState;
}

async function saveDiscordTokenState(sessionId: string, tokenState: DiscordTokenState) {
    const client = getSupabaseAdmin();
    const { error } = await client
        .from('studio_plugin_sessions')
        .update({
            discord_access_token: serializeDiscordTokenState(tokenState),
        })
        .eq('id', sessionId);

    if (error) {
        throw new StudioPluginError(`Failed to update the Studio plugin Discord token. ${error.message}`, 500);
    }
}

async function getPluginSessionByIdAndCode(sessionId: string, code: string) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('studio_plugin_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('code', code)
        .maybeSingle<StudioPluginSessionRecord>();

    if (error) {
        throw new StudioPluginError(`Failed to load Studio plugin session. ${error.message}`, 500);
    }

    if (!data) {
        return null;
    }

    if (new Date(data.expires_at).getTime() <= Date.now()) {
        return null;
    }

    return data;
}

async function getPluginSessionById(sessionId: string) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('studio_plugin_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle<StudioPluginSessionRecord>();

    if (error) {
        throw new StudioPluginError(`Failed to load Studio plugin session by id. ${error.message}`, 500);
    }

    return data;
}

async function getPluginSessionByToken(pluginToken: string) {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('studio_plugin_sessions')
        .select('*')
        .eq('plugin_token', pluginToken)
        .maybeSingle<StudioPluginSessionRecord>();

    if (error) {
        throw new StudioPluginError(`Failed to load Studio plugin token. ${error.message}`, 500);
    }

    if (!data || !data.token_expires_at) {
        return null;
    }

    if (new Date(data.token_expires_at).getTime() <= Date.now()) {
        return null;
    }

    return data;
}

async function getManageableGuildsForPlugin(session: StudioPluginSessionRecord) {
    if (!session.discord_access_token || !session.discord_user_id) {
        throw new StudioPluginError('Studio plugin is missing Discord auth. Reconnect the plugin.', 401);
    }

    let tokenState = parseDiscordTokenState(session.discord_access_token);
    if (!tokenState?.accessToken) {
        throw new StudioPluginError('Studio plugin is missing Discord auth. Reconnect the plugin.', 401);
    }

    if (isDiscordTokenExpired(tokenState)) {
        tokenState = await refreshDiscordTokenState(tokenState);
        await saveDiscordTokenState(session.id, tokenState);
    }

    let visibleGuilds;
    try {
        visibleGuilds = await listVisibleGuildsForDiscordSession(tokenState.accessToken, session.discord_user_id);
    } catch (error) {
        if (error instanceof DiscordAccessTokenError) {
            tokenState = await refreshDiscordTokenState(tokenState);
            await saveDiscordTokenState(session.id, tokenState);
            visibleGuilds = await listVisibleGuildsForDiscordSession(tokenState.accessToken, session.discord_user_id);
        } else {
            throw error;
        }
    }

    const botGuilds = visibleGuilds.filter((guild) => guild.hasBot);

    const checks = botGuilds.map(async (guild) => {
        if (hasDiscordGuildManagePermission(guild.permissions, guild.owner)) {
            return guild;
        }

        try {
            const permissions = await resolveDashboardUserPermissions(guild.id, session.discord_user_id!);
            if (permissions.is_admin || permissions.can_manage_settings) {
                return guild;
            }
        } catch {
            return null;
        }

        return null;
    });

    return (await Promise.all(checks)).filter((guild): guild is NonNullable<typeof guild> => Boolean(guild));
}

export async function createStudioPluginSession(req: Request) {
    const client = getSupabaseAdmin();
    const id = randomUUID();
    const code = generatePluginCode();
    const expiresAt = new Date(Date.now() + PLUGIN_SESSION_TTL_MS).toISOString();
    const baseUrl = buildPublicBaseUrl(req);

    const { error } = await client.from('studio_plugin_sessions').insert([{
        id,
        code,
        status: 'PENDING',
        expires_at: expiresAt,
    }]);

    if (error) {
        throw new Error(error.message);
    }

    return {
        sessionId: id,
        code,
        status: 'pending',
        expiresAt,
        authorizeUrl: `${baseUrl}/plugin/connect?sessionId=${encodeURIComponent(id)}&code=${encodeURIComponent(code)}`,
        pollAfterMs: 2500,
    };
}

export async function authorizeStudioPluginSession(sessionId: string, code: string, discordUserId: string, discordUsername: string, discordTokenState: DiscordTokenState) {
    const client = getSupabaseAdmin();
    const existing = await getPluginSessionByIdAndCode(sessionId, code);

    if (!existing) {
        throw new StudioPluginError('Plugin session was not found or expired.', 404);
    }

    const pluginToken = existing.plugin_token || generatePluginToken();
    const tokenExpiresAt = new Date(Date.now() + PLUGIN_TOKEN_TTL_MS).toISOString();

    const { error } = await client
        .from('studio_plugin_sessions')
        .update({
            status: 'AUTHORIZED',
            discord_user_id: discordUserId,
            discord_username: discordUsername,
            discord_access_token: serializeDiscordTokenState(discordTokenState),
            plugin_token: pluginToken,
            authorized_at: new Date().toISOString(),
            token_expires_at: tokenExpiresAt,
        })
        .eq('id', existing.id);

    if (error) {
        throw new StudioPluginError(`Failed to authorize Studio plugin session. ${error.message}`, 500);
    }

    return {
        pluginToken,
        tokenExpiresAt,
    };
}

export async function getStudioPluginSessionStatus(sessionId: string, code: string) {
    const session = await getPluginSessionById(sessionId);

    if (!session) {
        return {
            found: false,
            reason: 'missing',
        } as const;
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
        return {
            found: false,
            reason: 'expired',
        } as const;
    }

    if (session.code !== code) {
        return {
            found: false,
            reason: 'code_mismatch',
        } as const;
    }

    return {
        found: true,
        status: session.status === 'AUTHORIZED' && session.plugin_token ? 'authorized' : 'pending',
        expiresAt: session.expires_at,
        pluginToken: session.plugin_token || null,
        tokenExpiresAt: session.token_expires_at || null,
        discordUsername: session.discord_username || null,
    } as const;
}

export async function requireAuthorizedStudioPluginSession(req: Request) {
    const token = getBearerToken(req);
    if (!token) {
        return null;
    }

    return getPluginSessionByToken(token);
}

export async function getStudioPluginServers(req: Request, session: StudioPluginSessionRecord): Promise<StudioPluginServerListPayload> {
    const client = getSupabaseAdmin();
    const baseUrl = buildPublicBaseUrl(req);
    const manageableGuilds = await getManageableGuildsForPlugin(session);
    const guildIds = manageableGuilds.map((guild) => guild.id);

    const [{ data: serverRows, error: serverRowsError }, { data: verifiedUser, error: verifiedUserError }] = await Promise.all([
        guildIds.length > 0
            ? client.from('servers').select('id, place_id, universe_id, open_cloud_key, api_key').in('id', guildIds)
            : Promise.resolve({ data: [] as ServerSetupRecord[], error: null }),
        client.from('verified_users').select('discord_id, roblox_id, roblox_username').eq('discord_id', session.discord_user_id).maybeSingle<VerifiedUserRecord>(),
    ]);

    if (serverRowsError) {
        console.warn('[PLUGIN][SERVERS] Failed to load stored server setup rows. Continuing with defaults.', {
            sessionId: session.id,
            discordUserId: session.discord_user_id || null,
            error: serverRowsError.message,
        });
    }

    if (verifiedUserError) {
        console.warn('[PLUGIN][SERVERS] Failed to load verified Roblox account. Continuing as unlinked.', {
            sessionId: session.id,
            discordUserId: session.discord_user_id || null,
            error: verifiedUserError.message,
        });
    }

    const serversById = new Map(((serverRows || []) as ServerSetupRecord[]).map((row) => [row.id, row]));

    const servers = manageableGuilds.map((guild) => {
        const setup = serversById.get(guild.id);
        const placeId = typeof setup?.place_id === 'string' ? setup.place_id : '';
        const universeId = typeof setup?.universe_id === 'string' ? setup.universe_id : '';
        const hasOpenCloudKey = Boolean(setup?.open_cloud_key?.trim());
        const hasApiKey = Boolean(setup?.api_key?.trim());

        return {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            iconUrl: buildDiscordIconUrl(guild.id, guild.icon),
            owner: Boolean(guild.owner),
            hasBot: guild.hasBot,
            placeId,
            universeId,
            hasOpenCloudKey,
            hasApiKey,
            isConfigured: Boolean(placeId && universeId && hasOpenCloudKey && hasApiKey),
            setupUrl: `${baseUrl}/dashboard/${guild.id}/settings/setup`,
        } satisfies StudioPluginServerSummary;
    }).sort((left, right) => left.name.localeCompare(right.name));

    return {
        user: {
            discordUserId: session.discord_user_id || '',
            discordUsername: session.discord_username || 'Unknown User',
            robloxLinked: !verifiedUserError && Boolean(verifiedUser),
            robloxId: verifiedUserError ? null : verifiedUser?.roblox_id || null,
            robloxUsername: verifiedUserError ? null : verifiedUser?.roblox_username || null,
            verifyUrl: `${baseUrl}/verify`,
        },
        servers,
    };
}

export async function installStudioPluginServer(req: Request, session: StudioPluginSessionRecord, input: {
    serverId: string;
    placeId: string;
    universeId: string;
    openCloudKey?: string;
}) {
    const client = getSupabaseAdmin();
    const baseUrl = buildPublicBaseUrl(req);
    const manageableGuilds = await getManageableGuildsForPlugin(session);
    const selectedGuild = manageableGuilds.find((guild) => guild.id === input.serverId);

    if (!selectedGuild) {
        throw new Error('You do not have permission to configure that Ro-Link server.');
    }

    const { data: existing } = await client
        .from('servers')
        .select('id, place_id, universe_id, open_cloud_key, api_key')
        .eq('id', input.serverId)
        .maybeSingle<ServerSetupRecord>();

    const resolvedOpenCloudKey = (input.openCloudKey || existing?.open_cloud_key || '').trim();
    if (!resolvedOpenCloudKey) {
        return {
            ok: false,
            status: 412,
            error: 'This server still needs an Open Cloud API key before the plugin can finish setup.',
            missingBasics: ['open_cloud_key'],
            setupUrl: `${baseUrl}/dashboard/${input.serverId}/settings/setup`,
        } as const;
    }

    const apiKey = existing?.api_key?.trim() || generateServerApiKey();

    const { error } = await client
        .from('servers')
        .upsert({
            id: input.serverId,
            place_id: input.placeId.trim(),
            universe_id: input.universeId.trim(),
            open_cloud_key: resolvedOpenCloudKey,
            api_key: apiKey,
        });

    if (error) {
        throw new Error(error.message);
    }

    return {
        ok: true,
        apiBaseUrl: baseUrl,
        apiKey,
        serverId: input.serverId,
        serverName: selectedGuild.name,
        placeId: input.placeId.trim(),
        universeId: input.universeId.trim(),
    } as const;
}
