import { timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { DGSU_BAN_ERROR_MESSAGE } from '@/lib/dgsuBanConstants';
import { banUserForDgsuAssociation, findDgsuBanForUser } from '@/lib/dgsuBans';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type SessionWithAccessToken = Session & {
    accessToken?: string;
    user?: Session['user'] & { id?: string };
};

type DiscordGuildSummary = {
    id?: string;
};

type DiscordMemberPayload = {
    user?: {
        username?: string;
    };
};

function buildBaseUrl() {
    return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

function normalizeReturnTo(value: unknown) {
    const returnTo = typeof value === 'string' ? value : '';
    if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
        return '/verify';
    }

    return returnTo.slice(0, 200);
}

const OAUTH_STATE_COOKIE = '__Host-rolink-roblox-oauth';

function stateMatches(received: string, expected: string) {
    const receivedBytes = Buffer.from(received);
    const expectedBytes = Buffer.from(expected);
    return receivedBytes.length === expectedBytes.length
        && timingSafeEqual(receivedBytes, expectedBytes);
}

function buildRedirectUrl(path: string, params?: Record<string, string>) {
    const url = new URL(normalizeReturnTo(path), buildBaseUrl());
    for (const [key, value] of Object.entries(params || {})) {
        url.searchParams.set(key, value);
    }

    return url.toString();
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const receivedState = searchParams.get('state') || '';
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
    cookieStore.delete(OAUTH_STATE_COOKIE);
    let returnTo = '/verify';
    let stateIsValid = false;
    try {
        const stored = JSON.parse(stateCookie || '') as { state?: unknown; returnTo?: unknown };
        const expectedState = typeof stored.state === 'string' ? stored.state : '';
        stateIsValid = Boolean(expectedState && receivedState && stateMatches(receivedState, expectedState));
        returnTo = normalizeReturnTo(stored.returnTo);
    } catch {
        stateIsValid = false;
    }

    if (!stateIsValid) {
        return NextResponse.redirect(buildRedirectUrl('/verify', { error: 'invalid_state' }));
    }
    const session = await getServerSession(authOptions) as SessionWithAccessToken | null;

    if (!session || !session.user) {
        return NextResponse.redirect(buildRedirectUrl(returnTo, { error: 'unauthorized' }));
    }

    if (!code) {
        return NextResponse.redirect(buildRedirectUrl(returnTo, { error: 'no_code' }));
    }

    try {
        const db = getSupabaseAdmin();
        const clientId = process.env.ROBLOX_CLIENT_ID;
        const clientSecret = process.env.ROBLOX_CLIENT_SECRET;
        const redirectUri = `${buildBaseUrl()}/api/roblox/callback`;

        // 1. Exchange code for token
        const tokenRes = await fetch('https://apis.roblox.com/oauth/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId!,
                client_secret: clientSecret!,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.error('[ROBLOX OAUTH] Token error:', tokenData);
            throw new Error('Failed to get access token');
        }

        // 2. Get User Info
        const userRes = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userRes.json();
        const robloxId = userData.sub;
        const robloxUsername = userData.preferred_username || userData.nickname || userData.name;
        const discordId = session.user?.id || '';

        // Keep the verified identity on record even when either side is banned.
        // The account remains restricted, but the appeal form can prove the
        // Roblox identity and show only moderation owned by this user.
        const { error: identityError } = await db
            .from('verified_users')
            .upsert({
                discord_id: discordId,
                roblox_id: robloxId,
                roblox_username: robloxUsername,
                updated_at: new Date()
            });
        if (identityError) throw identityError;

        const dgsuBan = await findDgsuBanForUser(db, {
            discordUserId: discordId,
            robloxUserId: robloxId,
        });
        if (dgsuBan) {
            await banUserForDgsuAssociation(db, {
                discordUserId: discordId,
                robloxUserId: robloxId,
                sourceBan: dgsuBan,
                reason: 'Automatically banned after linking a Roblox account associated with an existing DGSU ban.',
                metadata: {
                    trigger: 'roblox_account_link',
                    robloxUsername,
                },
            });

            console.warn('[ROBLOX OAUTH] DGSU banned Roblox account linked to Discord account', {
                discordId,
                robloxId,
                banTargetType: dgsuBan.target_type,
                banTargetId: dgsuBan.target_id,
            });

            return NextResponse.redirect(buildRedirectUrl(returnTo, {
                error: 'dgsu_ban',
                message: DGSU_BAN_ERROR_MESSAGE,
            }));
        }

        // 3. Update roles for existing servers
        const discordToken = process.env.DISCORD_TOKEN;
        const accessToken = session.accessToken;

        if (accessToken && discordToken && discordId) {
            try {
                // Fetch user's guilds
                const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (guildsRes.ok) {
                    const userGuilds = await guildsRes.json() as DiscordGuildSummary[];
                    const userGuildIds = userGuilds
                        .map((guild) => guild.id)
                        .filter((guildId): guildId is string => Boolean(guildId));

                    if (userGuildIds.length > 0) {
                        // Find matching servers in our DB that have verified_role or nick_template set
                        const { data: dbServers } = await db
                            .from('servers')
                            .select('id, verified_role, nick_template')
                            .in('id', userGuildIds);

                        if (dbServers && dbServers.length > 0) {
                            for (const server of dbServers) {
                                if (!server.verified_role && !server.nick_template) continue;

                                // Fetch the Discord member object first to get their username for the template
                                let memberData: DiscordMemberPayload | null = null;
                                if (server.nick_template) {
                                    const memberRes = await fetch(`https://discord.com/api/v10/guilds/${server.id}/members/${discordId}`, {
                                        headers: { Authorization: `Bot ${discordToken}` }
                                    });
                                    if (memberRes.ok) {
                                        memberData = await memberRes.json();
                                    }
                                }

                                if (server.verified_role) {
                                    await fetch(`https://discord.com/api/v10/guilds/${server.id}/members/${discordId}/roles/${server.verified_role}`, {
                                        method: 'PUT',
                                        headers: { Authorization: `Bot ${discordToken}` },
                                    }).catch(() => { });
                                }

                                if (server.nick_template && memberData) {
                                    const username = memberData.user?.username || session.user?.name || 'User';
                                    const nick = server.nick_template
                                        .replace(/{roblox_username}/g, robloxUsername)
                                        .replace(/{roblox_id}/g, robloxId)
                                        .replace(/{discord_name}/g, username)
                                        .substring(0, 32);

                                    await fetch(`https://discord.com/api/v10/guilds/${server.id}/members/${discordId}`, {
                                        method: 'PATCH',
                                        headers: {
                                            Authorization: `Bot ${discordToken}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({ nick })
                                    }).catch(() => { });
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('[ROBLOX OAUTH] Failed to auto-role user:', err);
            }
        }

        return NextResponse.redirect(buildRedirectUrl(returnTo, { success: 'true' }));

    } catch (err: unknown) {
        console.error('[ROBLOX CALLBACK] Error:', err);
        return NextResponse.redirect(buildRedirectUrl(returnTo, { error: 'callback_failed' }));
    }
}
