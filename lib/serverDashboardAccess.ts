import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { findBlockedServer, getBlockedServerMessage } from '@/lib/blockedServers';
import { resolveDashboardUserPermissions, type DashboardPermissions } from '@/lib/gameAdmin';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type DashboardAccess = {
    userId: string;
    permissions: DashboardPermissions;
};

export function trimString(value: unknown) {
    return String(value ?? '').trim();
}

export async function requireDashboardAccess(serverId: string, predicate?: (permissions: DashboardPermissions) => boolean) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = trimString((session.user as { id?: string }).id);
    if (!serverId || !userId) {
        return { error: NextResponse.json({ error: 'Server ID required' }, { status: 400 }) };
    }

    try {
        const blocked = await findBlockedServer(getSupabaseAdmin(), serverId);
        if (blocked) {
            return { error: NextResponse.json({ error: getBlockedServerMessage(blocked) }, { status: 403 }) };
        }

        const permissions = await resolveDashboardUserPermissions(serverId, userId);
        const hasAccess = predicate
            ? predicate(permissions)
            : permissions.is_admin || permissions.can_access_dashboard;

        if (!hasAccess) {
            return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
        }

        return { userId, permissions } satisfies DashboardAccess;
    } catch (error) {
        const discordError = error as { status?: number };
        if (discordError?.status === 404 || discordError?.status === 403) {
            return { error: NextResponse.json({ error: 'Not a member of this server' }, { status: 403 }) };
        }

        console.error('[Dashboard Access] Access check failed:', error);
        return { error: NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }) };
    }
}

export function canManageSettings(permissions: DashboardPermissions) {
    return permissions.is_admin || permissions.can_manage_settings;
}

export function canManageReports(permissions: DashboardPermissions) {
    return permissions.is_admin || permissions.can_manage_reports;
}

export function canLookup(permissions: DashboardPermissions) {
    return permissions.is_admin || permissions.can_lookup;
}

export function canAccessLivePanel(permissions: DashboardPermissions) {
    return permissions.is_admin || permissions.can_access_live_panel;
}

export function canAccessDashboardOrLivePanel(permissions: DashboardPermissions) {
    return permissions.is_admin || permissions.can_access_dashboard || permissions.can_access_live_panel;
}

export function canUseLivePanelUserTools(permissions: DashboardPermissions) {
    return permissions.is_admin || permissions.can_access_live_panel || permissions.can_lookup;
}
