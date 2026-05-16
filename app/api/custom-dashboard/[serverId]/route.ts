import { NextResponse } from 'next/server';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import { supabase } from '@/lib/supabase';

type RouteContext = {
    params: Promise<{ serverId: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
    const { serverId } = await context.params;
    const normalizedServerId = String(serverId || '').trim();

    if (!normalizedServerId) {
        return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
    }

    const { data: server, error } = await supabase
        .from('servers')
        .select('id')
        .eq('id', normalizedServerId)
        .maybeSingle();

    if (error) {
        console.error('[CustomDashboard] Failed to load server record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!server) {
        return NextResponse.json({ error: 'Dashboard not found.' }, { status: 404 });
    }

    if (!process.env.DISCORD_TOKEN) {
        return NextResponse.json({ id: normalizedServerId, name: 'Ro-Link' });
    }

    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const guild = await rest.get(Routes.guild(normalizedServerId)) as { name?: string; icon?: string | null };

        return NextResponse.json({
            id: normalizedServerId,
            name: guild.name || 'Ro-Link',
            icon: guild.icon || null,
        });
    } catch (error) {
        console.warn('[CustomDashboard] Failed to load Discord guild details:', {
            serverId: normalizedServerId,
            error: error instanceof Error ? error.message : error,
        });

        return NextResponse.json({ id: normalizedServerId, name: 'Ro-Link', icon: null });
    }
}

