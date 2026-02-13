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

        // 4. Update roles for existing servers (Optional: trigger a global role update)
        // For now, it will apply when they join or if they run a command.

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/verify?success=true`);

    } catch (err: any) {
        console.error('[ROBLOX CALLBACK] Error:', err);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/verify?error=callback_failed`);
    }
}
