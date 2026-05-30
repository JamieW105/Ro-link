'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    logs?: unknown[];
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

type NoticeState = {
    type: 'success' | 'error';
    text: string;
} | null;

type PresenceState = 'live' | 'recently-left' | 'history' | 'searched';

type LivePanelUser = LivePlayer & {
    presence: PresenceState;
    serverId: string | null;
    leftAt?: number;
    sourceReason?: string;
};

type EnrichedLiveServer = LiveServerRecord & {
    players: LivePanelUser[];
    visiblePlayerCount: number;
};

type ProfileModal = {
    user: LivePanelUser;
    source: 'popover' | 'profile-panel';
} | null;

type ConfirmAction = {
    command: string;
    user: LivePanelUser;
    title: string;
    body: string;
} | null;

type PanelModal = 'announce' | 'command' | null;
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
const RECENT_LEFT_TTL_MS = 10 * 60 * 1000;
const VALUE_COMMAND_SET = new Set<string>(VALUE_INPUT_COMMAND_IDS);
const NUMERIC_GLOBAL_COMMANDS = new Set<string>(['GRAVITY', 'BRIGHTNESS']);

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

const OpenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
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

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

    const previousLiveUsersRef = useRef<Map<string, LivePanelUser>>(new Map());

    const [serverName, setServerName] = useState('Live Server');
    const [placeId, setPlaceId] = useState<string | null>(null);
    const [liveServers, setLiveServers] = useState<LiveServerRecord[]>([]);
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [recentlyLeftUsers, setRecentlyLeftUsers] = useState<Record<string, LivePanelUser>>({});
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<NoticeState>(null);
    const [serverSearch, setServerSearch] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [profileSearch, setProfileSearch] = useState('');
    const [selectedProfileUser, setSelectedProfileUser] = useState<LivePanelUser | null>(null);
    const [profileModal, setProfileModal] = useState<ProfileModal>(null);
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
            setLogs(normalizeDashboardLogs(payload.logs || []));
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to load the Live Panel: ${String(error)}` });
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, [guildId]);

    useEffect(() => {
        loadPanel(true);
        const interval = window.setInterval(() => loadPanel(false), 7000);
        return () => window.clearInterval(interval);
    }, [loadPanel]);

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

    useEffect(() => {
        const nextLiveUsers = new Map<string, LivePanelUser>();
        for (const server of enrichedServers) {
            for (const player of server.players) {
                nextLiveUsers.set(getUserKey(player), player);
            }
        }

        const previousLiveUsers = previousLiveUsersRef.current;
        const now = Date.now();
        const leftUsers: Record<string, LivePanelUser> = {};

        previousLiveUsers.forEach((player, key) => {
            if (!nextLiveUsers.has(key)) {
                leftUsers[key] = {
                    ...player,
                    presence: 'recently-left',
                    leftAt: now,
                    sourceReason: 'Recently left the game',
                };
            }
        });

        previousLiveUsersRef.current = nextLiveUsers;

        setRecentlyLeftUsers((current) => {
            const merged = { ...current, ...leftUsers };
            for (const [key, user] of Object.entries(merged)) {
                if (user.leftAt && now - user.leftAt > RECENT_LEFT_TTL_MS) {
                    delete merged[key];
                }
                if (nextLiveUsers.has(key)) {
                    delete merged[key];
                }
            }
            return merged;
        });
    }, [enrichedServers]);

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

    const allKnownUsers = useMemo(() => {
        const users = new Map<string, LivePanelUser>();
        liveUserMap.forEach((user, key) => {
            if (key.startsWith('username:') || key.startsWith('id:')) {
                users.set(getUserKey(user), user);
            }
        });

        Object.entries(recentlyLeftUsers).forEach(([key, user]) => users.set(key, user));

        for (const log of logs) {
            for (const [value, reason] of [
                [log.target, `Recently moderated: ${log.action}`],
                [log.moderator, `Recent staff mention: ${log.action}`],
                ...log.targetIdentities.map((identity) => [identity, `Recently moderated: ${log.action}`] as [string, string]),
                ...log.moderatorIdentities.map((identity) => [identity, `Recent staff mention: ${log.action}`] as [string, string]),
            ] as Array<[string, string]>) {
                if (!isLikelyUserText(value)) continue;
                const username = extractUsername(value);
                const existing = liveUserMap.get(`username:${username.toLowerCase()}`);
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
    }, [liveUserMap, logs, recentlyLeftUsers]);

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

    const availableCommands = useMemo(() => (
        ADMIN_PANEL_COMMANDS.filter((command) => canUseDashboardCommand(perms, command.id))
    ), [perms]);

    const suggestions = useMemo(() => {
        const query = profileSearch.trim().toLowerCase();
        if (!query) return [];

        const ranked = allKnownUsers
            .filter((user) => (
                user.username.toLowerCase().includes(query)
                || user.displayName.toLowerCase().includes(query)
                || normalizeIdentity(user.userId).includes(query)
            ))
            .map((user) => {
                const recentLog = logs.find((log) => logMentionsUser(log, user));
                const reason = user.presence === 'live'
                    ? `In ${formatServerId(user.serverId || '')}`
                    : user.presence === 'recently-left'
                        ? 'Recently left the game'
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
            return allKnownUsers
                .filter((user) => (
                    !search
                    || user.username.toLowerCase().includes(search)
                    || user.displayName.toLowerCase().includes(search)
                    || normalizeIdentity(user.userId).includes(search)
                ))
                .slice(0, 6);
        };
        const userReason = (user: LivePanelUser) => {
            const recentLog = logs.find((log) => logMentionsUser(log, user));
            if (user.presence === 'live') return `In ${formatServerId(user.serverId || '')}`;
            if (user.presence === 'recently-left') return 'Recently left the game';
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
                    detail: `${command.description}${command.requiresTarget ? ' Needs a user target.' : ' Runs on live servers.'}`,
                    meta: command.category,
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
                    value: `${command.label} ${user.username}${VALUE_COMMAND_SET.has(command.id) || command.id === 'SET_CHAR' ? ' ' : ''}`,
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
    const popoverUser = profileModal?.user || null;
    const popoverProfile = popoverUser ? profileCache[getUserKey(popoverUser)] : null;
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

    function openUser(user: LivePanelUser, source: 'popover' | 'profile-panel' = 'popover') {
        const normalizedUser = liveUserMap.get(getUserKey(user)) || liveUserMap.get(`username:${user.username.toLowerCase()}`) || user;
        setProfileModal({ user: normalizedUser, source });
        hydrateProfile(normalizedUser);
    }

    function selectProfileUser(user: LivePanelUser) {
        const normalizedUser = liveUserMap.get(getUserKey(user)) || liveUserMap.get(`username:${user.username.toLowerCase()}`) || user;
        setSelectedProfileUser(normalizedUser);
        setProfileSearch(normalizedUser.username);
        setNoteText('');
        setWarningText('');
        hydrateProfile(normalizedUser);
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

        if (commandDefinition.requiresTarget) {
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
            }
        } else {
            const remainder = parsed.remainder.trim();
            args.target_scope = 'GLOBAL';
            args.target_label = 'global';

            if (NUMERIC_GLOBAL_COMMANDS.has(commandDefinition.id)) {
                if (!remainder || !Number.isFinite(Number(remainder))) {
                    setNotice({ type: 'error', text: `Add a numeric value after ${commandDefinition.label}.` });
                    return;
                }
                args.amount = remainder;
            } else if (commandDefinition.id === 'BROADCAST') {
                if (!remainder) {
                    setNotice({ type: 'error', text: 'Add a broadcast message after the command.' });
                    return;
                }
                args.message = remainder;
            } else if (remainder) {
                args.reason = remainder;
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
                    robloxId: panelProfile?.id || panelUser.userId || undefined,
                    robloxUsername: panelProfile?.username || panelUser.username,
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
            await loadPanel(false);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to save note: ${String(error)}` });
        } finally {
            setActionLoading(null);
        }
    }

    const quickActions = [
        { command: 'REFRESH', label: 'Refresh', icon: <RefreshIcon />, tone: 'text-sky-300 hover:border-sky-400/50 hover:bg-sky-500/10' },
        { command: 'RESET', label: 'Reset', icon: <ResetIcon />, tone: 'text-indigo-300 hover:border-indigo-400/50 hover:bg-indigo-500/10' },
        { command: 'KICK', label: 'Kick', icon: <KickIcon />, tone: 'text-amber-300 hover:border-amber-400/50 hover:bg-amber-500/10' },
        { command: 'BAN', label: 'Ban', icon: <BanIcon />, tone: 'text-red-300 hover:border-red-400/50 hover:bg-red-500/10' },
        { command: 'SOFTBAN', label: 'Temp Ban', icon: <TempBanIcon />, tone: 'text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10' },
    ].filter((action) => canUseDashboardCommand(perms, action.command));
    const canRunCommands = availableCommands.length > 0;
    const canAnnounce = canUseDashboardCommand(perms, 'BROADCAST');

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

                    <div className="grid grid-cols-3 gap-3 lg:min-w-[390px]">
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
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {server.players.length > 0 ? (
                                                        server.players.map((player) => (
                                                            <UserAvatarButton
                                                                key={`${server.id}-${getUserKey(player)}`}
                                                                user={player}
                                                                compact
                                                                onClick={() => openUser(player)}
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
                    <div className="shrink-0 border-b border-slate-800 bg-slate-950/30 p-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                                Profile / Create Log
                            </h2>
                            {selectedProfileUser && (
                                <span className="truncate rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-200">
                                    Editing @{selectedProfileUser.username}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                value={profileSearch}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    const normalizedNextValue = nextValue.trim().toLowerCase();
                                    const selectedUsername = selectedProfileUser?.username.toLowerCase() || '';
                                    const selectedDisplayName = selectedProfileUser?.displayName.toLowerCase() || '';

                                    setProfileSearch(nextValue);

                                    if (
                                        !normalizedNextValue
                                        || (selectedProfileUser && normalizedNextValue !== selectedUsername && normalizedNextValue !== selectedDisplayName)
                                    ) {
                                        setSelectedProfileUser(null);
                                    }
                                }}
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

                    {panelUser ? (
                        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
                            <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                                    <div className="flex items-center gap-4">
                                        <UserAvatarButton user={panelUser} onClick={() => openUser(panelUser, 'profile-panel')} />
                                        <div className="min-w-0">
                                            <h2 className="truncate text-lg font-black text-white">{panelProfile?.displayName || panelUser.displayName}</h2>
                                            <p className="truncate text-sm font-semibold text-slate-400">@{panelProfile?.username || panelUser.username}</p>
                                        </div>
                                    </div>
                                    <div className="mt-5 space-y-3 text-sm">
                                        <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</p>
                                            <p className={`mt-1 font-bold ${panelUser.presence === 'live' ? 'text-emerald-300' : panelUser.presence === 'recently-left' ? 'text-amber-300' : 'text-slate-300'}`}>
                                                {presenceLabel(panelUser)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">User ID</p>
                                            <p className="mt-1 font-mono font-bold text-sky-300">{panelProfile?.id || panelUser.userId || 'Unknown'}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Server</p>
                                            <p className="mt-1 font-mono font-bold text-white">{panelUser.serverId ? formatServerId(panelUser.serverId) : 'Not live'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openUser(panelUser, 'profile-panel')}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-all hover:bg-sky-500/20"
                                        >
                                            <OpenIcon />
                                            Mini Profile
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Add Staff Note</h3>
                                        <textarea
                                            value={noteText}
                                            onChange={(event) => setNoteText(event.target.value)}
                                            rows={4}
                                            placeholder={`Write a private staff note for ${panelUser.username}`}
                                            className="mt-4 w-full resize-none rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500/60"
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
                                    </div>

                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-amber-200">Add Warning</h3>
                                        <textarea
                                            value={warningText}
                                            onChange={(event) => setWarningText(event.target.value)}
                                            rows={3}
                                            placeholder={`Record a warning for ${panelUser.username}`}
                                            className="mt-4 w-full resize-none rounded-xl border border-amber-500/20 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-amber-200/35 focus:border-amber-300/60"
                                        />
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                disabled={actionLoading === 'warning'}
                                                onClick={() => saveUserNote('warning')}
                                                className="rounded-xl border border-amber-400/30 bg-amber-500/20 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-amber-100 transition-all hover:bg-amber-500/30 disabled:opacity-50"
                                            >
                                                {actionLoading === 'warning' ? 'Saving...' : 'Save Warning'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Last 4 Logs</h3>
                                            <Link
                                                href={`/dashboard/${guildId}/players/${encodeURIComponent(panelUser.username)}`}
                                                className="text-[10px] font-bold uppercase tracking-widest text-sky-300 hover:text-sky-100"
                                            >
                                                Full View
                                            </Link>
                                        </div>
                                        <div className="space-y-3">
                                            {logs.filter((log) => logMentionsUser(log, panelUser)).slice(0, 4).map((log) => (
                                                <div key={log.id} className="rounded-xl border border-slate-800 bg-black/20 p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-xs font-black uppercase tracking-widest text-white">{log.action}</span>
                                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{formatTime(log.timestamp)}</span>
                                                    </div>
                                                    <p className="mt-1 text-xs font-medium text-slate-400">
                                                        Target <ClickableUserText value={log.target} onOpen={() => openUser(resolveUserFromText(log.target))} /> by <ClickableUserText value={log.moderator} onOpen={() => openUser(resolveUserFromText(log.moderator))} />
                                                    </p>
                                                </div>
                                            ))}
                                            {logs.filter((log) => logMentionsUser(log, panelUser)).length === 0 && (
                                                <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs font-semibold text-slate-500">
                                                    No recent logs for this user in the current panel cache.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
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
                                                <ClickableUserText value={log.moderator} onOpen={() => openUser(resolveUserFromText(log.moderator))} /> used <span className="font-bold text-sky-300">{log.action}</span> on <ClickableUserText value={log.target} onOpen={() => openUser(resolveUserFromText(log.target))} />
                                            </p>
                                            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-right">
                                                {formatTime(log.timestamp)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {profileModal && popoverUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-[#020617] shadow-2xl shadow-black/50">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900/60 px-5 py-5">
                            <div className="flex min-w-0 items-center gap-4">
                                <UserAvatar user={popoverUser} />
                                <div className="min-w-0">
                                    <h3 className="truncate text-xl font-black text-white">{popoverProfile?.displayName || popoverUser.displayName}</h3>
                                    <p className="truncate text-sm font-semibold text-slate-400">@{popoverProfile?.username || popoverUser.username}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setProfileModal(null)}
                                className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-slate-500 transition-colors hover:text-white"
                            >
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="space-y-5 px-5 py-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</p>
                                    <p className={`mt-1 text-sm font-black ${popoverUser.presence === 'live' ? 'text-emerald-300' : popoverUser.presence === 'recently-left' ? 'text-amber-300' : 'text-slate-300'}`}>{presenceLabel(popoverUser)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">User ID</p>
                                    <p className="mt-1 truncate font-mono text-sm font-black text-sky-300">{popoverProfile?.id || popoverUser.userId || 'Unknown'}</p>
                                </div>
                            </div>

                            {quickActions.length > 0 && (
                                <div>
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Quick Actions</p>
                                    <div className="flex flex-wrap gap-2">
                                        {quickActions.map((action) => {
                                            const disabled = popoverUser.presence !== 'live' || actionLoading === action.command;
                                            return (
                                                <button
                                                    key={action.command}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => requestPlayerCommand(action.command, popoverUser)}
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

                            <div>
                                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Last 4 Logs Involving Them</p>
                                <div className="space-y-2">
                                    {logs.filter((log) => logMentionsUser(log, popoverUser)).slice(0, 4).map((log) => (
                                        <div key={log.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-black uppercase tracking-widest text-white">{log.action}</p>
                                                <p className="truncate text-[11px] font-medium text-slate-500">By {log.moderator}</p>
                                            </div>
                                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{formatTime(log.timestamp)}</span>
                                        </div>
                                    ))}
                                    {logs.filter((log) => logMentionsUser(log, popoverUser)).length === 0 && (
                                        <div className="rounded-xl border border-dashed border-slate-800 px-3 py-5 text-center text-xs font-semibold text-slate-500">
                                            No recent logs involving this user.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <button
                                    type="button"
                                    onClick={() => {
                                        selectProfileUser(popoverUser);
                                        setProfileModal(null);
                                    }}
                                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-all hover:border-sky-400/50 hover:text-white"
                                >
                                    Use In Panel
                                </button>
                                <Link
                                    href={`/dashboard/${guildId}/players/${encodeURIComponent(popoverUser.username)}`}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-200 transition-all hover:bg-sky-500/20"
                                >
                                    <OpenIcon />
                                    Open Full View
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
