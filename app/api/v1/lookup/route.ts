import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const robloxUserId = searchParams.get('robloxId');
    const robloxUsername = searchParams.get('robloxUsername');
    const discordId = searchParams.get('discordId');

    // Heartbeat check for uptime monitors
    if (!robloxUserId && !robloxUsername && !discordId || searchParams.get('status') === 'check' || req.headers.get('user-agent')?.includes('Better Uptime')) {
        return NextResponse.json({
            status: 'API Active',
            message: 'Ready for bidirectional mapping'
        }, { status: 200 });
    }

    try {
        if (robloxUserId || robloxUsername) {
            let query = supabase.from('verified_users').select('*');

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
                .select('*')
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
