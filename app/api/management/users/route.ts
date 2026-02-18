import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'MANAGE_RO_LINK'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('management_users')
        .select(`
            discord_id,
            added_at,
            role:management_roles (
                id,
                name,
                permissions
            )
        `)
        .order('added_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'MANAGE_RO_LINK'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { discordId, roleId } = await req.json();

    const { data, error } = await supabase
        .from('management_users')
        .upsert({ discord_id: discordId, role_id: roleId })
        .select(`
            discord_id,
            added_at,
            role:management_roles (
                id,
                name,
                permissions
            )
        `)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
