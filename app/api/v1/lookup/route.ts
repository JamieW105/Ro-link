import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';
import { readServerApiKey } from '@/lib/serverApiKey';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const robloxUserId = searchParams.get('robloxId');
    const robloxUsername = searchParams.get('robloxUsername');
    const discordId = searchParams.get('discordId');

    // Heartbeat check for uptime monitors. Do not use the user agent as an
    // authorization bypass for lookups.
    if ((!robloxUserId && !robloxUsername && !discordId) || searchParams.get('status') === 'check') {
        return NextResponse.json({
            status: 'API Active',
            message: 'Ready for bidirectional mapping'
        }, { status: 200 });
    }

    const apiKey = readServerApiKey(req);
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const server = await findServerByKeyWithDiagnostics<{ id: string }>('id', apiKey);
    if (!server.server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    try {
        if (robloxUserId || robloxUsername) {
            let query = supabase.from('verified_users').select('discord_id, roblox_id, roblox_username');

            if (robloxUserId) {
                query = query.eq('roblox_id', robloxUserId);
            } else {
                query = query.ilike('roblox_username', robloxUsername as string);
            }

            const { data, error } = await query.maybeSingle();

            if (error) throw error;
            if (!data) return NextResponse.json({ verified: false, error: 'User not found' }, { status: 404 });

            return NextResponse.json({
                verified: true,
                discordId: data.discord_id,
                robloxId: data.roblox_id,
                robloxUsername: data.roblox_username
            });
        }

        if (discordId) {
            // Find Roblox via Discord
            const { data, error } = await supabase
                .from('verified_users')
                .select('discord_id, roblox_id, roblox_username')
                .eq('discord_id', discordId)
                .maybeSingle();

            if (error) throw error;
            if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });

            return NextResponse.json({
                discordId: data.discord_id,
                robloxId: data.roblox_id,
                robloxUsername: data.roblox_username
            });
        }

        return NextResponse.json({
            status: 'API Active',
            message: 'Ready for bidirectional mapping'
        }, { status: 200 });

    } catch (err: any) {
        console.error('[LOOKUP API] Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
