/* Shared by the signed interaction endpoint and the standalone Discord bot. */
const SHIFT_COMMANDS = ['shift-manage', 'shift-leaderboard', 'shift'];
const PERIODS = ['day', 'week', '30-days', '6-months', 'latest-wave'];
const hours = (seconds) =>
    `${(Math.max(0, Number(seconds) || 0) / 3600).toFixed(2)}h`;
const escapeName = (name) =>
    String(name || 'Staff')
        .slice(0, 64)
        .replace(/([\\`*_~|>])/g, '\\$1');
function response(content) {
    return { content, flags: 64, allowed_mentions: { parse: [] } };
}
function isStaff(permissions) {
    return (
        Object.entries(permissions).some(
            ([key, value]) => key !== 'allowed_misc_cmds' && value === true,
        ) || (permissions.allowed_misc_cmds || []).length > 0
    );
}
function periodStart(period, now = new Date()) {
    if (period === 'latest-wave') return null;
    const start = new Date(now);
    if (period === '6-months') {
        const day = start.getUTCDate();
        start.setUTCDate(1);
        start.setUTCMonth(start.getUTCMonth() - 6);
        start.setUTCDate(
            Math.min(
                day,
                new Date(
                    Date.UTC(
                        start.getUTCFullYear(),
                        start.getUTCMonth() + 1,
                        0,
                    ),
                ).getUTCDate(),
            ),
        );
    } else
        start.setTime(
            start.getTime() -
                { day: 1, week: 7, '30-days': 30 }[period] * 86400000,
        );
    return start.toISOString();
}
async function handleStaffShiftCommand(
    input,
    { db, permissions, normalizePlayers },
) {
    const {
        serverId,
        userId,
        command,
        action,
        period = 'latest-wave',
        page = 1,
    } = input;
    if (!serverId || !userId)
        return response('Use this command in a Discord server.');
    if (!SHIFT_COMMANDS.includes(command))
        return response('Unknown shift command.');
    if (
        command === 'shift-leaderboard'
            ? !(permissions.is_admin || permissions.can_view_staff_shifts)
            : !isStaff(permissions)
    ) {
        return response(
            command === 'shift-leaderboard'
                ? 'You need the View Staff Shifts permission to use this command.'
                : 'You need a staff role to use shift commands.',
        );
    }
    if (
        !PERIODS.includes(period) ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 10000
    )
        return response('Choose a valid time period and page.');
    if (
        command === 'shift-manage' &&
        !['start', 'stop', 'break'].includes(action)
    )
        return response(
            'Choose start, stop, or break. Use start again to resume a break.',
        );
    const { data: server, error: serverError } = await db
        .from('servers')
        .select('id')
        .eq('id', serverId)
        .maybeSingle();
    if (serverError) throw serverError;
    if (!server)
        return response(
            'This server is not set up with Ro-Link. Ask the server owner to run /setup.',
        );
    if (command === 'shift-manage') {
        const { data: linked, error: linkedError } = await db
            .from('verified_users')
            .select('roblox_id, roblox_username')
            .eq('discord_id', userId)
            .maybeSingle();
        if (linkedError) throw linkedError;
        if (!linked?.roblox_id)
            return response(
                'Link your Roblox account before managing your shift.',
            );
        const { data: servers, error: rosterError } = await db
            .from('live_servers')
            .select('id, players')
            .eq('server_id', serverId)
            .gte('updated_at', new Date(Date.now() - 120000).toISOString())
            .order('updated_at', { ascending: false });
        if (rosterError) throw rosterError;
        const jobId =
            (servers || []).find((server) =>
                normalizePlayers(server.players).some(
                    (player) =>
                        String(player.userId) === String(linked.roblox_id),
                ),
            )?.id || '';
        if (action !== 'stop' && !jobId)
            return response(
                'Join the linked game before starting or resuming a shift or taking a break.',
            );
        const { error } = await db.rpc('staff_shift_action', {
            p_server: serverId,
            p_job: jobId,
            p_discord: userId,
            p_roblox: String(linked.roblox_id),
            p_username: linked.roblox_username,
            p_action: action,
        });
        if (error) {
            const message = String(error.message || '');
            if (message.includes('Staff shifts are disabled'))
                return response('Staff shifts are disabled in this server.');
            if (message.includes('Start a shift before'))
                return response('Start a shift before taking a break.');
            if (message.includes('not currently on shift'))
                return response('You are not currently on shift.');
            throw error;
        }
        return response(
            action === 'break'
                ? 'You are on break. Break time does not count toward your quota. Use `/shift-manage start` to resume.'
                : action === 'stop'
                  ? 'Your shift has ended. Use `/shift-manage start` to start again.'
                  : 'You are on shift. Use `/shift` to check your time and quota progress.',
        );
    }
    const { data: report, error } = await db.rpc('staff_shift_report', {
        p_server: serverId,
        p_discord: command === 'shift' ? userId : null,
        p_from: periodStart(period),
        p_offset: 0,
    });
    if (error) throw error;
    if (command === 'shift-leaderboard') {
        const sorted = [...report.staff].sort(
            (a, b) =>
                b.seconds - a.seconds ||
                a.discord_id.localeCompare(b.discord_id),
        );
        const pages = Math.max(1, Math.ceil(sorted.length / 10));
        if (page > pages)
            return response(
                `That page does not exist. Choose a page from 1 to ${pages}.`,
            );
        const rows = sorted
            .slice((page - 1) * 10, page * 10)
            .map(
                (staff, index) =>
                    `**${(page - 1) * 10 + index + 1}.** ${escapeName(staff.username)} — **${hours(staff.seconds)}** · ${staff.shift_count} shifts`,
            );
        return {
            ...response(''),
            embeds: [
                {
                    title: 'Staff shift leaderboard',
                    description:
                        rows.join('\n') ||
                        'No staff shifts in this period yet.',
                    color: 0xfacc15,
                    footer: {
                        text: `${period === 'latest-wave' ? 'Latest wave' : `Past ${period.replaceAll('-', ' ')}`} · Page ${page}/${pages}`,
                    },
                },
            ],
        };
    }
    const staff = report.staff[0];
    const quota = Number(report.wave.quota_hours);
    const waveHours = (staff?.wave_seconds || 0) / 3600;
    const status = !report.settings.enabled
        ? 'Disabled'
        : report.control?.state === 'break'
          ? 'On break'
          : staff?.active
            ? 'On shift'
            : 'Off shift';
    const progress =
        quota > 0
            ? `${waveHours.toFixed(2)} / ${quota}h · ${Math.min(100, (waveHours / quota) * 100).toFixed(0)}%\n${Math.max(0, quota - waveHours).toFixed(2)}h remaining`
            : `${waveHours.toFixed(2)}h · No quota`;
    return {
        ...response(''),
        embeds: [
            {
                title: 'Your shift',
                color: 0xfacc15,
                fields: [
                    { name: 'Status', value: status, inline: true },
                    {
                        name: 'Current shift',
                        value: hours(report.current_shift_seconds || 0),
                        inline: true,
                    },
                    { name: 'Wave quota', value: progress },
                    {
                        name: 'Total',
                        value: `${hours(staff?.total_seconds || 0)} · ${staff?.total_shifts || 0} shifts`,
                        inline: true,
                    },
                ],
                footer: {
                    text: 'Use /shift-manage start to start or resume your shift.',
                },
            },
        ],
    };
}
module.exports = { SHIFT_COMMANDS, handleStaffShiftCommand };
