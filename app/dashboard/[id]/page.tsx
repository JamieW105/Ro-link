'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";

import { usePermissions } from "@/context/PermissionsContext";
import { normalizeDashboardLogs, type NormalizedDashboardLog } from "@/lib/logRecords";
import { normalizeLivePlayerList } from "@/lib/livePlayers";

type IconProps = {
    className?: string;
};

const ActivityIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 8L9 4l-3 8H2" />
    </svg>
);

const ServerIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" />
        <path d="M6 6h.01" />
        <path d="M6 18h.01" />
    </svg>
);

const ShieldIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const KeyIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 2-2 2" />
        <path d="m15 8 2 2" />
        <path d="M7 14a5 5 0 1 1 7-7l7 7-3 3-2-2-2 2-2-2-1.4 1.4A5 5 0 0 1 7 14Z" />
    </svg>
);

const RadioIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.9 19.1a10 10 0 0 1 0-14.2" />
        <path d="M7.8 16.2a6 6 0 0 1 0-8.5" />
        <circle cx="12" cy="12" r="2" />
        <path d="M16.2 7.8a6 6 0 0 1 0 8.5" />
        <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
    </svg>
);

const LayersIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
    </svg>
);

const AlertIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </svg>
);

const ArrowIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
    </svg>
);

const CopyIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="13" height="13" x="9" y="9" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

interface VisibleGuild {
    id: string;
    name: string;
    icon?: string | null;
}

interface ServerOverviewConfig {
    api_key?: string | null;
    place_id?: string | null;
    universe_id?: string | null;
    open_cloud_key?: string | null;
    logging_channel_id?: string | null;
    reports_enabled?: boolean | null;
    reports_channel_id?: string | null;
    verification_enabled?: boolean | null;
    admin_cmds_enabled?: boolean | null;
    misc_cmds_enabled?: boolean | null;
}

interface LiveServer {
    id: string;
    server_id: string;
    player_count: number;
    players?: unknown;
    updated_at: string;
}

interface ReportRecord {
    id?: string;
    status?: string | null;
}

interface ModulesPayload {
    installedCount?: number;
    customInstalledCount?: number;
    modules?: Array<{
        enabled?: boolean | null;
        status?: string | null;
    }>;
}

type SetupState = 'ready' | 'missing' | 'restricted' | 'optional';
type Tone = 'sky' | 'emerald' | 'amber' | 'red' | 'slate';

const toneStyles: Record<Tone, { badge: string; icon: string; text: string; border: string }> = {
    sky: {
        badge: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
        icon: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
        text: 'text-sky-300',
        border: 'border-sky-500/30',
    },
    emerald: {
        badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
        icon: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
        text: 'text-emerald-300',
        border: 'border-emerald-500/30',
    },
    amber: {
        badge: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
        icon: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
        text: 'text-amber-300',
        border: 'border-amber-500/30',
    },
    red: {
        badge: 'border-red-500/25 bg-red-500/10 text-red-200',
        icon: 'border-red-500/20 bg-red-500/10 text-red-300',
        text: 'text-red-300',
        border: 'border-red-500/30',
    },
    slate: {
        badge: 'border-slate-700 bg-slate-900/70 text-slate-300',
        icon: 'border-slate-700 bg-slate-900/70 text-slate-400',
        text: 'text-slate-300',
        border: 'border-slate-700',
    },
};

const setupStateStyles: Record<SetupState, string> = {
    ready: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    missing: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    restricted: 'border-slate-700 bg-slate-900/60 text-slate-400',
    optional: 'border-slate-700 bg-slate-900/60 text-slate-400',
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function formatNumber(value: number) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatAverage(value: number) {
    return Number.isFinite(value) ? value.toFixed(1) : '0.0';
}

function formatRelativeTime(value?: string | null) {
    const date = value ? new Date(value) : null;
    const time = date?.getTime();
    if (!time || Number.isNaN(time)) {
        return 'No signal yet';
    }

    const diffMs = Date.now() - time;
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getServerInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'RL';
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function getDiscordIconUrl(guild?: VisibleGuild | null) {
    if (!guild?.id || !guild.icon) {
        return '';
    }

    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

function maskSecret(value?: string | null) {
    const secret = trimString(value);
    if (!secret) return 'Not generated';
    if (secret.length <= 12) return secret;
    return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

async function fetchJson<T>(url: string, timeoutMs = 3500) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
            return null;
        }

        return await response.json() as T;
    } catch {
        return null;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function StatTile({
    label,
    value,
    detail,
    icon,
    tone = 'sky',
}: {
    label: string;
    value: string;
    detail: string;
    icon: ReactNode;
    tone?: Tone;
}) {
    const styles = toneStyles[tone];

    return (
        <div className={`group rounded-lg border border-slate-800 bg-slate-950/45 p-5 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:bg-slate-900/55 ${styles.border}`}>
            <div className="mb-5 flex items-center justify-between gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${styles.icon}`}>
                    {icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                    {label}
                </span>
            </div>
            <p className={`text-3xl font-black tracking-tight ${styles.text}`}>{value}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">{detail}</p>
        </div>
    );
}

function ActionLink({
    href,
    label,
    tone = 'slate',
    children,
}: {
    href: string;
    label: string;
    tone?: Tone;
    children: ReactNode;
}) {
    const styles = toneStyles[tone];

    return (
        <Link
            href={href}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 ${styles.badge}`}
        >
            {children}
            {label}
        </Link>
    );
}

function SetupRow({
    label,
    value,
    state,
}: {
    label: string;
    value: string;
    state: SetupState;
}) {
    const stateLabel = state === 'ready'
        ? 'Ready'
        : state === 'missing'
            ? 'Needs setup'
            : state === 'restricted'
                ? 'Restricted'
                : 'Optional';

    return (
        <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 py-3 last:border-b-0">
            <div className="min-w-0">
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">{value}</p>
            </div>
            <span className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${setupStateStyles[state]}`}>
                {stateLabel}
            </span>
        </div>
    );
}

function ActivityBadge({ action }: { action: string }) {
    const normalized = action.toUpperCase();
    const tone = normalized.includes('BAN')
        ? 'red'
        : normalized.includes('KICK') || normalized.includes('WARN') || normalized.includes('TIMEOUT')
            ? 'amber'
            : 'sky';

    return (
        <span className={`inline-flex max-w-full truncate rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${toneStyles[tone].badge}`}>
            {action}
        </span>
    );
}

export default function ServerDashboard() {
    const params = useParams();
    const serverId = Array.isArray(params.id) ? params.id[0] : String(params.id || '');
    const { data: session } = useSession();
    const perms = usePermissions();

    const [config, setConfig] = useState<ServerOverviewConfig | null>(null);
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [liveServers, setLiveServers] = useState<LiveServer[]>([]);
    const [serverInfo, setServerInfo] = useState<VisibleGuild | null>(null);
    const [pendingReports, setPendingReports] = useState<ReportRecord[] | null>(null);
    const [modulesPayload, setModulesPayload] = useState<ModulesPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const canManageSettings = perms.is_admin || perms.can_manage_settings;
    const canManageReports = perms.is_admin || perms.can_manage_reports;
    const canAccessLivePanel = perms.is_admin || perms.can_access_live_panel;

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            if (!serverId) return;

            const guildsRequest = fetchJson<VisibleGuild[]>('/api/guilds', 10000);
            const [configData, liveServersData, logsData] = await Promise.all([
                fetchJson<ServerOverviewConfig | null>(`/api/dashboard/server-config?serverId=${encodeURIComponent(serverId)}`),
                fetchJson<LiveServer[]>(`/api/dashboard/live-servers?serverId=${encodeURIComponent(serverId)}&cleanupStale=true`),
                fetchJson<unknown[]>(`/api/dashboard/logs?serverId=${encodeURIComponent(serverId)}&limit=12`),
            ]);

            if (cancelled) return;

            if (configData !== null) {
                setConfig(configData);
            }

            if (liveServersData) {
                setLiveServers(liveServersData);
            }

            if (logsData) {
                setLogs(normalizeDashboardLogs(logsData));
            }

            setLoading(false);

            const [guilds, reportsData, modulesData] = await Promise.all([
                guildsRequest,
                canManageReports
                    ? fetchJson<ReportRecord[]>(`/api/reports?serverId=${encodeURIComponent(serverId)}&status=PENDING`, 4500)
                    : Promise.resolve(null),
                canManageSettings
                    ? fetchJson<ModulesPayload>(`/api/dashboard/modules?serverId=${encodeURIComponent(serverId)}`, 4500)
                    : Promise.resolve(null),
            ]);

            if (cancelled) return;

            if (guilds) {
                setServerInfo(guilds.find((guild) => guild.id === serverId) || null);
            }

            if (canManageReports) {
                setPendingReports(reportsData);
            } else {
                setPendingReports(null);
            }

            if (canManageSettings) {
                setModulesPayload(modulesData);
            } else {
                setModulesPayload(null);
            }
        }

        fetchData();
        const intervalId = window.setInterval(fetchData, 10000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [serverId, canManageReports, canManageSettings]);

    const serverName = serverInfo?.name || 'Server Overview';
    const serverIconUrl = getDiscordIconUrl(serverInfo);

    const enrichedServers = useMemo(() => (
        liveServers.map((server) => {
            const players = normalizeLivePlayerList(server.players);
            return {
                ...server,
                visiblePlayerCount: players.length > 0 ? players.length : Number(server.player_count || 0),
                players,
            };
        })
    ), [liveServers]);

    const totalPlayers = enrichedServers.reduce((sum, server) => sum + server.visiblePlayerCount, 0);
    const averagePlayers = enrichedServers.length > 0 ? totalPlayers / enrichedServers.length : 0;
    const enabledModules = modulesPayload?.modules?.filter((module) => module.enabled !== false).length ?? 0;
    const latestServerSignal = enrichedServers[0]?.updated_at || null;
    const latestLogSignal = logs[0]?.timestamp || null;
    const latestSignal = [latestServerSignal, latestLogSignal]
        .filter(Boolean)
        .sort((left, right) => new Date(String(right)).getTime() - new Date(String(left)).getTime())[0] || null;

    const requiredSetupItems = [
        {
            label: 'Security key',
            value: canManageSettings ? maskSecret(config?.api_key) : 'Hidden from this role',
            state: canManageSettings ? (config?.api_key ? 'ready' : 'missing') : 'restricted',
        },
        {
            label: 'Roblox experience',
            value: config?.place_id && config?.universe_id
                ? `Place ${config.place_id} / Universe ${config.universe_id}`
                : 'Place ID and Universe ID',
            state: config?.place_id && config?.universe_id ? 'ready' : 'missing',
        },
        {
            label: 'Open Cloud',
            value: canManageSettings ? (config?.open_cloud_key ? 'Credential saved' : 'Credential missing') : 'Hidden from this role',
            state: canManageSettings ? (config?.open_cloud_key ? 'ready' : 'missing') : 'restricted',
        },
    ] satisfies Array<{ label: string; value: string; state: SetupState }>;

    const optionalSetupItems = [
        {
            label: 'Logging',
            value: config?.logging_channel_id ? `Channel ${config.logging_channel_id}` : 'No logging channel selected',
            state: config?.logging_channel_id ? 'ready' : 'optional',
        },
        {
            label: 'Reports',
            value: config?.reports_enabled ? 'Report intake enabled' : 'Report intake disabled',
            state: config?.reports_enabled ? 'ready' : 'optional',
        },
        {
            label: 'Verification',
            value: config?.verification_enabled ? 'Verification rules enabled' : 'Verification rules disabled',
            state: config?.verification_enabled ? 'ready' : 'optional',
        },
    ] satisfies Array<{ label: string; value: string; state: SetupState }>;

    const visibleRequiredItems = requiredSetupItems.filter((item) => item.state !== 'restricted');
    const readyRequiredCount = visibleRequiredItems.filter((item) => item.state === 'ready').length;
    const setupComplete = visibleRequiredItems.length > 0 && readyRequiredCount === visibleRequiredItems.length;

    const serverStatus = enrichedServers.length > 0
        ? { label: 'Live', tone: 'emerald' as Tone }
        : setupComplete
            ? { label: 'Ready', tone: 'sky' as Tone }
            : canManageSettings
                ? { label: 'Setup needed', tone: 'amber' as Tone }
                : { label: 'Limited view', tone: 'slate' as Tone };

    async function copyApiKey() {
        if (!config?.api_key) return;

        await navigator.clipboard.writeText(config.api_key);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }

    if (loading) {
        return (
            <div className="mx-auto flex max-w-7xl flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="h-56 animate-pulse rounded-lg border border-slate-800 bg-slate-900/35" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="h-36 animate-pulse rounded-lg border border-slate-800 bg-slate-900/35" />
                    <div className="h-36 animate-pulse rounded-lg border border-slate-800 bg-slate-900/35" />
                    <div className="h-36 animate-pulse rounded-lg border border-slate-800 bg-slate-900/35" />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#070b12] shadow-2xl shadow-black/25">
                <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 px-5 py-5 md:px-7 md:py-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="relative shrink-0">
                                {serverIconUrl ? (
                                    <img
                                        src={serverIconUrl}
                                        alt=""
                                        className="h-16 w-16 rounded-lg border border-white/10 bg-slate-900 object-cover shadow-xl shadow-black/30"
                                    />
                                ) : (
                                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-lg font-black text-sky-300 shadow-xl shadow-black/30">
                                        {getServerInitials(serverName)}
                                    </div>
                                )}
                                <span className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#070b12] ${serverStatus.tone === 'emerald' ? 'bg-emerald-400' : serverStatus.tone === 'amber' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${toneStyles[serverStatus.tone].badge}`}>
                                        {serverStatus.label}
                                    </span>
                                    <span className="rounded-md border border-slate-800 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                        Operations
                                    </span>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">{serverName}</h1>
                                <p className="mt-2 text-sm font-medium text-slate-400">
                                    Managed by {session?.user?.name || 'Ro-Link'} - last signal {formatRelativeTime(latestSignal)}.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {canAccessLivePanel && (
                                <ActionLink href={`/dashboard/${serverId}/live-panel`} label="Live Panel" tone="emerald">
                                    <RadioIcon />
                                </ActionLink>
                            )}
                            <ActionLink href={`/dashboard/${serverId}/servers`} label="Servers" tone="sky">
                                <ServerIcon />
                            </ActionLink>
                            {canManageSettings && (
                                <ActionLink href={`/dashboard/${serverId}/settings/setup`} label="Setup" tone={setupComplete ? 'slate' : 'amber'}>
                                    <KeyIcon />
                                </ActionLink>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-y divide-slate-800/80 md:grid-cols-4 md:divide-y-0">
                    <div className="px-5 py-4 md:px-7">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Live Servers</p>
                        <p className="mt-2 text-2xl font-black text-white">{formatNumber(enrichedServers.length)}</p>
                    </div>
                    <div className="px-5 py-4 md:px-7">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Active Users</p>
                        <p className="mt-2 text-2xl font-black text-emerald-300">{formatNumber(totalPlayers)}</p>
                    </div>
                    <div className="px-5 py-4 md:px-7">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Avg Per Job</p>
                        <p className="mt-2 text-2xl font-black text-sky-300">{formatAverage(averagePlayers)}</p>
                    </div>
                    <div className="px-5 py-4 md:px-7">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Recent Actions</p>
                        <p className="mt-2 text-2xl font-black text-slate-100">{formatNumber(logs.length)}</p>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    label="Runtime"
                    value={enrichedServers.length > 0 ? 'Online' : 'Idle'}
                    detail={enrichedServers.length > 0 ? `${formatNumber(totalPlayers)} users across live jobs` : 'No live Roblox jobs reporting'}
                    icon={<RadioIcon />}
                    tone={enrichedServers.length > 0 ? 'emerald' : 'slate'}
                />
                <StatTile
                    label="Reports"
                    value={canManageReports ? formatNumber(pendingReports?.length || 0) : 'Locked'}
                    detail={canManageReports ? 'Pending moderation reports' : 'Requires report permissions'}
                    icon={<AlertIcon />}
                    tone={canManageReports && (pendingReports?.length || 0) > 0 ? 'amber' : 'slate'}
                />
                <StatTile
                    label="Modules"
                    value={canManageSettings ? formatNumber(enabledModules) : 'Locked'}
                    detail={canManageSettings ? `${formatNumber(modulesPayload?.installedCount || 0)} installed modules` : 'Requires settings access'}
                    icon={<LayersIcon />}
                    tone={enabledModules > 0 ? 'sky' : 'slate'}
                />
                <StatTile
                    label="Setup"
                    value={visibleRequiredItems.length > 0 ? `${readyRequiredCount}/${visibleRequiredItems.length}` : 'Hidden'}
                    detail={setupComplete ? 'Required connection fields are ready' : 'Connection fields need attention'}
                    icon={<ShieldIcon />}
                    tone={setupComplete ? 'emerald' : canManageSettings ? 'amber' : 'slate'}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
                <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/45 shadow-xl shadow-black/15">
                    <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-950/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-base font-black tracking-tight text-white">Recent Activity</h2>
                            <p className="mt-1 text-xs font-medium text-slate-500">Latest moderation and runtime events from this server.</p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Refreshes 10s
                        </span>
                    </div>

                    {logs.length === 0 ? (
                        <div className="flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
                            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/70 text-slate-500">
                                <ActivityIcon />
                            </span>
                            <h3 className="text-sm font-bold text-white">No activity yet</h3>
                            <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
                                Actions will appear here when staff commands, reports, and live events are logged.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/70">
                            {logs.slice(0, 8).map((log) => (
                                <div key={log.id} className="grid gap-4 px-5 py-4 transition-colors hover:bg-sky-500/5 md:grid-cols-[150px_minmax(0,1fr)_90px] md:items-center">
                                    <div className="min-w-0">
                                        <ActivityBadge action={log.action} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-200">
                                            <span className="text-white">{log.moderator || 'System'}</span>
                                            <span className="text-slate-500"> on </span>
                                            <span className="text-sky-200">{log.target || 'Unknown target'}</span>
                                        </p>
                                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                                            Server event recorded through Ro-Link
                                        </p>
                                    </div>
                                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-right">
                                        {formatTime(log.timestamp)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t border-slate-800 bg-slate-950/45 px-5 py-4">
                        <Link
                            href={canAccessLivePanel ? `/dashboard/${serverId}/live-panel` : `/dashboard/${serverId}/servers`}
                            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:text-sky-100"
                        >
                            Open live operations
                            <ArrowIcon />
                        </Link>
                    </div>
                </section>

                <div className="space-y-6">
                    <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/45 shadow-xl shadow-black/15">
                        <div className="border-b border-slate-800 bg-slate-950/65 px-5 py-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-black tracking-tight text-white">Connection</h2>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        {visibleRequiredItems.length > 0 ? `${readyRequiredCount} of ${visibleRequiredItems.length} required checks ready` : 'Sensitive checks are hidden'}
                                    </p>
                                </div>
                                <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneStyles[setupComplete ? 'emerald' : canManageSettings ? 'amber' : 'slate'].icon}`}>
                                    <ShieldIcon />
                                </span>
                            </div>
                        </div>

                        <div className="px-5">
                            {[...requiredSetupItems, ...optionalSetupItems].map((item) => (
                                <SetupRow key={item.label} label={item.label} value={item.value} state={item.state} />
                            ))}
                        </div>

                        {canManageSettings && (
                            <div className="border-t border-slate-800 bg-slate-950/45 px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded-md border border-slate-800 bg-black/30 px-3 py-2 font-mono text-xs font-bold text-sky-300">
                                        {maskSecret(config?.api_key)}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={copyApiKey}
                                        disabled={!config?.api_key}
                                        title="Copy security key"
                                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-xs font-bold uppercase tracking-wider text-slate-200 transition-all hover:border-sky-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <CopyIcon />
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/45 shadow-xl shadow-black/15">
                        <div className="border-b border-slate-800 bg-slate-950/65 px-5 py-4">
                            <h2 className="text-base font-black tracking-tight text-white">Operational Notes</h2>
                        </div>
                        <div className="divide-y divide-slate-800/70">
                            <div className="px-5 py-4">
                                <p className="text-sm font-bold text-white">Latest server signal</p>
                                <p className="mt-1 text-xs font-medium text-slate-500">{formatRelativeTime(latestServerSignal)}</p>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-sm font-bold text-white">Command surface</p>
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                    {config?.admin_cmds_enabled || config?.misc_cmds_enabled ? 'Staff commands are enabled' : 'Staff commands are not enabled'}
                                </p>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-sm font-bold text-white">Next review</p>
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                    {setupComplete ? 'Watch live operations and reports' : 'Complete setup before relying on live actions'}
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
