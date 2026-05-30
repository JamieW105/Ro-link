import { NextRequest, NextResponse } from 'next/server';

import { enrichLogRecordsWithLinkedUsers, expandLinkedLogTargets } from '@/lib/logIdentity';
import { canManageReports, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireDashboardAccess(serverId, canManageReports);
    if ('error' in access) {
        return access.error;
    }

    const { reportId } = await params;
    const client = getSupabaseAdmin();

    const { data: report, error: reportError } = await client
        .from('reports')
        .select('*')
        .eq('server_id', serverId)
        .eq('id', reportId)
        .maybeSingle();

    if (reportError) {
        return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    if (!report) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const reportedTarget = trimString(report.reported_roblox_username);
    const isDiscordId = /^\d{17,20}$/.test(reportedTarget);

    const profileQuery = client.from('verified_users').select('*');
    const { data: profile, error: profileError } = isDiscordId
        ? await profileQuery.eq('discord_id', reportedTarget).maybeSingle()
        : await profileQuery.ilike('roblox_username', reportedTarget).maybeSingle();

    if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const targets = [reportedTarget];
    if (profile?.roblox_username) {
        targets.push(profile.roblox_username);
    }
    if (profile?.roblox_id) {
        targets.push(profile.roblox_id);
    }
    if (profile?.discord_id) {
        targets.push(profile.discord_id);
    }

    const linkedTargets = await expandLinkedLogTargets(client, targets);

    const { data: logs, error: logsError } = await client
        .from('logs')
        .select('*')
        .in('target', linkedTargets)
        .order('timestamp', { ascending: false });

    if (logsError) {
        return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    const enrichedLogs = await enrichLogRecordsWithLinkedUsers(client, logs || []);

    return NextResponse.json({
        report,
        profile: profile || null,
        logs: enrichedLogs,
    });
}
