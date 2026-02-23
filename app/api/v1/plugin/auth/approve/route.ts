import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pluginStore } from '../../store';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { sessionId } = await request.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const sessionStore = pluginStore.sessions.get(sessionId);
        if (!sessionStore) {
            return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
        }

        // 1. Check if the user is actually logged into Ro-Link via Discord
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'You must be logged into Ro-Link.' }, { status: 401 });
        }
        const discordId = (session.user as any).id;

        // 2. Check if they have linked their Roblox account in `verified_users`
        const { data: verifiedUser, error: verifiedError } = await supabase
            .from('verified_users')
            .select('roblox_id, roblox_username')
            .eq('discord_id', discordId)
            .single();

        if (verifiedError || !verifiedUser) {
            return NextResponse.json({ error: 'You are not verified with Ro-Link. Please link your Roblox account first.' }, { status: 403 });
        }

        // 3. Ensure the Roblox account they linked MATCHES the Studio account requesting access
        if (verifiedUser.roblox_id.toString() !== sessionStore.studio_user_id.toString()) {
            return NextResponse.json({
                error: `Plugin is mapped to Studio User ID ${sessionStore.studio_user_id}, but your Ro-Link account is verified as ${verifiedUser.roblox_username} (${verifiedUser.roblox_id}).`
            }, { status: 403 });
        }

        // 4. Check for 'Plugin access' permission in their role
        // Assuming your 'management_users' table assigns roles that contain specific permissions
        const { data: mgmtUser } = await supabase
            .from('management_users')
            .select('role_id, management_roles(permissions)')
            .eq('discord_id', discordId)
            .single();

        // Check if there is a role and if that role mentions plugin access or is a super admin
        let hasPluginAccess = false;
        if (mgmtUser?.management_roles) {
            const roles = Array.isArray(mgmtUser.management_roles)
                ? mgmtUser.management_roles[0]
                : mgmtUser.management_roles;
            const perms = (roles as any)?.permissions || [];
            hasPluginAccess = perms.some((p: string) => p === 'PLUGIN_ACCESS' || p === 'MANAGE_RO_LINK' || p === 'RO_LINK_DASHBOARD');
        }

        if (!hasPluginAccess) {
            return NextResponse.json({ error: 'You do not have the required "Plugin access" role permission.' }, { status: 403 });
        }

        // 5. Success! Issue durable token
        const durableToken = crypto.randomUUID();

        // Update session Memory
        pluginStore.sessions.set(sessionId, {
            ...sessionStore,
            status: 'approved',
            token: durableToken
        });

        // Store Token memory
        pluginStore.tokens.set(durableToken, {
            status: 'approved'
        });

        return NextResponse.json({ success: true, token: durableToken });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function OPTIONS(request: Request) {
    return NextResponse.json({}, { headers: { 'Allow': 'POST, OPTIONS' } });
}
