
import { NextResponse } from 'next/server';
import { normalizeAdminPanelCommandList } from '@/lib/adminPanelCommands';
import { canManageSettings, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { supabase } from '@/lib/supabase';

// GET ALL ROLES FOR A SERVER
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const serverId = trimString(searchParams.get('serverId'));

    if (!serverId) {
        return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    const access = await requireDashboardAccess(serverId, canManageSettings);
    if ('error' in access) {
        return access.error;
    }

    const { data, error } = await supabase
        .from('dashboard_roles')
        .select('*')
        .eq('server_id', serverId)
        .order('role_name', { ascending: true }); // Or order by created_at

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((role) => ({
        ...role,
        allowed_misc_cmds: normalizeAdminPanelCommandList(role.allowed_misc_cmds),
    })));
}

// CREATE OR UPDATE ROLE (UPSERT)
export async function POST(req: Request) {
    const body = await req.json();
    const {
        serverId,
        discordRoleId,
        roleName,
        permissions,
        miscCmds,
        panelCmds,
    } = body;

    // Validate
    if (!serverId || !discordRoleId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const access = await requireDashboardAccess(trimString(serverId), canManageSettings);
    if ('error' in access) {
        return access.error;
    }

    const normalizedPanelCommands = normalizeAdminPanelCommandList(panelCmds ?? miscCmds);

    const { data, error } = await supabase
        .from('dashboard_roles')
        .upsert({
            server_id: serverId,
            discord_role_id: discordRoleId,
            role_name: roleName,
            can_access_dashboard: permissions.access_dashboard === true,
            can_access_live_panel: permissions.live_panel === true,
            can_kick: permissions.kick === true,
            can_ban: permissions.ban === true,
            can_timeout: permissions.timeout === true,
            can_mute: permissions.mute === true,
            can_lookup: permissions.lookup === true,
            can_manage_settings: permissions.manage_settings === true,
            can_manage_reports: permissions.manage_reports === true,
            can_view_logs: permissions.view_logs === true,
            can_view_runtime_logs: permissions.view_runtime_logs === true,
            can_manage_staff_notes: permissions.manage_staff_notes === true,
            allowed_misc_cmds: normalizedPanelCommands
        }, { onConflict: 'server_id, discord_role_id' }) // Constraint name might be needed or handled automatically if standard UNIQUE INDEX exists
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        ...data,
        allowed_misc_cmds: normalizeAdminPanelCommandList(data?.allowed_misc_cmds),
    });
}

// DELETE ROLE
export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id'); // Dashboard Role ID (UUID)
    const serverId = trimString(searchParams.get('serverId'));

    if (!id || !serverId) {
        return NextResponse.json({ error: 'Role and server ID required' }, { status: 400 });
    }

    const access = await requireDashboardAccess(serverId, canManageSettings);
    if ('error' in access) {
        return access.error;
    }

    const { error } = await supabase
        .from('dashboard_roles')
        .delete()
        .eq('id', id)
        .eq('server_id', serverId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
