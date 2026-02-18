import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'BLOCK_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('blocked_servers')
        .select('*')
        .order('blocked_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'BLOCK_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { guildId, reason } = await req.json();

    try {
        // 1. Add to blocked_servers
        const { data, error } = await supabase
            .from('blocked_servers')
            .insert({
                guild_id: guildId,
                reason: reason,
                blocked_by: userId
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Delete server data from 'servers' table (and related data via CASCADE)
        await supabase.from('servers').delete().eq('id', guildId);

        // 3. Remove bot from guild
        const botToken = process.env.DISCORD_BOT_TOKEN;
        await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bot ${botToken}` }
        });

        return NextResponse.json(data);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
