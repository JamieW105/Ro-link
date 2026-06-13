import { NextRequest, NextResponse } from 'next/server';

import { enrichLogRecordsWithLinkedUsers, expandLinkedLogTargets } from '@/lib/logIdentity';
import { canManageReports, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function sortLogs(logs: Record<string, unknown>[]) {
    const deduped = new Map<string, Record<string, unknown>>();

    for (const log of logs) {
        const id = trimString(log.id) || JSON.stringify(log);
        deduped.set(id, log);
    }

    return Array.from(deduped.values()).sort((left, right) => {
        const leftTime = new Date(trimString(left.timestamp)).getTime();
        const rightTime = new Date(trimString(right.timestamp)).getTime();
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

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

    const [targetLogsResult, moderatorLogsResult] = await Promise.all([
        client
            .from('logs')
            .select('*')
            .in('target', linkedTargets)
            .order('timestamp', { ascending: false }),
        client
            .from('logs')
            .select('*')
            .in('moderator', linkedTargets)
            .order('timestamp', { ascending: false }),
    ]);

    if (targetLogsResult.error || moderatorLogsResult.error) {
        return NextResponse.json({ error: targetLogsResult.error?.message || moderatorLogsResult.error?.message }, { status: 500 });
    }

    const logs = sortLogs([...(targetLogsResult.data || []), ...(moderatorLogsResult.data || [])]);
    const enrichedLogs = await enrichLogRecordsWithLinkedUsers(client, logs || []);

    return NextResponse.json({
        report,
        profile: profile || null,
        logs: enrichedLogs,
    });
}
