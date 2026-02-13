import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.accessToken) {
        const { searchParams } = new URL(req.url);
        if (searchParams.get('status') === 'check') {
            return NextResponse.json({ status: 'API Active', message: 'Roles endpoint operational' }, { status: 200 });
        }
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch roles from Discord API
        const roles = await rest.get(Routes.guildRoles(id)) as any[];

        // Map to keep only necessary fields
        const simplifiedRoles = roles.map(role => ({
            id: role.id,
            name: role.name,
            color: role.color,
            position: role.position
        })).sort((a, b) => b.position - a.position);

        return NextResponse.json(simplifiedRoles);
    } catch (error) {
        console.error(`[ROLES] Failed to fetch roles for guild ${id}:`, error);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}
