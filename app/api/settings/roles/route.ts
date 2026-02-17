
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET ALL ROLES FOR A SERVER
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');

    if (!serverId) {
        return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('dashboard_roles')
        .select('*')
        .eq('server_id', serverId)
        .order('role_name', { ascending: true }); // Or order by created_at

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// CREATE OR UPDATE ROLE (UPSERT)
export async function POST(req: Request) {
    const body = await req.json();
    const {
        serverId,
        discordRoleId,
        roleName,
        permissions,
        miscCmds
    } = body;

    // Validate
    if (!serverId || !discordRoleId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('dashboard_roles')
        .upsert({
            server_id: serverId,
            discord_role_id: discordRoleId,
            role_name: roleName,
            can_access_dashboard: permissions.access_dashboard,
            can_kick: permissions.kick,
            can_ban: permissions.ban,
            can_timeout: permissions.timeout,
            can_mute: permissions.mute,
            can_lookup: permissions.lookup,
            can_manage_settings: permissions.manage_settings,
            can_manage_reports: permissions.manage_reports,
            allowed_misc_cmds: miscCmds || []
        }, { onConflict: 'server_id, discord_role_id' }) // Constraint name might be needed or handled automatically if standard UNIQUE INDEX exists
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE ROLE
export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id'); // Dashboard Role ID (UUID)

    if (!id) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('dashboard_roles')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
