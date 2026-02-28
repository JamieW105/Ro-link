import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/verify?error=unauthorized`);
    }

    if (!code) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/verify?error=no_code`);
    }

    try {
        const clientId = process.env.ROBLOX_CLIENT_ID;
        const clientSecret = process.env.ROBLOX_CLIENT_SECRET;
        const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/roblox/callback`;

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

        // 3. Store in Database
        const { error: dbError } = await supabase
            .from('verified_users')
            .upsert({
                discord_id: (session.user as any).id,
                roblox_id: robloxId,
                roblox_username: robloxUsername,
                updated_at: new Date()
            });

        if (dbError) throw dbError;

        // 4. Update roles for existing servers
        const discordToken = process.env.DISCORD_TOKEN;
        const accessToken = (session as any).accessToken;
        const discordId = (session.user as any).id;

        if (accessToken && discordToken && discordId) {
            try {
                // Fetch user's guilds
                const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (guildsRes.ok) {
                    const userGuilds = await guildsRes.json();
                    const userGuildIds = userGuilds.map((g: any) => g.id);

                    if (userGuildIds.length > 0) {
                        // Find matching servers in our DB that have verified_role or nick_template set
                        const { data: dbServers } = await supabase
                            .from('servers')
                            .select('id, verified_role, nick_template')
                            .in('id', userGuildIds);

                        if (dbServers && dbServers.length > 0) {
                            for (const server of dbServers) {
                                if (!server.verified_role && !server.nick_template) continue;

                                // Fetch the Discord member object first to get their username for the template
                                let memberData: any = null;
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

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/verify?success=true`);

    } catch (err: any) {
        console.error('[ROBLOX CALLBACK] Error:', err);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/verify?error=callback_failed`);
    }
}
