'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePermissions } from '@/context/PermissionsContext';
import {
    ADMIN_PANEL_COMMANDS,
    VALUE_INPUT_COMMAND_IDS,
    canUseDashboardCommand,
    getAdminPanelCommandDefinition,
    normalizeAdminPanelCommand,
    type AdminPanelCommandDefinition,
} from '@/lib/adminPanelCommands';
import { normalizeDashboardLogs, type NormalizedDashboardLog } from '@/lib/logRecords';
import { normalizeLivePlayerList, type LivePlayer } from '@/lib/livePlayers';
import type { PlayerPresenceActivity } from '@/lib/playerPresence';
import { buildRobloxAvatarUrl } from '@/lib/robloxAvatars';

interface LiveServerRecord {
    id: string;
    server_id: string;
    player_count: number;
    players?: unknown;
    updated_at: string;
}

interface LivePanelPayload {
    server?: {
        id: string;
        placeId: string | null;
    };
    liveServers?: LiveServerRecord[];
    modulePanelCommands?: AdminPanelCommandDefinition[];
    logs?: unknown[];
    playerActivity?: PlayerPresenceActivity[];
    pendingReports?: PendingReport[];
}

interface PendingReport {
    id: string;
    reported_roblox_username: string;
    reporter_roblox_username?: string | null;
    reporter_discord_id?: string | null;
    reason: string;
    created_at: string;
}

type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';
type ReportStatusFilter = ReportStatus | 'ALL';

interface LiveReport extends PendingReport {
    status?: ReportStatus | string | null;
    reporter_live_server_id?: string | null;
    reporter_join_url?: string | null;
    reported_live_server_id?: string | null;
    reported_join_url?: string | null;
    moderator_id?: string | null;
    moderator_note?: string | null;
    resolved_at?: string | null;
}

interface ReportTargetProfile {
    discord_id?: string | null;
    roblox_id?: string | null;
    roblox_username?: string | null;
}

interface VisibleGuild {
    id: string;
    name: string;
}

interface RobloxPlayerProfile {
    id: number;
    username: string;
    displayName: string;
    description: string;
    created: string;
    avatarUrl: string;
    isBanned?: boolean;
}

interface DashboardUserProfile {
    linked?: boolean;
    verifiedUser?: {
        discordId?: string | null;
        robloxId?: string | null;
        robloxUsername?: string | null;
    } | null;
    discordUser?: {
        id?: string | null;
        username?: string | null;
        globalName?: string | null;
        discriminator?: string | null;
        avatarUrl?: string | null;
    } | null;
    discordMember?: {
        nick?: string | null;
        joinedAt?: string | null;
        highestRole?: {
            id?: string;
            name?: string;
            color?: string | null;
        } | null;
        roles?: Array<{
            id?: string;
            name?: string;
            color?: string | null;
        }>;
    } | null;
    robloxUser?: {
        id?: string | null;
        username?: string | null;
        displayName?: string | null;
    } | null;
}

interface StaffNote {
    id: string;
    target_discord_id?: string | null;
    target_roblox_id?: string | null;
    target_roblox_username?: string | null;
    note: string;
    created_by_discord_id?: string | null;
    created_by_tag?: string | null;
    created_at: string;
    can_delete?: boolean;
}

interface ModuleLiveAction {
    id: string;
    moduleId: string;
    moduleName: string;
    fieldKey: string;
    label: string;
}

type NoticeState = {
    type: 'success' | 'error';
    text: string;
} | null;

type PresenceState = 'live' | 'recently-left' | 'history' | 'searched';

type LivePanelUser = LivePlayer & {
    presence: PresenceState;
    serverId: string | null;
    joinedAt?: number;
    leftAt?: number;
    sourceReason?: string;
};

type EnrichedLiveServer = LiveServerRecord & {
    players: LivePanelUser[];
    visiblePlayerCount: number;
};

type ConfirmAction = {
    command: string;
    user: LivePanelUser;
    title: string;
    body: string;
} | null;

type PanelModal = 'announce' | 'command' | null;
type RightPaneMode = 'lookup' | 'reports';
type AnnouncementTargetType = '' | 'global' | 'user';

type ParsedCommandBar = {
    command: AdminPanelCommandDefinition | null;
    matchedText: string;
    remainder: string;
};

type CommandBarSuggestion = {
    kind: 'command' | 'user';
    title: string;
    detail: string;
    meta: string;
    value: string;
};

const USERNAME_PATTERN = /@?([A-Za-z0-9_]{3,20})/;
const DISCORD_ID_PATTERN = /^\d{17,20}$/;
const VALUE_COMMAND_SET = new Set<string>(VALUE_INPUT_COMMAND_IDS);
const NUMERIC_GLOBAL_COMMANDS = new Set<string>(['GRAVITY', 'BRIGHTNESS']);
const TARGET_VALUE_COMMANDS = new Set<string>(['SET_CHAR', 'TEAM']);

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 1-9 9 8.6 8.6 0 0 1-6-2.4" />
        <path d="M3 12a9 9 0 0 1 15-6.6" />
        <path d="M18 2v4h-4" />
        <path d="M6 22v-4h4" />
    </svg>
);

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6" />
        <path d="m8 6 4-4 4 4" />
        <path d="M4 13a8 8 0 1 0 8-8" />
    </svg>
);

const KickIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="m10 17 5-5-5-5" />
        <path d="M15 12H3" />
    </svg>
);

const BanIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m5.7 5.7 12.6 12.6" />
    </svg>
);

const TempBanIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6v6l4 2" />
        <circle cx="12" cy="12" r="9" />
    </svg>
);

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11.43-6.86a1 1 0 0 0 0-1.72L9.52 4.28A1 1 0 0 0 8 5.14Z" />
    </svg>
);

const CommandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" />
    </svg>
);

const AnnounceIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 13v-2Z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
);

const ReportIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

const ServerRestartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 1-9 9 8.6 8.6 0 0 1-6-2.4" />
        <path d="M3 12a9 9 0 0 1 15-6.6" />
        <path d="M18 2v4h-4" />
        <path d="M6 22v-4h4" />
    </svg>
);

const ServerShutdownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v10" />
        <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
);

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function formatServerId(serverId: string) {
    return serverId ? `${serverId.slice(0, 8).toUpperCase()}...` : 'UNKNOWN';
}

function buildAvatarFallback(userId: string | null) {
    return buildRobloxAvatarUrl(userId);
}

function buildJoinUrl(placeId: string | null, jobId: string) {
    if (!placeId || !jobId) {
        return '';
    }

    return `roblox://placeId=${encodeURIComponent(placeId)}&gameInstanceId=${encodeURIComponent(jobId)}`;
}

function normalizeIdentity(value: unknown) {
    return trimString(value).toLowerCase();
}

function extractUsername(value: unknown) {
    const text = trimString(value);
    const atMatch = text.match(/@([A-Za-z0-9_]{3,20})/);
    if (atMatch?.[1]) {
        return atMatch[1];
    }

    const directMatch = text.match(USERNAME_PATTERN);
    return directMatch?.[1] || '';
}

function extractDiscordId(value: unknown) {
    const text = trimString(value);
    const mentionMatch = text.match(/^<@!?(\d{17,20})>$/);
    if (mentionMatch?.[1]) {
        return mentionMatch[1];
    }

    return DISCORD_ID_PATTERN.test(text) ? text : '';
}

function isLikelyUserText(value: unknown) {
    const text = trimString(value);
    if (!text || text.length < 3) {
        return false;
    }

    const lowered = text.toLowerCase();
    if (
        lowered === 'server'
        || lowered === 'global'
        || lowered === 'system'
        || lowered.includes('all live servers')
        || lowered.startsWith('server ')
    ) {
        return false;
    }

    return Boolean(extractUsername(text));
}

function getUserKey(user: Pick<LivePanelUser, 'username' | 'userId'>) {
    return user.userId ? `id:${user.userId}` : `username:${user.username.toLowerCase()}`;
}

function toPanelUser(player: LivePlayer, serverId: string | null, presence: PresenceState, sourceReason?: string): LivePanelUser {
    return {
        username: player.username,
        displayName: player.displayName || player.username,
        userId: player.userId,
        avatarUrl: player.avatarUrl || buildAvatarFallback(player.userId),
        presence,
        serverId,
        sourceReason,
    };
}

function getPresenceTimestamp(value: string) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function presenceActivityMatchesUser(activity: PlayerPresenceActivity, user: Pick<LivePanelUser, 'username' | 'userId'>) {
    const activityUserId = normalizeIdentity(activity.roblox_user_id);
    const userId = normalizeIdentity(user.userId);
    if (activityUserId && userId && activityUserId === userId) {
        return true;
    }

    return normalizeIdentity(activity.username) === normalizeIdentity(user.username);
}

function toRecentlyLeftUser(activity: PlayerPresenceActivity): LivePanelUser {
    return {
        username: activity.username,
        displayName: activity.display_name || activity.username,
        userId: activity.roblox_user_id || null,
        avatarUrl: activity.avatar_url || buildAvatarFallback(activity.roblox_user_id || null),
        presence: 'recently-left',
        serverId: activity.job_id || null,
        leftAt: getPresenceTimestamp(activity.occurred_at),
        sourceReason: 'Recently left the game',
    };
}

function targetMatchScore(user: LivePanelUser, rawQuery: string) {
    const query = normalizeIdentity(rawQuery).replace(/^@/, '');
    if (!query) {
        return 0;
    }

    const candidates = [user.username, user.displayName, user.userId]
        .map(normalizeIdentity)
        .filter(Boolean);

    if (candidates.some((candidate) => candidate === query)) {
        return 0;
    }
    if (candidates.some((candidate) => candidate.startsWith(query))) {
        return 1;
    }
    if (candidates.some((candidate) => candidate.includes(query))) {
        return 2;
    }

    return null;
}

function getTargetActivityTimestamp(user: LivePanelUser) {
    if (user.presence === 'live') {
        return user.joinedAt || 0;
    }
    if (user.presence === 'recently-left') {
        return user.leftAt || 0;
    }
    return 0;
}

function rankTargetUsers(users: LivePanelUser[], query: string) {
    return users
        .map((user) => ({ user, score: targetMatchScore(user, query) }))
        .filter((entry): entry is { user: LivePanelUser; score: number } => entry.score !== null)
        .sort((left, right) => {
            const matchDifference = left.score - right.score;
            if (matchDifference !== 0) return matchDifference;

            const activityDifference = getTargetActivityTimestamp(right.user) - getTargetActivityTimestamp(left.user);
            if (activityDifference !== 0) return activityDifference;

            const presenceRank = (user: LivePanelUser) => user.presence === 'live' ? 0 : user.presence === 'recently-left' ? 1 : 2;
            const presenceDifference = presenceRank(left.user) - presenceRank(right.user);
            return presenceDifference || left.user.username.localeCompare(right.user.username, undefined, { sensitivity: 'base' });
        })
        .map(({ user }) => user);
}

function placeholderUser(identity: string, reason: string): LivePanelUser {
    const username = extractUsername(identity) || trimString(identity) || 'UnknownUser';
    return {
        username,
        displayName: username,
        userId: null,
        avatarUrl: null,
        presence: 'history',
        serverId: null,
        sourceReason: reason,
    };
}

function logMentionsUser(log: NormalizedDashboardLog, user: LivePanelUser) {
    const candidates = [
        normalizeIdentity(user.username),
        normalizeIdentity(user.displayName),
        normalizeIdentity(user.userId),
    ].filter(Boolean);

    const haystack = [
        log.target,
        log.moderator,
        ...log.targetIdentities,
        ...log.moderatorIdentities,
    ].join(' ').toLowerCase();
    return candidates.some((candidate) => haystack.includes(candidate));
}

function getProfileIdentityCandidates(user: LivePanelUser, profile?: DashboardUserProfile | null) {
    return Array.from(new Set([
        user.username,
        user.displayName,
        user.userId,
        profile?.verifiedUser?.discordId,
        profile?.verifiedUser?.robloxId,
        profile?.verifiedUser?.robloxUsername,
        profile?.discordUser?.id,
        profile?.discordUser?.username,
        profile?.discordUser?.globalName,
        profile?.robloxUser?.id,
        profile?.robloxUser?.username,
        profile?.robloxUser?.displayName,
    ].map(normalizeIdentity).filter(Boolean)));
}

function logValueMatchesProfile(value: string, identities: string[]) {
    const normalizedValue = normalizeIdentity(value);
    return identities.some((identity) => normalizedValue.includes(identity));
}

function logListMatchesProfile(values: string[], identities: string[]) {
    return values.some((value) => logValueMatchesProfile(value, identities));
}

function logBelongsInUserProfile(log: NormalizedDashboardLog, user: LivePanelUser, profile?: DashboardUserProfile | null) {
    const identities = getProfileIdentityCandidates(user, profile);
    if (identities.length === 0) {
        return false;
    }

    return (
        logValueMatchesProfile(log.target, identities)
        || logListMatchesProfile(log.targetIdentities, identities)
    );
}

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value: string | null | undefined) {
    if (!value) {
        return 'Unknown';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function shortReportId(reportId: string) {
    return reportId.slice(0, 8).toUpperCase();
}

function getReportStatus(report: Pick<LiveReport, 'status'> | null | undefined): ReportStatus {
    const status = trimString(report?.status).toUpperCase();
    if (status === 'RESOLVED' || status === 'DISMISSED') {
        return status;
    }

    return 'PENDING';
}

function reportStatusClass(status: string | null | undefined) {
    const normalized = trimString(status).toUpperCase();
    if (normalized === 'RESOLVED') {
        return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    }
    if (normalized === 'DISMISSED') {
        return 'border-slate-700 bg-slate-800/60 text-slate-400';
    }

    return 'border-amber-500/25 bg-amber-500/10 text-amber-300';
}

function getReportReporterLabel(report: LiveReport) {
    return report.reporter_roblox_username || report.reporter_discord_id || 'Unknown reporter';
}

function presenceLabel(user: LivePanelUser) {
    if (user.presence === 'live') return 'In live server';
    if (user.presence === 'recently-left') return 'Recently left';
    if (user.presence === 'searched') return 'Profile loaded';
    return 'History match';
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCommandAliases(command: AdminPanelCommandDefinition) {
    return Array.from(new Set([
        command.id,
        command.id.replace(/_/g, ' '),
        command.id.replace(/_/g, ''),
        command.label,
        command.label.replace(/\s+/g, ''),
        normalizeAdminPanelCommand(command.label),
    ])).filter(Boolean);
}

function consumeCommandAlias(input: string, alias: string) {
    const terms = alias.trim().split(/[\s_-]+/).filter(Boolean);
    if (terms.length === 0) {
        return null;
    }

    const pattern = new RegExp(`^\\s*${terms.map(escapeRegExp).join('[\\s_-]+')}(?=$|[\\s_-])`, 'i');
    const match = input.match(pattern);
    if (!match) {
        return null;
    }

    return {
        length: match[0].trim().length,
        matchedText: match[0].trim(),
        remainder: input.slice(match[0].length).trim(),
    };
}

function parseCommandBarInput(input: string, commands: AdminPanelCommandDefinition[]): ParsedCommandBar {
    const trimmed = input.trim();
    if (!trimmed) {
        return { command: null, matchedText: '', remainder: '' };
    }

    let bestMatch: ParsedCommandBar | null = null;
    let bestLength = 0;

    for (const command of commands) {
        for (const alias of getCommandAliases(command)) {
            const match = consumeCommandAlias(trimmed, alias);
            if (match && match.length > bestLength) {
                bestLength = match.length;
                bestMatch = {
                    command,
                    matchedText: match.matchedText,
                    remainder: match.remainder,
                };
            }
        }
    }

    return bestMatch || { command: null, matchedText: '', remainder: trimmed };
}

function commandMatchesSearch(command: AdminPanelCommandDefinition, query: string) {
    if (!query) {
        return true;
    }

    const loweredQuery = query.toLowerCase();
    const normalizedQuery = normalizeAdminPanelCommand(query);
    const haystack = `${command.id} ${command.label} ${command.category} ${command.description}`.toLowerCase();

    return (
        haystack.includes(loweredQuery)
        || normalizeAdminPanelCommand(command.id).includes(normalizedQuery)
        || normalizeAdminPanelCommand(command.label).includes(normalizedQuery)
    );
}

function splitTargetAndExtra(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return {
        target: parts[0] || '',
        extra: parts.slice(1).join(' '),
    };
}

function isModulePanelCommand(command: AdminPanelCommandDefinition) {
    return command.source === 'module';
}

function tokenizeCommandArgs(value: string) {
    const tokens: string[] = [];
    const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
        tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
    }

    return tokens;
}

function assignModuleCommandFields(command: AdminPanelCommandDefinition, value: string, args: Record<string, unknown>) {
    const fields = command.fields || [];
    const trimmed = value.trim();
    if (fields.length === 0) {
        if (trimmed) {
            args.reason = trimmed;
        }
        return;
    }

    const fieldByKey = new Map<string, string>();
    for (const field of fields) {
        fieldByKey.set(normalizeAdminPanelCommand(field.id), field.id);
        fieldByKey.set(normalizeAdminPanelCommand(field.label), field.id);
    }

    const positional: string[] = [];
    for (const token of tokenizeCommandArgs(trimmed)) {
        const keyValueMatch = /^([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/.exec(token);
        if (keyValueMatch) {
            const fieldId = fieldByKey.get(normalizeAdminPanelCommand(keyValueMatch[1]));
            if (fieldId) {
                args[fieldId] = keyValueMatch[2];
                continue;
            }
        }
        positional.push(token);
    }

    const unsetFields = fields.filter((field) => args[field.id] === undefined);
    unsetFields.forEach((field, index) => {
        if (positional.length === 0) {
            return;
        }
        const isLastField = index === unsetFields.length - 1;
        args[field.id] = isLastField ? positional.splice(0).join(' ') : positional.shift();
    });
}

function getMissingRequiredModuleFields(command: AdminPanelCommandDefinition, args: Record<string, unknown>) {
    return (command.fields || [])
        .filter((field) => field.required && !trimString(args[field.id]))
        .map((field) => field.label || field.id);
}

function ActionTooltip({ label }: { label: string }) {
    return (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100">
            {label}
        </span>
    );
}

function UserAvatarButton({ user, onClick, compact = false }: { user: LivePanelUser; onClick: () => void; compact?: boolean }) {
    const sizeClass = compact ? 'h-8 w-8' : 'h-10 w-10';

    return (
        <button
            type="button"
            onClick={onClick}
            className={`group relative ${sizeClass} shrink-0 rounded-xl border border-slate-700 bg-slate-900 transition-all hover:border-sky-400/60 hover:shadow-lg hover:shadow-sky-950/30`}
        >
            <span className="block h-full w-full overflow-hidden rounded-[inherit]">
                {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" />
                ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-black uppercase text-slate-400">
                        {user.username.slice(0, 1)}
                    </span>
                )}
            </span>
            <span className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${user.presence === 'live' ? 'bg-emerald-400' : user.presence === 'recently-left' ? 'bg-amber-400' : 'bg-slate-500'}`} />
            <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 min-w-36 -translate-x-1/2 -translate-y-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left opacity-0 shadow-2xl shadow-black/40 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                <span className="block truncate text-xs font-black text-white">
                    {user.displayName || user.username}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] font-bold text-sky-300">
                    @{user.username}
                </span>
            </span>
        </button>
    );
}

function UserAvatar({ user, compact = false }: { user: LivePanelUser; compact?: boolean }) {
    const sizeClass = compact ? 'h-8 w-8' : 'h-10 w-10';

    return (
        <span className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900`}>
            {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" />
            ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-black uppercase text-slate-400">
                    {user.username.slice(0, 1)}
                </span>
            )}
            <span className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${user.presence === 'live' ? 'bg-emerald-400' : user.presence === 'recently-left' ? 'bg-amber-400' : 'bg-slate-500'}`} />
        </span>
    );
}

function ClickableUserText({ value, onOpen }: { value: string; onOpen: () => void }) {
    if (!isLikelyUserText(value)) {
        return <span>{value}</span>;
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            className="font-semibold text-sky-300 underline decoration-sky-500/30 underline-offset-4 transition-colors hover:text-sky-100"
        >
            {value}
        </button>
    );
}

export default function LivePanelPage() {
    const params = useParams();
    const { data: session } = useSession();
    const perms = usePermissions();
    const guildId = String(params.id ?? '');

    const [serverName, setServerName] = useState('Live Server');
    const [placeId, setPlaceId] = useState<string | null>(null);
    const [liveServers, setLiveServers] = useState<LiveServerRecord[]>([]);
    const [playerActivity, setPlayerActivity] = useState<PlayerPresenceActivity[]>([]);
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<NoticeState>(null);
    const [serverSearch, setServerSearch] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [profileSearch, setProfileSearch] = useState('');
    const [selectedProfileUser, setSelectedProfileUser] = useState<LivePanelUser | null>(null);
    const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('lookup');
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [panelModal, setPanelModal] = useState<PanelModal>(null);
    const [commandBarValue, setCommandBarValue] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const [announcementTargetType, setAnnouncementTargetType] = useState<AnnouncementTargetType>('');
    const [announcementUser, setAnnouncementUser] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');
    const [warningText, setWarningText] = useState('');
    const [profileCache, setProfileCache] = useState<Record<string, RobloxPlayerProfile>>({});
    const [profileLoadingKey, setProfileLoadingKey] = useState<string | null>(null);
    const [profileDetailsCache, setProfileDetailsCache] = useState<Record<string, DashboardUserProfile>>({});
    const [profileDetailsLoadingKey, setProfileDetailsLoadingKey] = useState<string | null>(null);
    const [staffNotes, setStaffNotes] = useState<StaffNote[]>([]);
    const [staffNotesLoading, setStaffNotesLoading] = useState(false);
    const [profileLogs, setProfileLogs] = useState<NormalizedDashboardLog[]>([]);
    const [profileLogsLoading, setProfileLogsLoading] = useState(false);
    const [profileCommand, setProfileCommand] = useState('');
    const [profileCommandValue, setProfileCommandValue] = useState('');
    const [moduleLiveActions, setModuleLiveActions] = useState<ModuleLiveAction[]>([]);
    const [modulePanelCommands, setModulePanelCommands] = useState<AdminPanelCommandDefinition[]>([]);
    const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>('PENDING');
    const [reportSearch, setReportSearch] = useState('');
    const [panelReports, setPanelReports] = useState<LiveReport[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsNotice, setReportsNotice] = useState<NoticeState>(null);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<LiveReport | null>(null);
    const [selectedReportProfile, setSelectedReportProfile] = useState<ReportTargetProfile | null>(null);
    const [selectedReportLogs, setSelectedReportLogs] = useState<NormalizedDashboardLog[]>([]);
    const [reportDetailLoading, setReportDetailLoading] = useState(false);
    const [reportModeratorNote, setReportModeratorNote] = useState('');
    const [reportActionLoading, setReportActionLoading] = useState<string | null>(null);
    const canManageReports = perms.is_admin || perms.can_manage_reports;

    const clearSelectedProfile = useCallback(() => {
        setSelectedProfileUser(null);
        setProfileSearch('');
        setStaffNotes([]);
        setProfileLogs([]);
        setNoteText('');
        setWarningText('');
        setProfileCommand('');
        setProfileCommandValue('');
    }, []);

    const loadPanel = useCallback(async (showLoader = false) => {
        if (!guildId) return;
        if (showLoader) {
            setLoading(true);
        }

        try {
            const response = await fetch(`/api/dashboard/live-panel?serverId=${encodeURIComponent(guildId)}&cleanupStale=true`, {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({})) as LivePanelPayload & { error?: string };

            if (!response.ok) {
                setNotice({ type: 'error', text: payload.error || 'Failed to load the Live Panel.' });
                return;
            }

            setPlaceId(payload.server?.placeId || null);
            setLiveServers(Array.isArray(payload.liveServers) ? payload.liveServers : []);
            setPlayerActivity(Array.isArray(payload.playerActivity) ? payload.playerActivity : []);
            setModulePanelCommands(Array.isArray(payload.modulePanelCommands) ? payload.modulePanelCommands : []);
            setLogs(normalizeDashboardLogs(payload.logs || []));
            setPendingReports(Array.isArray(payload.pendingReports) ? payload.pendingReports : []);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to load the Live Panel: ${String(error)}` });
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, [guildId]);

    const loadPanelReports = useCallback(async (status: ReportStatusFilter = 'PENDING') => {
        if (!guildId || !canManageReports) {
            setPanelReports([]);
            return;
        }

        setReportsLoading(true);
        setReportsNotice(null);

        try {
            const response = await fetch(`/api/reports?serverId=${encodeURIComponent(guildId)}&status=${encodeURIComponent(status)}`, {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ([])) as LiveReport[] | { error?: string };

            if (!response.ok || !Array.isArray(payload)) {
                const errorText = Array.isArray(payload) ? '' : trimString(payload.error);
                setPanelReports([]);
                setReportsNotice({ type: 'error', text: errorText || 'Failed to load reports.' });
                return;
            }

            setPanelReports(payload);
        } catch (error) {
            setPanelReports([]);
            setReportsNotice({ type: 'error', text: `Failed to load reports: ${String(error)}` });
        } finally {
            setReportsLoading(false);
        }
    }, [canManageReports, guildId]);

    const loadReportDetail = useCallback(async (reportId: string) => {
        if (!guildId || !canManageReports || !reportId) return;

        setReportDetailLoading(true);
        setReportsNotice(null);

        try {
            const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/context?serverId=${encodeURIComponent(guildId)}`, {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({})) as {
                report?: LiveReport;
                profile?: ReportTargetProfile | null;
                logs?: unknown[];
                error?: string;
            };

            if (!response.ok || !payload.report) {
                setSelectedReport(null);
                setSelectedReportProfile(null);
                setSelectedReportLogs([]);
                setReportModeratorNote('');
                setReportsNotice({ type: 'error', text: payload.error || 'Failed to load report details.' });
                return;
            }

            setSelectedReport(payload.report);
            setSelectedReportProfile(payload.profile || null);
            setSelectedReportLogs(normalizeDashboardLogs(payload.logs || []));
            setReportModeratorNote(trimString(payload.report.moderator_note));
        } catch (error) {
            setSelectedReport(null);
            setSelectedReportProfile(null);
            setSelectedReportLogs([]);
            setReportModeratorNote('');
            setReportsNotice({ type: 'error', text: `Failed to load report details: ${String(error)}` });
        } finally {
            setReportDetailLoading(false);
        }
    }, [canManageReports, guildId]);

    useEffect(() => {
        loadPanel(true);
        const interval = window.setInterval(() => loadPanel(false), 7000);
        return () => window.clearInterval(interval);
    }, [loadPanel]);

    useEffect(() => {
        if (!canManageReports || rightPaneMode !== 'reports') {
            return;
        }

        loadPanelReports(reportStatusFilter);
    }, [canManageReports, loadPanelReports, reportStatusFilter, rightPaneMode]);

    useEffect(() => {
        if (rightPaneMode !== 'reports') {
            return;
        }

        if (panelReports.length === 0) {
            return;
        }

        if (selectedReportId && panelReports.some((report) => report.id === selectedReportId)) {
            return;
        }

        setSelectedReportId(panelReports[0].id);
    }, [panelReports, rightPaneMode, selectedReportId]);

    useEffect(() => {
        if (rightPaneMode !== 'reports' || !selectedReportId) {
            setSelectedReport(null);
            setSelectedReportProfile(null);
            setSelectedReportLogs([]);
            setReportModeratorNote('');
            return;
        }

        loadReportDetail(selectedReportId);
    }, [loadReportDetail, rightPaneMode, selectedReportId]);

    useEffect(() => {
        if (!selectedProfileUser) return;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== 'Escape' || panelModal || confirmAction) return;
            event.preventDefault();
            clearSelectedProfile();
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearSelectedProfile, confirmAction, panelModal, selectedProfileUser]);

    useEffect(() => {
        if (!guildId) return;

        async function loadServerName() {
            try {
                const response = await fetch('/api/guilds', { cache: 'no-store' });
                const guilds = response.ok ? await response.json() as VisibleGuild[] : [];
                const guild = guilds.find((item) => item.id === guildId);
                if (guild?.name) {
                    setServerName(guild.name);
                }
            } catch {
                setServerName('Live Server');
            }
        }

        loadServerName();
    }, [guildId]);

    useEffect(() => {
        if (!guildId) return;

        async function loadModuleLiveActions() {
            try {
                const response = await fetch(`/api/dashboard/modules?serverId=${encodeURIComponent(guildId)}`, { cache: 'no-store' });
                if (!response.ok) {
                    setModuleLiveActions([]);
                    return;
                }

                const payload = await response.json().catch(() => ({})) as { modules?: unknown[] };
                const actions: ModuleLiveAction[] = [];
                for (const moduleRow of Array.isArray(payload.modules) ? payload.modules : []) {
                    if (!moduleRow || typeof moduleRow !== 'object') continue;
                    const record = moduleRow as Record<string, unknown>;
                    if (record.enabled === false) continue;
                    const moduleId = trimString(record.id);
                    const moduleName = trimString(record.name) || trimString(record.slug) || 'Module';
                    const configSchema = record.configSchema;
                    if (!moduleId || !configSchema || typeof configSchema !== 'object' || Array.isArray(configSchema)) continue;

                    for (const [fieldKey, rawField] of Object.entries(configSchema as Record<string, unknown>)) {
                        if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField)) continue;
                        const field = rawField as Record<string, unknown>;
                        if (field.live !== true || field.type !== 'player') continue;
                        const label = trimString(field.liveButtonText) || trimString(field.label) || fieldKey;
                        actions.push({
                            id: `module:${moduleId}:${fieldKey}`,
                            moduleId,
                            moduleName,
                            fieldKey,
                            label,
                        });
                    }
                }

                setModuleLiveActions(actions);
            } catch {
                setModuleLiveActions([]);
            }
        }

        loadModuleLiveActions();
    }, [guildId]);

    const enrichedServers = useMemo<EnrichedLiveServer[]>(() => (
        liveServers.map((server) => {
            const players = normalizeLivePlayerList(server.players)
                .sort((left, right) => left.username.localeCompare(right.username, undefined, { sensitivity: 'base' }))
                .map((player) => toPanelUser(player, server.id, 'live'));

            return {
                ...server,
                players,
                visiblePlayerCount: players.length > 0 ? players.length : Number(server.player_count || 0),
            };
        })
    ), [liveServers]);

    const liveUserMap = useMemo(() => {
        const users = new Map<string, LivePanelUser>();
        for (const server of enrichedServers) {
            for (const player of server.players) {
                users.set(getUserKey(player), player);
                users.set(`username:${player.username.toLowerCase()}`, player);
                if (player.userId) {
                    users.set(`id:${player.userId.toLowerCase()}`, player);
                }
            }
        }
        return users;
    }, [enrichedServers]);

    const liveUsers = useMemo(() => {
        const users = new Map<string, LivePanelUser>();
        for (const server of enrichedServers) {
            for (const player of server.players) {
                users.set(getUserKey(player), player);
            }
        }
        return Array.from(users.values());
    }, [enrichedServers]);

    const allKnownUsers = useMemo(() => {
        const users = new Map<string, LivePanelUser>();
        const recentActivity = [...playerActivity]
            .sort((left, right) => getPresenceTimestamp(right.occurred_at) - getPresenceTimestamp(left.occurred_at));

        for (const user of liveUsers) {
            const latestJoin = recentActivity.find((activity) => (
                activity.event_type === 'JOIN'
                && activity.job_id === user.serverId
                && presenceActivityMatchesUser(activity, user)
            ));
            users.set(getUserKey(user), {
                ...user,
                ...(latestJoin ? {
                    joinedAt: getPresenceTimestamp(latestJoin.occurred_at),
                    sourceReason: `Joined at ${formatTime(latestJoin.occurred_at)}`,
                } : {}),
            });
        }

        for (const activity of recentActivity) {
            if (activity.event_type !== 'LEAVE') {
                continue;
            }

            const user = toRecentlyLeftUser(activity);
            if (liveUsers.some((liveUser) => presenceActivityMatchesUser(activity, liveUser))) {
                continue;
            }

            if (Array.from(users.values()).some((knownUser) => presenceActivityMatchesUser(activity, knownUser))) {
                continue;
            }

            const userKey = getUserKey(user);
            if (!users.has(userKey)) {
                users.set(userKey, user);
            }
        }

        for (const log of logs) {
            for (const [value, reason] of [
                [log.target, `Recently moderated: ${log.action}`],
                [log.moderator, `Recent staff mention: ${log.action}`],
                ...log.targetIdentities.map((identity) => [identity, `Recently moderated: ${log.action}`] as [string, string]),
                ...log.moderatorIdentities.map((identity) => [identity, `Recent staff mention: ${log.action}`] as [string, string]),
            ] as Array<[string, string]>) {
                if (!isLikelyUserText(value)) continue;
                const username = extractUsername(value);
                const existing = liveUserMap.get(`username:${username.toLowerCase()}`)
                    || Array.from(users.values()).find((knownUser) => normalizeIdentity(knownUser.username) === normalizeIdentity(username));
                const user = existing || placeholderUser(username || value, reason);
                users.set(getUserKey(user), {
                    ...user,
                    sourceReason: user.sourceReason || reason,
                });
            }
        }

        return Array.from(users.values())
            .sort((left, right) => {
                const rank = (user: LivePanelUser) => user.presence === 'live' ? 0 : user.presence === 'recently-left' ? 1 : 2;
                return rank(left) - rank(right) || left.username.localeCompare(right.username);
            });
    }, [liveUserMap, liveUsers, logs, playerActivity]);

    const filteredServers = useMemo(() => {
        const query = serverSearch.trim().toLowerCase();
        if (!query) return enrichedServers;

        return enrichedServers.filter((server) => (
            server.id.toLowerCase().includes(query)
            || server.players.some((player) => (
                player.username.toLowerCase().includes(query)
                || player.displayName.toLowerCase().includes(query)
                || normalizeIdentity(player.userId).includes(query)
            ))
        ));
    }, [enrichedServers, serverSearch]);

    const filteredLogs = useMemo(() => {
        const query = logSearch.trim().toLowerCase();
        if (!query) return logs;

        return logs.filter((log) => (
            log.action.toLowerCase().includes(query)
            || log.target.toLowerCase().includes(query)
            || log.moderator.toLowerCase().includes(query)
            || log.targetIdentities.some((identity) => identity.toLowerCase().includes(query))
            || log.moderatorIdentities.some((identity) => identity.toLowerCase().includes(query))
        ));
    }, [logSearch, logs]);

    const filteredPanelReports = useMemo(() => {
        const query = reportSearch.trim().toLowerCase();
        if (!query) return panelReports;

        return panelReports.filter((report) => (
            shortReportId(report.id).toLowerCase().includes(query)
            || report.reported_roblox_username.toLowerCase().includes(query)
            || getReportReporterLabel(report).toLowerCase().includes(query)
            || report.reason.toLowerCase().includes(query)
            || getReportStatus(report).toLowerCase().includes(query)
        ));
    }, [panelReports, reportSearch]);

    const availableCommands = useMemo(() => {
        const builtInCommands = ADMIN_PANEL_COMMANDS.filter((command) => canUseDashboardCommand(perms, command.id));
        const builtInIds = new Set(builtInCommands.map((command) => command.id));
        const visibleModuleCommands = (perms.is_admin || perms.can_access_live_panel)
            ? modulePanelCommands.filter((command) => !builtInIds.has(command.id))
            : [];

        return [...builtInCommands, ...visibleModuleCommands];
    }, [modulePanelCommands, perms]);

    const suggestions = useMemo(() => {
        const query = profileSearch.trim().toLowerCase();
        if (!query) return [];

        const ranked = rankTargetUsers(allKnownUsers, query)
            .map((user) => {
                const recentLog = logs.find((log) => logMentionsUser(log, user));
                const reason = user.presence === 'live'
                    ? `${user.joinedAt ? `Joined ${formatTime(new Date(user.joinedAt).toISOString())} · ` : ''}In ${formatServerId(user.serverId || '')}`
                    : user.presence === 'recently-left'
                        ? `${user.leftAt ? `Left ${formatTime(new Date(user.leftAt).toISOString())}` : 'Recently left the game'}`
                        : recentLog
                            ? `Recent ${recentLog.action}`
                            : user.sourceReason || 'Known user';
                return { user, reason };
            });

        return ranked.slice(0, 6);
    }, [allKnownUsers, logs, profileSearch]);

    const commandBarParsed = useMemo(() => (
        parseCommandBarInput(commandBarValue, availableCommands)
    ), [availableCommands, commandBarValue]);

    const commandBarSuggestions = useMemo<CommandBarSuggestion[]>(() => {
        const query = commandBarValue.trim().toLowerCase().replace(/^@/, '');
        const items: CommandBarSuggestion[] = [];
        const userMatches = (rawSearch: string) => {
            const search = rawSearch.trim().toLowerCase().replace(/^@/, '');
            return rankTargetUsers(allKnownUsers, search)
                .slice(0, 6);
        };
        const userReason = (user: LivePanelUser) => {
            const recentLog = logs.find((log) => logMentionsUser(log, user));
            if (user.presence === 'live') return user.joinedAt
                ? `Joined ${formatTime(new Date(user.joinedAt).toISOString())} in ${formatServerId(user.serverId || '')}`
                : `In ${formatServerId(user.serverId || '')}`;
            if (user.presence === 'recently-left') return user.leftAt
                ? `Left ${formatTime(new Date(user.leftAt).toISOString())}`
                : 'Recently left the game';
            if (recentLog) return `Recent ${recentLog.action}`;
            return user.sourceReason || 'Known user';
        };

        if (!commandBarParsed.command) {
            const commandMatches = availableCommands
                .filter((command) => commandMatchesSearch(command, query))
                .slice(0, query ? 5 : 6);

            commandMatches.forEach((command) => {
                items.push({
                    kind: 'command',
                    title: command.label,
                    detail: `${command.description}${command.requiresTarget ? ' Needs a user target.' : isModulePanelCommand(command) ? ' Runs through its module.' : ' Runs on live servers.'}`,
                    meta: isModulePanelCommand(command) && command.moduleName ? command.moduleName : command.category,
                    value: command.requiresTarget || command.id === 'BROADCAST' || NUMERIC_GLOBAL_COMMANDS.has(command.id)
                        ? `${command.label} `
                        : command.label,
                });
            });

            const defaultTargetCommand = availableCommands.find((command) => command.id === 'REFRESH')
                || availableCommands.find((command) => command.requiresTarget);
            if (query.length >= 2 && defaultTargetCommand) {
                userMatches(query).slice(0, 3).forEach((user) => {
                    items.push({
                        kind: 'user',
                        title: user.displayName || user.username,
                        detail: `${userReason(user)}. Run ${defaultTargetCommand.label}.`,
                        meta: `@${user.username}`,
                        value: `${defaultTargetCommand.label} ${user.username}`,
                    });
                });
            }

            return items.slice(0, 8);
        }

        const command = commandBarParsed.command;
        if (command.requiresTarget) {
            userMatches(commandBarParsed.remainder).forEach((user) => {
                items.push({
                    kind: 'user',
                    title: user.displayName || user.username,
                    detail: userReason(user),
                    meta: `@${user.username}`,
                    value: `${command.label} ${user.username}${VALUE_COMMAND_SET.has(command.id) || TARGET_VALUE_COMMANDS.has(command.id) ? ' ' : ''}`,
                });
            });
        } else if (command.id === 'VIEW') {
            userMatches(commandBarParsed.remainder).forEach((user) => {
                items.push({
                    kind: 'user',
                    title: user.displayName || user.username,
                    detail: `${userReason(user)}. Leave blank to reset your own camera.`,
                    meta: `@${user.username}`,
                    value: `${command.label} ${user.username}`,
                });
            });
        } else if (isModulePanelCommand(command) && command.fields && command.fields.length > 0) {
            command.fields.slice(0, 4).forEach((field) => {
                items.push({
                    kind: 'command',
                    title: `${field.label}${field.required ? ' required' : ''}`,
                    detail: command.moduleName ? `${command.label} field from ${command.moduleName}.` : `${command.label} field.`,
                    meta: field.id,
                    value: `${command.label} ${field.id}=`,
                });
            });
        } else if (NUMERIC_GLOBAL_COMMANDS.has(command.id)) {
            ['196.2', '0', '75'].forEach((amount) => {
                items.push({
                    kind: 'command',
                    title: `${command.label} ${amount}`,
                    detail: `Set ${command.label.toLowerCase()} to ${amount} across live servers.`,
                    meta: 'Value',
                    value: `${command.label} ${amount}`,
                });
            });
        }

        return items.slice(0, 8);
    }, [allKnownUsers, availableCommands, commandBarParsed, commandBarValue, logs]);

    const totalPlayers = enrichedServers.reduce((sum, server) => sum + server.visiblePlayerCount, 0);
    const panelUser = selectedProfileUser;
    const panelProfile = panelUser ? profileCache[getUserKey(panelUser)] : null;
    const panelProfileDetails = panelUser ? profileDetailsCache[getUserKey(panelUser)] || null : null;
    const profileLogEntries = panelUser
        ? (profileLogs.length > 0 ? profileLogs : logs)
            .filter((log) => logBelongsInUserProfile(log, panelUser, panelProfileDetails))
            .slice(0, 20)
        : [];
    const selectedModuleLiveAction = moduleLiveActions.find((action) => action.id === profileCommand) || null;
    const profileCommandDefinition = profileCommand ? getAdminPanelCommandDefinition(profileCommand) : null;
    const profileCommandNeedsValue = profileCommandDefinition
        ? VALUE_COMMAND_SET.has(profileCommandDefinition.id)
        || TARGET_VALUE_COMMANDS.has(profileCommandDefinition.id)
        || NUMERIC_GLOBAL_COMMANDS.has(profileCommandDefinition.id)
        || profileCommandDefinition.id === 'BROADCAST'
        : false;
    const profileCommandOptions = availableCommands.filter((command) => (
        !isModulePanelCommand(command)
        && command.requiresTarget
        && !['KICK', 'BAN', 'SOFTBAN', 'UNBAN'].includes(command.id)
    ));
    const announcementUserQuery = announcementUser.trim().toLowerCase().replace(/^@/, '');
    const announcementUserSuggestions = announcementTargetType === 'user'
        ? allKnownUsers
            .filter((user) => user.presence === 'live')
            .filter((user) => (
                !announcementUserQuery
                || user.username.toLowerCase().includes(announcementUserQuery)
                || user.displayName.toLowerCase().includes(announcementUserQuery)
                || normalizeIdentity(user.userId).includes(announcementUserQuery)
            ))
            .slice(0, 5)
        : [];

    function resolveUserFromText(value: string): LivePanelUser {
        const username = extractUsername(value);
        const direct = username ? liveUserMap.get(`username:${username.toLowerCase()}`) : null;
        if (direct) return direct;

        const known = allKnownUsers.find((user) => (
            user.username.toLowerCase() === username.toLowerCase()
            || user.displayName.toLowerCase() === username.toLowerCase()
            || normalizeIdentity(user.userId) === username.toLowerCase()
        ));

        return known || placeholderUser(username || value, 'Log mention');
    }

    async function hydrateProfile(user: LivePanelUser) {
        const key = getUserKey(user);
        if (profileCache[key] || profileLoadingKey === key) {
            return;
        }

        setProfileLoadingKey(key);
        try {
            const response = await fetch(`/api/proxy?username=${encodeURIComponent(user.username)}&serverId=${encodeURIComponent(guildId)}`, {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));
            if (response.ok) {
                setProfileCache((current) => ({
                    ...current,
                    [key]: payload as RobloxPlayerProfile,
                }));
            }
        } finally {
            setProfileLoadingKey(null);
        }
    }

    async function loadUserStaffNotes(user: LivePanelUser, profile?: DashboardUserProfile | null) {
        setStaffNotesLoading(true);
        try {
            const params = new URLSearchParams({
                serverId: guildId,
                robloxUsername: profile?.robloxUser?.username || profile?.verifiedUser?.robloxUsername || user.username,
            });
            const robloxId = profile?.robloxUser?.id || profile?.verifiedUser?.robloxId || user.userId;
            const discordId = profile?.discordUser?.id || profile?.verifiedUser?.discordId;
            if (robloxId) params.set('robloxId', String(robloxId));
            if (discordId) params.set('discordId', String(discordId));

            const response = await fetch(`/api/dashboard/staff-notes?${params.toString()}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({})) as { notes?: StaffNote[] };
            setStaffNotes(response.ok && Array.isArray(payload.notes) ? payload.notes : []);
        } finally {
            setStaffNotesLoading(false);
        }
    }

    async function loadUserLogs(user: LivePanelUser, profile?: DashboardUserProfile | null) {
        setProfileLogsLoading(true);
        try {
            const identities = [
                user.username,
                user.userId,
                profile?.verifiedUser?.discordId,
                profile?.verifiedUser?.robloxId,
                profile?.verifiedUser?.robloxUsername,
                profile?.robloxUser?.id,
                profile?.robloxUser?.username,
                profile?.discordUser?.id,
            ].map(trimString).filter(Boolean);
            const params = new URLSearchParams({
                serverId: guildId,
                limit: '120',
            });
            for (const identity of Array.from(new Set(identities))) {
                params.append('target', identity);
            }

            const response = await fetch(`/api/dashboard/logs?${params.toString()}`, { cache: 'no-store' });
            const payload = response.ok ? await response.json() : [];
            setProfileLogs(normalizeDashboardLogs(payload));
        } finally {
            setProfileLogsLoading(false);
        }
    }

    async function loadSelectedUserData(user: LivePanelUser) {
        const key = getUserKey(user);
        const cached = profileDetailsCache[key] || null;
        setStaffNotes([]);
        setProfileLogs([]);

        if (cached) {
            await Promise.all([
                loadUserStaffNotes(user, cached),
                loadUserLogs(user, cached),
            ]);
            return;
        }

        setProfileDetailsLoadingKey(key);
        try {
            const params = new URLSearchParams({
                serverId: guildId,
                robloxUsername: user.username,
            });
            if (user.userId) {
                params.set('robloxId', user.userId);
            }
            const discordId = extractDiscordId(user.username) || extractDiscordId(user.displayName);
            if (discordId) {
                params.set('discordId', discordId);
            }

            const response = await fetch(`/api/dashboard/user-profile?${params.toString()}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({})) as DashboardUserProfile & { error?: string };
            const profile = response.ok ? payload : null;
            if (profile) {
                setProfileDetailsCache((current) => ({
                    ...current,
                    [key]: profile,
                }));
            }

            await Promise.all([
                loadUserStaffNotes(user, profile),
                loadUserLogs(user, profile),
            ]);
        } finally {
            setProfileDetailsLoadingKey(null);
        }
    }

    function selectProfileUser(user: LivePanelUser) {
        const liveMatch = liveUserMap.get(getUserKey(user)) || liveUserMap.get(`username:${user.username.toLowerCase()}`);
        const normalizedUser = liveMatch
            ? {
                ...liveMatch,
                joinedAt: user.joinedAt,
                sourceReason: user.sourceReason || liveMatch.sourceReason,
            }
            : user;
        setSelectedProfileUser(normalizedUser);
        setProfileSearch(normalizedUser.username);
        setNoteText('');
        setWarningText('');
        setProfileCommand('');
        setProfileCommandValue('');
        hydrateProfile(normalizedUser);
        loadSelectedUserData(normalizedUser);
    }

    async function selectTypedProfile() {
        const query = profileSearch.trim();
        if (!query) return;

        const existing = suggestions[0]?.user || resolveUserFromText(query);
        const selected = {
            ...existing,
            presence: existing.presence === 'history' ? 'searched' : existing.presence,
        } satisfies LivePanelUser;
        selectProfileUser(selected);
    }

    async function sendCommand(command: string, args: Record<string, unknown>, successMessage: string) {
        setActionLoading(command);
        setNotice(null);

        try {
            const response = await fetch('/api/dashboard/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: guildId,
                    command,
                    args,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setNotice({ type: 'error', text: trimString(payload.error) || 'Failed to send command.' });
                return false;
            }

            setNotice({ type: 'success', text: trimString(payload.warning) || successMessage });
            await loadPanel(false);
            return true;
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to send command: ${String(error)}` });
            return false;
        } finally {
            setActionLoading(null);
        }
    }

    async function sendServerLifecycleCommand(serverId: string, command: 'UPDATE' | 'SHUTDOWN') {
        if (!canUseDashboardCommand(perms, command)) {
            setNotice({ type: 'error', text: 'You do not have permission to use that server action.' });
            return;
        }

        const label = command === 'UPDATE' ? 'Restart' : 'Shut down';
        const confirmation = command === 'UPDATE'
            ? `Restart server ${formatServerId(serverId)}? Players will be moved through a reserved server and then back into public servers.`
            : `Shut down server ${formatServerId(serverId)}? Players in this live server will be disconnected.`;

        if (!confirm(confirmation)) {
            return;
        }

        await sendCommand(
            command,
            {
                job_id: serverId,
                target_scope: 'SERVER',
                target_label: serverId,
                reason: command === 'UPDATE' ? 'Live Panel quick restart' : 'Live Panel quick shutdown',
            },
            `${label} queued for server ${formatServerId(serverId)}.`,
        );
    }

    async function sendPlayerCommand(command: string, user: LivePanelUser) {
        if (!canUseDashboardCommand(perms, command)) {
            setNotice({ type: 'error', text: 'You do not have permission to use that quick action.' });
            return;
        }

        if (user.presence !== 'live') {
            setNotice({ type: 'error', text: 'That quick action requires the user to be in a live server.' });
            return;
        }

        await sendCommand(
            command,
            {
                username: user.username,
                ...(user.serverId ? { job_id: user.serverId } : {}),
                reason: 'Live Panel quick action',
            },
            `${getAdminPanelCommandDefinition(command)?.label || command} queued for ${user.username}.`,
        );
    }

    function requestPlayerCommand(command: string, user: LivePanelUser) {
        const label = getAdminPanelCommandDefinition(command)?.label || command;
        if (command === 'KICK' || command === 'BAN' || command === 'SOFTBAN') {
            setConfirmAction({
                command,
                user,
                title: `${label} ${user.username}`,
                body: `Queue ${label.toLowerCase()} for ${user.displayName || user.username} in ${formatServerId(user.serverId || '')}?`,
            });
            return;
        }

        sendPlayerCommand(command, user);
    }

    async function submitConfirmAction() {
        if (!confirmAction) return;
        const action = confirmAction;
        setConfirmAction(null);
        await sendPlayerCommand(action.command, action.user);
    }

    async function submitAnnouncement() {
        if (!canUseDashboardCommand(perms, 'BROADCAST')) {
            setNotice({ type: 'error', text: 'You do not have permission to send announcements.' });
            return;
        }

        const message = announcement.trim();
        if (!message) {
            setNotice({ type: 'error', text: 'Enter an announcement before sending.' });
            return;
        }

        if (!announcementTargetType) {
            setNotice({ type: 'error', text: 'Choose Global or User before sending the announcement.' });
            return;
        }

        const args: Record<string, unknown> = { message };
        let successMessage = 'Announcement queued for all live servers.';

        if (announcementTargetType === 'global') {
            args.target_scope = 'GLOBAL';
            args.target_label = 'global';
        } else {
            const target = announcementUser.trim();
            if (!target) {
                setNotice({ type: 'error', text: 'Choose or type a user before sending the announcement.' });
                return;
            }

            const targetUser = resolveUserFromText(target);
            if (targetUser.presence !== 'live') {
                setNotice({ type: 'error', text: 'User announcements require the target to be in a live server.' });
                return;
            }

            args.username = targetUser.username;
            args.target_label = targetUser.username;
            if (targetUser.serverId) {
                args.job_id = targetUser.serverId;
            }
            successMessage = `Announcement queued for ${targetUser.username}.`;
        }

        const sent = await sendCommand(
            'BROADCAST',
            args,
            successMessage,
        );

        if (sent) {
            setAnnouncement('');
            setAnnouncementTargetType('');
            setAnnouncementUser('');
            setPanelModal(null);
        }
    }

    async function submitManualCommand() {
        const parsed = parseCommandBarInput(commandBarValue, availableCommands);
        const commandDefinition = parsed.command;
        if (!commandDefinition) {
            setNotice({ type: 'error', text: 'Type a command first, such as refresh username.' });
            return;
        }

        const args: Record<string, unknown> = {};
        let target = '';
        let successTarget = '';

        if (isModulePanelCommand(commandDefinition)) {
            if (commandDefinition.requiresTarget) {
                const targetParts = splitTargetAndExtra(parsed.remainder);
                target = targetParts.target;

                if (!target) {
                    setNotice({ type: 'error', text: 'Add a user after the module command before running it.' });
                    return;
                }

                const knownTarget = resolveUserFromText(target);
                successTarget = knownTarget.username || target;
                args.username = successTarget;
                args.target_label = successTarget;
                if (knownTarget?.serverId) {
                    args.job_id = knownTarget.serverId;
                }
                assignModuleCommandFields(commandDefinition, targetParts.extra, args);
            } else {
                args.target_scope = 'GLOBAL';
                args.target_label = 'global';
                assignModuleCommandFields(commandDefinition, parsed.remainder, args);
            }

            const missingFields = getMissingRequiredModuleFields(commandDefinition, args);
            if (missingFields.length > 0) {
                setNotice({ type: 'error', text: `Add ${missingFields.join(', ')} before running ${commandDefinition.label}.` });
                return;
            }
        } else if (commandDefinition.requiresTarget) {
            const targetParts = splitTargetAndExtra(parsed.remainder);
            target = targetParts.target;
            const extra = targetParts.extra;

            if (!target) {
                setNotice({ type: 'error', text: 'Add a user after the command before running it.' });
                return;
            }

            const knownTarget = resolveUserFromText(target);
            successTarget = knownTarget.username || target;
            args.username = successTarget;
            args.reason = extra || 'Live Panel command bar';

            if (knownTarget?.serverId) {
                args.job_id = knownTarget.serverId;
            }

            if (VALUE_COMMAND_SET.has(commandDefinition.id)) {
                if (!extra || !Number.isFinite(Number(extra))) {
                    setNotice({ type: 'error', text: `Add a numeric value after the user for ${commandDefinition.label}.` });
                    return;
                }
                args.amount = extra;
                args.reason = 'Live Panel command bar';
            }

            if (commandDefinition.id === 'SET_CHAR') {
                if (!extra) {
                    setNotice({ type: 'error', text: 'Add the character username after the target user.' });
                    return;
                }
                args.char_user = extra;
                args.reason = `Set character to ${extra}`;
            } else if (commandDefinition.id === 'TEAM') {
                if (!extra) {
                    setNotice({ type: 'error', text: 'Add the Roblox team name after the target user.' });
                    return;
                }
                args.team_name = extra;
                args.reason = `Set team to ${extra}`;
            }
        } else {
            const remainder = parsed.remainder.trim();

            if (commandDefinition.id === 'VIEW') {
                if (remainder) {
                    const targetParts = splitTargetAndExtra(remainder);
                    const knownTarget = resolveUserFromText(targetParts.target);
                    successTarget = knownTarget.username || targetParts.target;
                    args.username = successTarget;
                    args.reason = targetParts.extra || 'Live Panel command bar';
                    if (knownTarget?.serverId) {
                        args.job_id = knownTarget.serverId;
                    }
                } else {
                    args.reason = 'Live Panel command bar';
                }
            } else if (NUMERIC_GLOBAL_COMMANDS.has(commandDefinition.id)) {
                args.target_scope = 'GLOBAL';
                args.target_label = 'global';
                if (!remainder || !Number.isFinite(Number(remainder))) {
                    setNotice({ type: 'error', text: `Add a numeric value after ${commandDefinition.label}.` });
                    return;
                }
                args.amount = remainder;
            } else if (commandDefinition.id === 'BROADCAST') {
                args.target_scope = 'GLOBAL';
                args.target_label = 'global';
                if (!remainder) {
                    setNotice({ type: 'error', text: 'Add a broadcast message after the command.' });
                    return;
                }
                args.message = remainder;
            } else if (remainder) {
                args.target_scope = 'GLOBAL';
                args.target_label = 'global';
                args.reason = remainder;
            } else {
                args.target_scope = 'GLOBAL';
                args.target_label = 'global';
            }
        }

        const sent = await sendCommand(
            commandDefinition.id,
            args,
            `${commandDefinition.label} queued${successTarget ? ` for ${successTarget}` : ''}.`,
        );

        if (sent) {
            setCommandBarValue('');
            setPanelModal(null);
        }
    }

    async function saveUserNote(kind: 'note' | 'warning') {
        if (!panelUser) return;
        const value = kind === 'warning' ? warningText.trim() : noteText.trim();
        if (!value) {
            setNotice({ type: 'error', text: kind === 'warning' ? 'Type a warning before saving.' : 'Type a staff note before saving.' });
            return;
        }

        setActionLoading(kind);
        setNotice(null);

        try {
            const response = await fetch('/api/dashboard/staff-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: guildId,
                    discordId: panelProfileDetails?.discordUser?.id || panelProfileDetails?.verifiedUser?.discordId || undefined,
                    robloxId: panelProfileDetails?.robloxUser?.id || panelProfile?.id || panelUser.userId || undefined,
                    robloxUsername: panelProfileDetails?.robloxUser?.username || panelProfile?.username || panelUser.username,
                    note: kind === 'warning' ? `Warning: ${value}` : value,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setNotice({ type: 'error', text: trimString(payload.error) || 'Failed to save note.' });
                return;
            }

            setNotice({ type: 'success', text: kind === 'warning' ? 'Warning saved.' : 'Staff note saved.' });
            if (kind === 'warning') setWarningText('');
            else setNoteText('');
            if (payload.note) {
                setStaffNotes((current) => [payload.note as StaffNote, ...current].slice(0, 10));
            }
            await loadPanel(false);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to save note: ${String(error)}` });
        } finally {
            setActionLoading(null);
        }
    }

    async function submitProfileCommand() {
        if (!panelUser || (!profileCommandDefinition && !selectedModuleLiveAction)) {
            setNotice({ type: 'error', text: 'Choose a command before running it.' });
            return;
        }

        if (selectedModuleLiveAction) {
            setActionLoading(selectedModuleLiveAction.id);
            setNotice(null);
            try {
                const response = await fetch('/api/dashboard/modules/live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serverId: guildId,
                        moduleId: selectedModuleLiveAction.moduleId,
                        fieldKey: selectedModuleLiveAction.fieldKey,
                        value: {
                            username: panelProfileDetails?.robloxUser?.username || panelProfile?.username || panelUser.username,
                            displayName: panelProfileDetails?.robloxUser?.displayName || panelProfile?.displayName || panelUser.displayName,
                            userId: panelProfileDetails?.robloxUser?.id || panelProfile?.id || panelUser.userId,
                            jobId: panelUser.serverId,
                            source: 'live-panel-profile',
                        },
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    setNotice({ type: 'error', text: trimString(payload.error) || 'Failed to run module action.' });
                    return;
                }

                setNotice({ type: 'success', text: `${selectedModuleLiveAction.label} queued for ${panelUser.username}.` });
                await loadUserLogs(panelUser, panelProfileDetails);
            } catch (error) {
                setNotice({ type: 'error', text: `Failed to run module action: ${String(error)}` });
            } finally {
                setActionLoading(null);
            }
            return;
        }

        if (!profileCommandDefinition) {
            return;
        }

        const command = profileCommandDefinition;
        const value = profileCommandValue.trim();
        const args: Record<string, unknown> = {
            username: panelProfileDetails?.robloxUser?.username || panelProfile?.username || panelUser.username,
            reason: 'Live Panel profile action',
        };

        if (panelUser.serverId) {
            args.job_id = panelUser.serverId;
        }

        if (VALUE_COMMAND_SET.has(command.id)) {
            if (!value || !Number.isFinite(Number(value))) {
                setNotice({ type: 'error', text: `Add a numeric value for ${command.label}.` });
                return;
            }
            args.amount = value;
        } else if (command.id === 'SET_CHAR') {
            if (!value) {
                setNotice({ type: 'error', text: 'Add the character username to copy.' });
                return;
            }
            args.char_user = value;
            args.reason = `Set character to ${value}`;
        } else if (command.id === 'TEAM') {
            if (!value) {
                setNotice({ type: 'error', text: 'Add the Roblox team name.' });
                return;
            }
            args.team_name = value;
            args.reason = `Set team to ${value}`;
        } else if (value) {
            args.reason = value;
        }

        const sent = await sendCommand(command.id, args, `${command.label} queued for ${args.username}.`);
        if (sent) {
            setProfileCommandValue('');
            await loadUserLogs(panelUser, panelProfileDetails);
        }
    }

    function openReportTargetProfile() {
        if (!selectedReport) return;

        const targetUsername = trimString(selectedReportProfile?.roblox_username) || trimString(selectedReport.reported_roblox_username);
        if (!targetUsername) {
            setReportsNotice({ type: 'error', text: 'This report does not have a usable target.' });
            return;
        }

        setRightPaneMode('lookup');
        selectProfileUser(resolveUserFromText(targetUsername));
    }

    async function patchSelectedReportStatus(status: ReportStatus, defaultNote: string) {
        if (!selectedReportId) return null;

        const moderatorNote = reportModeratorNote.trim() || defaultNote;
        const response = await fetch(`/api/reports/${encodeURIComponent(selectedReportId)}?serverId=${encodeURIComponent(guildId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                moderatorNote,
            }),
        });
        const payload = await response.json().catch(() => ({})) as LiveReport & { error?: string };

        if (!response.ok) {
            throw new Error(payload.error || 'Failed to update report.');
        }

        return payload;
    }

    async function updateSelectedReportStatus(status: ReportStatus) {
        if (!selectedReport) return;

        const isClosing = status === 'RESOLVED' || status === 'DISMISSED';
        if (isClosing && !window.confirm(`${status === 'RESOLVED' ? 'Resolve' : 'Dismiss'} report #${shortReportId(selectedReport.id)}?`)) {
            return;
        }

        setReportActionLoading(status);
        setReportsNotice(null);

        try {
            const updatedReport = await patchSelectedReportStatus(
                status,
                status === 'RESOLVED' ? 'Resolved from Live Panel reports manager' : status === 'DISMISSED' ? 'Dismissed from Live Panel reports manager' : 'Reopened from Live Panel reports manager',
            );

            if (updatedReport) {
                setSelectedReport(updatedReport);
                setReportModeratorNote(trimString(updatedReport.moderator_note));
                setReportsNotice({ type: 'success', text: `Report #${shortReportId(updatedReport.id)} marked ${status.toLowerCase()}.` });
                await Promise.all([
                    loadPanel(false),
                    loadPanelReports(reportStatusFilter),
                ]);

                if (reportStatusFilter !== 'ALL' && reportStatusFilter !== status) {
                    setSelectedReportId(null);
                }
            }
        } catch (error) {
            setReportsNotice({ type: 'error', text: error instanceof Error ? error.message : String(error) });
        } finally {
            setReportActionLoading(null);
        }
    }

    async function runReportModerationAction(command: 'KICK' | 'BAN' | 'SOFTBAN') {
        if (!selectedReport) return;

        if (!canUseDashboardCommand(perms, command)) {
            setReportsNotice({ type: 'error', text: `You do not have permission to use ${command}.` });
            return;
        }

        const targetIsDiscordId = DISCORD_ID_PATTERN.test(trimString(selectedReport.reported_roblox_username));
        const targetUsername = trimString(selectedReportProfile?.roblox_username) || trimString(selectedReport.reported_roblox_username);

        if (targetIsDiscordId && !selectedReportProfile?.roblox_username) {
            setReportsNotice({ type: 'error', text: 'This report targets an unlinked Discord ID, so Roblox moderation commands cannot be applied.' });
            return;
        }

        if (!targetUsername) {
            setReportsNotice({ type: 'error', text: 'This report does not have a usable Roblox target.' });
            return;
        }

        if (!window.confirm(`${command} ${targetUsername} and resolve report #${shortReportId(selectedReport.id)}?`)) {
            return;
        }

        setReportActionLoading(command);
        setReportsNotice(null);

        const actionReason = reportModeratorNote.trim() || `Re: Report #${shortReportId(selectedReport.id)} - ${selectedReport.reason}`;

        try {
            const commandResponse = await fetch('/api/dashboard/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: guildId,
                    command,
                    args: {
                        username: targetUsername,
                        reason: actionReason,
                        ...(selectedReport.reported_live_server_id ? { job_id: selectedReport.reported_live_server_id } : {}),
                    },
                }),
            });
            const commandPayload = await commandResponse.json().catch(() => ({})) as { error?: string; warning?: string };

            if (!commandResponse.ok) {
                setReportsNotice({ type: 'error', text: commandPayload.error || 'Failed to send moderation command.' });
                return;
            }

            const updatedReport = await patchSelectedReportStatus('RESOLVED', `Action: ${command} - ${actionReason}`);
            if (updatedReport) {
                setSelectedReport(updatedReport);
                setReportModeratorNote(trimString(updatedReport.moderator_note));
                setReportsNotice({
                    type: 'success',
                    text: commandPayload.warning || `${command} queued for ${targetUsername} and report #${shortReportId(updatedReport.id)} resolved.`,
                });
                await Promise.all([
                    loadPanel(false),
                    loadPanelReports(reportStatusFilter),
                ]);

                if (reportStatusFilter !== 'ALL' && reportStatusFilter !== 'RESOLVED') {
                    setSelectedReportId(null);
                }
            }
        } catch (error) {
            setReportsNotice({ type: 'error', text: error instanceof Error ? error.message : String(error) });
        } finally {
            setReportActionLoading(null);
        }
    }

    const quickActions = [
        { command: 'REFRESH', label: 'Refresh', icon: <RefreshIcon />, tone: 'text-sky-300 hover:border-sky-400/50 hover:bg-sky-500/10' },
        { command: 'RESET', label: 'Reset', icon: <ResetIcon />, tone: 'text-indigo-300 hover:border-indigo-400/50 hover:bg-indigo-500/10' },
        { command: 'KICK', label: 'Kick', icon: <KickIcon />, tone: 'text-amber-300 hover:border-amber-400/50 hover:bg-amber-500/10' },
        { command: 'BAN', label: 'Ban', icon: <BanIcon />, tone: 'text-red-300 hover:border-red-400/50 hover:bg-red-500/10' },
        { command: 'SOFTBAN', label: 'Temp Ban', icon: <TempBanIcon />, tone: 'text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10' },
    ].filter((action) => canUseDashboardCommand(perms, action.command));
    const selectedReportStatus = getReportStatus(selectedReport);
    const selectedReportTargetUsername = trimString(selectedReportProfile?.roblox_username) || trimString(selectedReport?.reported_roblox_username);
    const selectedReportTargetId = trimString(selectedReportProfile?.roblox_id);
    const selectedReportDiscordId = trimString(selectedReportProfile?.discord_id);
    const canRunCommands = availableCommands.length > 0;
    const canAnnounce = canUseDashboardCommand(perms, 'BROADCAST');
    const canRestartServers = canUseDashboardCommand(perms, 'UPDATE');
    const canShutdownServers = canUseDashboardCommand(perms, 'SHUTDOWN');

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#020617]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#020617] text-slate-200">
            <header className="shrink-0 border-b border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/20">
                <div className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-800 bg-slate-900/70 px-4 py-2">
                    <div />
                    <div className="text-center text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                        Live Operations
                    </div>
                    <Link
                        href="/dashboard"
                        className="justify-self-end rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:border-sky-400/50 hover:text-white"
                    >
                        Exit
                    </Link>
                </div>
                <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <img
                            src={session?.user?.image || '/Media/Ro-LinkIcon.png'}
                            alt=""
                            className="h-16 w-16 rounded-2xl border border-sky-500/25 bg-slate-900 object-cover p-0.5 shadow-lg shadow-sky-950/30"
                        />
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300">Live Panel</p>
                            <h1 className="mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">
                                Welcome {session?.user?.name || 'Moderator'}
                            </h1>
                            <p className="mt-1 truncate text-sm font-medium text-slate-400">{serverName}</p>
                        </div>
                    </div>

                    <div className={`grid gap-3 lg:min-w-[390px] ${canManageReports ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                        <div className="rounded-xl border border-slate-800 bg-black/20 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Servers</p>
                            <p className="mt-1 text-2xl font-black text-white">{enrichedServers.length}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-black/20 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Users</p>
                            <p className="mt-1 text-2xl font-black text-emerald-400">{totalPlayers}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-black/20 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Logs</p>
                            <p className="mt-1 text-2xl font-black text-sky-300">{logs.length}</p>
                        </div>
                        {canManageReports && (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reports</p>
                                <p className="mt-1 text-2xl font-black text-amber-300">{pendingReports.length}</p>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {notice && (
                <div className={`shrink-0 border-b px-4 py-3 text-sm font-semibold ${notice.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/20 bg-red-500/10 text-red-300'
                    }`}>
                    {notice.text}
                </div>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(300px,0.92fr)_minmax(380px,1.08fr)]">
                <section className="flex min-h-0 flex-col overflow-hidden border-b border-slate-800 bg-slate-950/20 md:border-b-0 md:border-r">
                    <div className="shrink-0 border-b border-slate-800 bg-slate-950/30 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest text-white">Quick Actions</h2>
                                <p className="mt-1 text-xs font-medium text-slate-500">Run global tools or target a user from the lists below.</p>
                            </div>
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                                Live
                            </span>
                        </div>
                        <div className={`mt-4 grid gap-3 ${canRunCommands && canAnnounce ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {canRunCommands && (
                                <button
                                    type="button"
                                    onClick={() => setPanelModal('command')}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:border-sky-400/50 hover:bg-sky-500/15"
                                >
                                    <CommandIcon />
                                    Run Command
                                </button>
                            )}
                            {canAnnounce && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAnnouncementTargetType('');
                                        setAnnouncementUser('');
                                        setPanelModal('announce');
                                    }}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-sky-100 transition-all hover:border-sky-300/60 hover:bg-sky-500/20"
                                >
                                    <AnnounceIcon />
                                    Announce
                                </button>
                            )}
                            {!canRunCommands && !canAnnounce && (
                                <div className="rounded-xl border border-slate-800 bg-black/20 px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                    No live commands available
                                </div>
                            )}
                        </div>
                    </div>

                    {canManageReports && (
                        <div className="shrink-0 border-b border-slate-800 bg-amber-500/[0.03] p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-amber-200">
                                    <ReportIcon />
                                    <h2 className="text-sm font-black uppercase tracking-widest">Unmoderated Reports</h2>
                                    <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-300">{pendingReports.length}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        clearSelectedProfile();
                                        setRightPaneMode('reports');
                                    }}
                                    className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-200 transition-colors hover:border-amber-300/50 hover:bg-amber-500/20"
                                >
                                    Manage
                                </button>
                            </div>

                            {pendingReports.length === 0 ? (
                                <p className="mt-3 text-xs font-medium text-slate-500">No reports are awaiting moderation.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {pendingReports.slice(0, 3).map((report) => (
                                        <button
                                            key={report.id}
                                            type="button"
                                            onClick={() => {
                                                clearSelectedProfile();
                                                setRightPaneMode('reports');
                                                setReportStatusFilter('PENDING');
                                                setSelectedReportId(report.id);
                                            }}
                                            className="block w-full rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-left transition-colors hover:border-amber-400/40 hover:bg-amber-500/5"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="min-w-0 truncate text-xs font-black text-white">{report.reported_roblox_username}</span>
                                                <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{formatTime(report.created_at)}</span>
                                            </div>
                                            <p className="mt-1 truncate text-xs font-medium text-slate-400">{report.reason}</p>
                                            <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-slate-600">By {report.reporter_roblox_username || report.reporter_discord_id || 'Unknown'}</p>
                                        </button>
                                    ))}
                                    {pendingReports.length > 3 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                clearSelectedProfile();
                                                setRightPaneMode('reports');
                                                setReportStatusFilter('PENDING');
                                            }}
                                            className="block w-full pt-1 text-right text-[10px] font-black uppercase tracking-widest text-amber-300 transition-colors hover:text-amber-100"
                                        >
                                            View all {pendingReports.length} reports
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="shrink-0 border-b border-slate-800 p-5">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-sm font-black uppercase tracking-widest text-white">Live Servers</h2>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Update: 7s</span>
                            </div>
                            <input
                                value={serverSearch}
                                onChange={(event) => setServerSearch(event.target.value)}
                                placeholder="Search servers, users, user IDs"
                                className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"
                            />
                        </div>

                        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
                            {filteredServers.length === 0 ? (
                                <div className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                    No live servers matched.
                                </div>
                            ) : (
                                <div>
                                    {filteredServers.map((server) => {
                                        const joinUrl = buildJoinUrl(placeId, server.id);
                                        return (
                                            <div key={server.id} className="m-3 rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4 shadow-inner shadow-black/20 transition-all hover:border-sky-400/40 hover:bg-sky-500/5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setServerSearch(server.id)}
                                                            className="block max-w-full truncate text-left font-mono text-xs font-black uppercase tracking-wider text-white hover:text-sky-200"
                                                        >
                                                            {formatServerId(server.id)}
                                                        </button>
                                                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                                                            {server.visiblePlayerCount} player{server.visiblePlayerCount === 1 ? '' : 's'} active, last pulse {formatTime(server.updated_at)}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        {joinUrl ? (
                                                            <a
                                                                href={joinUrl}
                                                                className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/15 text-emerald-300 transition-all hover:border-emerald-300 hover:bg-emerald-500/25"
                                                            >
                                                                <PlayIcon />
                                                                <ActionTooltip label="Join Server" />
                                                            </a>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                disabled
                                                                className="group relative flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-600"
                                                            >
                                                                <PlayIcon />
                                                                <ActionTooltip label="Set Place ID to Join" />
                                                            </button>
                                                        )}
                                                        {canRestartServers && (
                                                            <button
                                                                type="button"
                                                                aria-label={`Restart server ${formatServerId(server.id)}`}
                                                                onClick={() => sendServerLifecycleCommand(server.id, 'UPDATE')}
                                                                disabled={actionLoading === 'UPDATE'}
                                                                className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 transition-all hover:border-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600"
                                                            >
                                                                <ServerRestartIcon />
                                                                <ActionTooltip label="Restart Server" />
                                                            </button>
                                                        )}
                                                        {canShutdownServers && (
                                                            <button
                                                                type="button"
                                                                aria-label={`Shut down server ${formatServerId(server.id)}`}
                                                                onClick={() => sendServerLifecycleCommand(server.id, 'SHUTDOWN')}
                                                                disabled={actionLoading === 'SHUTDOWN'}
                                                                className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 transition-all hover:border-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600"
                                                            >
                                                                <ServerShutdownIcon />
                                                                <ActionTooltip label="Shut Down Server" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {server.players.length > 0 ? (
                                                        server.players.map((player) => (
                                                            <UserAvatarButton
                                                                key={`${server.id}-${getUserKey(player)}`}
                                                                user={player}
                                                                compact
                                                                onClick={() => selectProfileUser(player)}
                                                            />
                                                        ))
                                                    ) : (
                                                        <span className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-500">
                                                            Legacy bridge payload has no user profiles.
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden bg-slate-950/10">
                    {panelUser ? (
                        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300">User Profile</p>
                                    <h2 className="mt-1 text-xl font-black text-white">Live Panel Profile</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearSelectedProfile}
                                    className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-slate-500 transition-colors hover:text-white"
                                >
                                    <CloseIcon />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                                    <div className="flex items-center gap-4">
                                        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-indigo-500/25 bg-indigo-500/10">
                                            {panelProfileDetails?.discordUser?.avatarUrl ? (
                                                <img src={panelProfileDetails.discordUser.avatarUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="flex h-full w-full items-center justify-center text-xl font-black text-indigo-200">
                                                    {(panelProfileDetails?.discordUser?.globalName || panelProfileDetails?.discordUser?.username || panelUser.username).slice(0, 1).toUpperCase()}
                                                </span>
                                            )}
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="truncate text-lg font-black text-white">
                                                {panelProfileDetails?.discordMember?.nick || panelProfileDetails?.discordUser?.globalName || panelProfileDetails?.discordUser?.username || 'Discord user not linked'}
                                            </h3>
                                            <p className="truncate text-sm font-semibold text-slate-400">
                                                {panelProfileDetails?.discordUser?.username ? `@${panelProfileDetails.discordUser.username}` : 'Using Roblox identity only'}
                                            </p>
                                            <p className="mt-1 truncate font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                {panelProfileDetails?.discordUser?.id || (profileDetailsLoadingKey === getUserKey(panelUser) ? 'Loading Discord info' : 'No Discord ID')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Linked</p>
                                            <p className={`mt-1 text-sm font-black ${panelProfileDetails?.linked ? 'text-emerald-300' : 'text-slate-400'}`}>
                                                {panelProfileDetails?.linked ? 'Verified' : 'Roblox only'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Top Role</p>
                                            <p className="mt-1 truncate text-sm font-black text-white" style={{ color: panelProfileDetails?.discordMember?.highestRole?.color || undefined }}>
                                                {panelProfileDetails?.discordMember?.highestRole?.name || 'None'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar user={panelUser} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-black text-white">{panelProfileDetails?.robloxUser?.displayName || panelProfile?.displayName || panelUser.displayName}</p>
                                            <p className="truncate text-xs font-semibold text-slate-500">@{panelProfileDetails?.robloxUser?.username || panelProfile?.username || panelUser.username}</p>
                                        </div>
                                        <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${panelUser.presence === 'live' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 bg-black/20 text-slate-400'}`}>
                                            {presenceLabel(panelUser)}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Roblox ID</p>
                                            <p className="mt-1 truncate font-mono text-xs font-bold text-sky-300">{panelProfileDetails?.robloxUser?.id || panelProfile?.id || panelUser.userId || 'Unknown'}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Server</p>
                                            <p className="mt-1 truncate font-mono text-xs font-bold text-white">{panelUser.serverId ? formatServerId(panelUser.serverId) : 'Not live'}</p>
                                        </div>
                                    </div>
                                </div>

                                {quickActions.length > 0 && (
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Moderation Actions</p>
                                        <div className="flex flex-wrap gap-2">
                                            {quickActions.map((action) => {
                                                const disabled = (action.command === 'KICK' || action.command === 'REFRESH' || action.command === 'RESET') && panelUser.presence !== 'live';
                                                return (
                                                    <button
                                                        key={action.command}
                                                        type="button"
                                                        disabled={disabled || actionLoading === action.command}
                                                        onClick={() => requestPlayerCommand(action.command, panelUser)}
                                                        className={`group relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 transition-all disabled:cursor-not-allowed disabled:opacity-35 ${action.tone}`}
                                                    >
                                                        {action.icon}
                                                        <ActionTooltip label={action.label} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Misc / Module Command</p>
                                    <div className="space-y-3">
                                        <select
                                            value={profileCommand}
                                            onChange={(event) => {
                                                setProfileCommand(event.target.value);
                                                setProfileCommandValue('');
                                            }}
                                            className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none focus:border-sky-500/60"
                                        >
                                            <option value="">Choose a command</option>
                                            {profileCommandOptions.length > 0 && (
                                                <optgroup label="Misc commands">
                                                    {profileCommandOptions.map((command) => (
                                                        <option key={command.id} value={command.id}>{command.label}</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            {moduleLiveActions.length > 0 && (
                                                <optgroup label="Module commands">
                                                    {moduleLiveActions.map((action) => (
                                                        <option key={action.id} value={action.id}>{action.moduleName} - {action.label}</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                        {profileCommandNeedsValue && (
                                            <input
                                                value={profileCommandValue}
                                                onChange={(event) => setProfileCommandValue(event.target.value)}
                                                placeholder={profileCommandDefinition?.id === 'SET_CHAR'
                                                    ? 'Character username'
                                                    : profileCommandDefinition?.id === 'TEAM'
                                                        ? 'Roblox team name'
                                                        : profileCommandDefinition?.id === 'BROADCAST'
                                                            ? 'Message'
                                                            : 'Value or note'}
                                                className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500/60"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            disabled={!profileCommand || actionLoading === profileCommand}
                                            onClick={submitProfileCommand}
                                            className="w-full rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-all hover:bg-sky-500/20 disabled:opacity-50"
                                        >
                                            {profileCommand && actionLoading === profileCommand ? 'Running...' : 'Run On User'}
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Staff Note</h3>
                                    <textarea
                                        value={noteText}
                                        onChange={(event) => setNoteText(event.target.value)}
                                        rows={3}
                                        placeholder={`Write a private staff note for ${panelUser.username}`}
                                        className="mt-3 w-full resize-none rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500/60"
                                    />
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            type="button"
                                            disabled={actionLoading === 'note'}
                                            onClick={() => saveUserNote('note')}
                                            className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-sky-200 transition-all hover:bg-sky-500/20 disabled:opacity-50"
                                        >
                                            {actionLoading === 'note' ? 'Saving...' : 'Save Note'}
                                        </button>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {staffNotesLoading ? (
                                            <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs font-semibold text-slate-500">Loading notes...</div>
                                        ) : staffNotes.length > 0 ? staffNotes.map((note) => (
                                            <div key={note.id} className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                <p className="whitespace-pre-wrap text-xs leading-5 text-slate-300">{note.note}</p>
                                                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                    By {note.created_by_tag || note.created_by_discord_id || 'Unknown'} on {new Date(note.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        )) : (
                                            <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs font-semibold text-slate-500">No staff notes for this user.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white">User Logs</h3>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            {profileLogsLoading ? 'Loading' : `${profileLogEntries.length} shown`}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {panelUser.presence === 'live' && (
                                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-200">Joined</span>
                                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">{panelUser.joinedAt ? formatTime(new Date(panelUser.joinedAt).toISOString()) : panelUser.serverId ? formatServerId(panelUser.serverId) : 'Live'}</span>
                                                </div>
                                                <p className="mt-1 text-xs font-medium text-emerald-100/70">{panelUser.joinedAt ? 'Current join time from the tracked live roster.' : 'Currently connected to a tracked live server.'}</p>
                                            </div>
                                        )}
                                        {panelUser.presence === 'recently-left' && (
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs font-black uppercase tracking-widest text-amber-200">Left</span>
                                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">{panelUser.leftAt ? formatTime(new Date(panelUser.leftAt).toISOString()) : 'Recent'}</span>
                                                </div>
                                                <p className="mt-1 text-xs font-medium text-amber-100/70">Recently disappeared from the live server roster.</p>
                                            </div>
                                        )}
                                        {profileLogEntries.map((log) => (
                                            <div key={log.id} className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs font-black uppercase tracking-widest text-white">{log.action}</span>
                                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{formatTime(log.timestamp)}</span>
                                                </div>
                                                <p className="mt-1 text-xs font-medium text-slate-400">
                                                    Target <ClickableUserText value={log.target} onOpen={() => selectProfileUser(resolveUserFromText(log.target))} /> by <ClickableUserText value={log.moderator} onOpen={() => selectProfileUser(resolveUserFromText(log.moderator))} />
                                                </p>
                                            </div>
                                        ))}
                                        {profileLogEntries.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs font-semibold text-slate-500">
                                                No logs targeting this user were found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : rightPaneMode === 'reports' && canManageReports ? (
                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="shrink-0 border-b border-slate-800 bg-slate-950/30 p-5">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">Reports Manager</p>
                                        <h2 className="mt-1 text-xl font-black text-white">Live Reports</h2>
                                        <p className="mt-1 text-xs font-medium text-slate-500">Review player reports without leaving live operations.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setRightPaneMode('lookup')}
                                        className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-300 transition-colors hover:border-sky-400/50 hover:text-white"
                                    >
                                        Lookup
                                    </button>
                                </div>

                                <div className="mt-4">
                                    <input
                                        value={reportSearch}
                                        onChange={(event) => setReportSearch(event.target.value)}
                                        placeholder="Search reports"
                                        className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10"
                                    />
                                </div>

                                {reportsNotice && (
                                    <div className={`mt-4 rounded-xl border px-4 py-3 text-xs font-semibold ${reportsNotice.type === 'success'
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                        : 'border-red-500/20 bg-red-500/10 text-red-300'
                                        }`}>
                                        {reportsNotice.text}
                                    </div>
                                )}
                            </div>

                            <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(240px,0.8fr)_minmax(340px,1.2fr)]">
                                <div className="custom-scrollbar min-h-0 overflow-y-auto border-b border-slate-800 xl:border-b-0 xl:border-r">
                                    {reportsLoading ? (
                                        <div className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">Loading reports...</div>
                                    ) : filteredPanelReports.length === 0 ? (
                                        <div className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">No reports matched.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-800/70">
                                            {filteredPanelReports.map((report) => {
                                                const status = getReportStatus(report);
                                                const selected = selectedReportId === report.id;
                                                return (
                                                    <button
                                                        key={report.id}
                                                        type="button"
                                                        onClick={() => setSelectedReportId(report.id)}
                                                        className={`block w-full px-5 py-4 text-left transition-colors ${selected ? 'bg-amber-500/10' : 'hover:bg-amber-500/5'}`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-black text-white">{report.reported_roblox_username}</p>
                                                                <p className="mt-1 truncate font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">#{shortReportId(report.id)}</p>
                                                            </div>
                                                            <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${reportStatusClass(status)}`}>
                                                                {status.toLowerCase()}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{report.reason}</p>
                                                        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                                            <span className="min-w-0 truncate">By {getReportReporterLabel(report)}</span>
                                                            <span className="shrink-0">{formatTime(report.created_at)}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="custom-scrollbar min-h-0 overflow-y-auto p-5">
                                    {reportDetailLoading ? (
                                        <div className="flex min-h-72 items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-600">Loading report details...</div>
                                    ) : selectedReport ? (
                                        <div className="space-y-4">
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Report #{shortReportId(selectedReport.id)}</p>
                                                        <h3 className="mt-1 truncate text-xl font-black text-white">{selectedReportTargetUsername || 'Unknown target'}</h3>
                                                        <p className="mt-1 text-xs font-semibold text-slate-500">Submitted {formatDateTime(selectedReport.created_at)}</p>
                                                    </div>
                                                    <span className={`w-fit rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${reportStatusClass(selectedReportStatus)}`}>
                                                        {selectedReportStatus.toLowerCase()}
                                                    </span>
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 gap-3">
                                                    <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reporter</p>
                                                        <p className="mt-1 truncate text-sm font-black text-white">{getReportReporterLabel(selectedReport)}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Roblox ID</p>
                                                        <p className="mt-1 truncate font-mono text-xs font-bold text-sky-300">{selectedReportTargetId || 'Unknown'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Discord</p>
                                                        <p className="mt-1 truncate font-mono text-xs font-bold text-indigo-300">{selectedReportDiscordId || selectedReport.reported_roblox_username || 'Unknown'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Closed</p>
                                                        <p className="mt-1 truncate text-xs font-bold text-slate-300">{selectedReport.resolved_at ? formatDateTime(selectedReport.resolved_at) : 'Open'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Report Evidence</h3>
                                                    <button
                                                        type="button"
                                                        onClick={openReportTargetProfile}
                                                        disabled={!selectedReportTargetUsername}
                                                        className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Target Profile
                                                    </button>
                                                </div>
                                                <p className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-black/20 p-4 text-sm leading-6 text-slate-300">{selectedReport.reason || 'No reason provided.'}</p>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                                {[
                                                    {
                                                        label: 'Reporter server',
                                                        jobId: selectedReport.reporter_live_server_id,
                                                        joinUrl: selectedReport.reporter_join_url,
                                                    },
                                                    {
                                                        label: 'Reported user server',
                                                        jobId: selectedReport.reported_live_server_id,
                                                        joinUrl: selectedReport.reported_join_url,
                                                    },
                                                ].map((serverContext) => (
                                                    <div key={serverContext.label} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{serverContext.label}</p>
                                                        {serverContext.jobId ? (
                                                            <>
                                                                <p className="mt-2 break-all font-mono text-xs text-slate-300">{serverContext.jobId}</p>
                                                                {serverContext.joinUrl && (
                                                                    <a
                                                                        href={serverContext.joinUrl}
                                                                        className="mt-3 inline-flex rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-500/20"
                                                                    >
                                                                        Join server
                                                                    </a>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="mt-2 text-xs font-medium text-slate-500">No live server snapshot was captured.</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                                <h3 className="text-sm font-black uppercase tracking-widest text-white">Moderator Note</h3>
                                                <textarea
                                                    value={reportModeratorNote}
                                                    onChange={(event) => setReportModeratorNote(event.target.value)}
                                                    rows={3}
                                                    placeholder="Add an internal note before resolving or dismissing"
                                                    className="mt-3 w-full resize-none rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-500/60"
                                                />
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {(['KICK', 'SOFTBAN', 'BAN'] as const)
                                                        .filter((command) => canUseDashboardCommand(perms, command))
                                                        .map((command) => (
                                                            <button
                                                                key={command}
                                                                type="button"
                                                                disabled={reportActionLoading !== null}
                                                                onClick={() => runReportModerationAction(command)}
                                                                className={`rounded-xl border px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${command === 'BAN'
                                                                    ? 'border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/20'
                                                                    : command === 'SOFTBAN'
                                                                        ? 'border-rose-500/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                                                                        : 'border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                                                                    }`}
                                                            >
                                                                {reportActionLoading === command
                                                                    ? 'Running...'
                                                                    : `${command === 'SOFTBAN' ? 'Temp Ban' : command.charAt(0) + command.slice(1).toLowerCase()} & Resolve`}
                                                            </button>
                                                        ))}
                                                    {selectedReportStatus !== 'RESOLVED' && (
                                                        <button
                                                            type="button"
                                                            disabled={reportActionLoading !== null}
                                                            onClick={() => updateSelectedReportStatus('RESOLVED')}
                                                            className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {reportActionLoading === 'RESOLVED' ? 'Saving...' : 'Resolve'}
                                                        </button>
                                                    )}
                                                    {selectedReportStatus !== 'DISMISSED' && (
                                                        <button
                                                            type="button"
                                                            disabled={reportActionLoading !== null}
                                                            onClick={() => updateSelectedReportStatus('DISMISSED')}
                                                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {reportActionLoading === 'DISMISSED' ? 'Saving...' : 'Dismiss'}
                                                        </button>
                                                    )}
                                                    {selectedReportStatus !== 'PENDING' && (
                                                        <button
                                                            type="button"
                                                            disabled={reportActionLoading !== null}
                                                            onClick={() => updateSelectedReportStatus('PENDING')}
                                                            className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {reportActionLoading === 'PENDING' ? 'Saving...' : 'Reopen'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Target History</h3>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{selectedReportLogs.length} shown</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {selectedReportLogs.slice(0, 12).map((log) => (
                                                        <div key={log.id} className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-xs font-black uppercase tracking-widest text-white">{log.action}</span>
                                                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{formatTime(log.timestamp)}</span>
                                                            </div>
                                                            <p className="mt-1 text-xs font-medium text-slate-400">
                                                                Target <ClickableUserText value={log.target} onOpen={() => {
                                                                    setRightPaneMode('lookup');
                                                                    selectProfileUser(resolveUserFromText(log.target));
                                                                }} /> by <ClickableUserText value={log.moderator} onOpen={() => {
                                                                    setRightPaneMode('lookup');
                                                                    selectProfileUser(resolveUserFromText(log.moderator));
                                                                }} />
                                                            </p>
                                                        </div>
                                                    ))}
                                                    {selectedReportLogs.length === 0 && (
                                                        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs font-semibold text-slate-500">
                                                            No moderation history found for this target.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                            Select a report to review.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                    <div className="shrink-0 border-b border-slate-800 bg-slate-950/30 p-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                                Profile / Create Log
                            </h2>
                        </div>
                        <div className="relative">
                            <input
                                value={profileSearch}
                                onChange={(event) => setProfileSearch(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        selectTypedProfile();
                                    }
                                }}
                                placeholder="Search profile, create a user log, or add a note"
                                className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"
                            />
                            {profileSearch.trim() && suggestions.length > 0 && !selectedProfileUser && (
                                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
                                    {suggestions.map(({ user, reason }) => (
                                        <button
                                            type="button"
                                            key={getUserKey(user)}
                                            onClick={() => selectProfileUser(user)}
                                            className="flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-sky-500/10"
                                        >
                                            <UserAvatar user={user} compact />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold text-white">{user.displayName}</span>
                                                <span className="block truncate text-xs font-medium text-slate-500">@{user.username}</span>
                                            </span>
                                            <span className="hidden shrink-0 rounded-lg border border-slate-800 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 sm:block">
                                                {reason}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <h2 className="mb-2 mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                            Live Logs
                        </h2>
                        <input
                            value={logSearch}
                            onChange={(event) => setLogSearch(event.target.value)}
                            placeholder="Search logs by server, user, action, or moderator"
                            className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"
                        />
                    </div>

                    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
                        {filteredLogs.length === 0 ? (
                            <div className="p-16 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                No logs matched.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800/70">
                                {filteredLogs.map((log) => (
                                    <div key={log.id} className="grid gap-3 px-5 py-3 transition-colors hover:bg-sky-500/5 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)_120px] md:items-center">
                                        <div className="min-w-0">
                                            <span className={`inline-flex max-w-full truncate rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${log.action.includes('BAN')
                                                ? 'border-red-500/20 bg-red-500/10 text-red-300'
                                                : log.action === 'KICK'
                                                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                                    : 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </div>
                                        <p className="min-w-0 text-sm font-medium text-slate-300">
                                            <ClickableUserText value={log.moderator} onOpen={() => selectProfileUser(resolveUserFromText(log.moderator))} /> used <span className="font-bold text-sky-300">{log.action}</span> on <ClickableUserText value={log.target} onOpen={() => selectProfileUser(resolveUserFromText(log.target))} />
                                        </p>
                                        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-right">
                                            {formatTime(log.timestamp)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                        </>
                    )}
                </section>
            </div>

            {confirmAction && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#020617] p-6 shadow-2xl">
                        <h3 className="text-xl font-black text-white">{confirmAction.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-400">{confirmAction.body}</p>
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                className="rounded-xl border border-slate-800 px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitConfirmAction}
                                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {panelModal && (
                <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-[#020617] shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900/60 px-6 py-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300">{panelModal === 'announce' ? 'Announcement' : 'Command Runner'}</p>
                                <h3 className="mt-1 text-xl font-black text-white">{panelModal === 'announce' ? 'Announce to Live Servers' : 'Run Live Command'}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPanelModal(null)}
                                className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-slate-500 transition-colors hover:text-white"
                            >
                                <CloseIcon />
                            </button>
                        </div>
                        <div className="space-y-4 px-6 py-6">
                            {panelModal === 'announce' ? (
                                <>
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Target</p>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAnnouncementTargetType('global');
                                                    setAnnouncementUser('');
                                                }}
                                                className={`rounded-xl border px-4 py-3 text-left transition-all ${announcementTargetType === 'global' ? 'border-sky-400/60 bg-sky-500/10 text-white' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'}`}
                                            >
                                                <span className="block text-sm font-black">Global</span>
                                                <span className="mt-1 block text-xs font-medium text-slate-500">Everybody playing the game, every server.</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAnnouncementTargetType('user')}
                                                className={`rounded-xl border px-4 py-3 text-left transition-all ${announcementTargetType === 'user' ? 'border-sky-400/60 bg-sky-500/10 text-white' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'}`}
                                            >
                                                <span className="block text-sm font-black">User</span>
                                                <span className="mt-1 block text-xs font-medium text-slate-500">One live Roblox player.</span>
                                            </button>
                                        </div>
                                    </div>
                                    {announcementTargetType === 'user' && (
                                        <div className="space-y-3">
                                            <input
                                                value={announcementUser}
                                                onChange={(event) => setAnnouncementUser(event.target.value)}
                                                placeholder="Search or type a live Roblox username"
                                                className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-sky-500/60"
                                            />
                                            {announcementUserSuggestions.length > 0 && (
                                                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                                                    {announcementUserSuggestions.map((user) => (
                                                        <button
                                                            key={getUserKey(user)}
                                                            type="button"
                                                            onClick={() => setAnnouncementUser(user.username)}
                                                            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sky-500/10"
                                                        >
                                                            <span className="min-w-0">
                                                                <span className="block truncate text-sm font-black text-white">{user.displayName || user.username}</span>
                                                                <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">@{user.username}</span>
                                                            </span>
                                                            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">{formatServerId(user.serverId || '')}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <textarea
                                        value={announcement}
                                        onChange={(event) => setAnnouncement(event.target.value)}
                                        rows={5}
                                        placeholder="Message to send"
                                        className="w-full resize-none rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500/60"
                                    />
                                    <button
                                        type="button"
                                        onClick={submitAnnouncement}
                                        disabled={actionLoading === 'BROADCAST'}
                                        className="w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-sky-500 disabled:opacity-50"
                                    >
                                        {actionLoading === 'BROADCAST' ? 'Sending...' : 'Send Announcement'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="rounded-2xl border border-sky-500/25 bg-slate-950/70 px-4 py-3 shadow-inner shadow-black/30 focus-within:border-sky-400/70">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sky-300">
                                                <CommandIcon />
                                            </span>
                                            <input
                                                autoFocus
                                                value={commandBarValue}
                                                onChange={(event) => setCommandBarValue(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        submitManualCommand();
                                                    }
                                                }}
                                                placeholder="refresh username"
                                                className="min-w-0 flex-1 bg-transparent text-base font-bold text-white outline-none placeholder:text-slate-600"
                                            />
                                            {commandBarParsed.command && (
                                                <span className="hidden rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-sky-200 sm:inline-flex">
                                                    {commandBarParsed.command.id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {commandBarSuggestions.length > 0 && (
                                        <div className="max-h-72 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
                                            <div className="custom-scrollbar max-h-72 overflow-y-auto p-2">
                                                {commandBarSuggestions.map((suggestion, index) => (
                                                    <button
                                                        key={`${suggestion.kind}-${suggestion.value}-${index}`}
                                                        type="button"
                                                        onClick={() => setCommandBarValue(suggestion.value)}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-sky-500/10"
                                                    >
                                                        <span className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black uppercase tracking-wider ${suggestion.kind === 'command' ? 'border-sky-500/30 bg-sky-500/10 text-sky-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
                                                            {suggestion.kind === 'command' ? 'CMD' : 'USER'}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-black text-white">{suggestion.title}</span>
                                                            <span className="mt-0.5 block truncate text-xs font-medium text-slate-400">{suggestion.detail}</span>
                                                        </span>
                                                        <span className="hidden shrink-0 rounded-lg border border-slate-800 bg-black/30 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline-flex">
                                                            {suggestion.meta}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={submitManualCommand}
                                        disabled={availableCommands.length === 0 || (commandBarParsed.command ? actionLoading === commandBarParsed.command.id : false)}
                                        className="w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-sky-500 disabled:opacity-50"
                                    >
                                        {commandBarParsed.command && actionLoading === commandBarParsed.command.id ? 'Sending...' : 'Run Command'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
