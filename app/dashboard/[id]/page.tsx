'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Status, StatusIndicator } from '@/components/ui/status';

import { Stat, StatDescription, StatIndicator, StatLabel, StatValue } from '@/components/ui/stat';

import { Button } from '@/components/ui/button';


import { Activity as LucideActivity, ArrowRight as LucideArrowRight, Copy as LucideCopy, KeyRound as LucideKeyRound, Layers3 as LucideLayers3, Radio as LucideRadio, Server as LucideServer, TriangleAlert as LucideTriangleAlert } from 'lucide-react';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { usePermissions } from "@/context/PermissionsContext";
import { normalizeDashboardLogs, type NormalizedDashboardLog } from "@/lib/logRecords";
import { normalizeLivePlayerList } from "@/lib/livePlayers";

type IconProps = {
    className?: string;
};

const ActivityIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideActivity className={className} strokeWidth="2.2" />
);

const ServerIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideServer className={className} strokeWidth="2.2" />
);

const KeyIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideKeyRound className={className} strokeWidth="2.2" />
);

const RadioIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideRadio className={className} strokeWidth="2.2" />
);

const LayersIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideLayers3 className={className} strokeWidth="2.2" />
);

const AlertIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideTriangleAlert className={className} strokeWidth="2.2" />
);

const ArrowIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideArrowRight className={className} strokeWidth="2.3" />
);

const CopyIcon = ({ className = "h-4 w-4" }: IconProps) => (
    <LucideCopy className={className} strokeWidth="2.2" />
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
        badge: 'border-border bg-accent text-foreground',
        icon: 'border-border bg-accent text-foreground',
        text: 'text-foreground',
        border: 'border-border',
    },
    emerald: {
        badge: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
        icon: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-900',
    },
    amber: {
        badge: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
        icon: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-900',
    },
    red: {
        badge: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
        icon: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-900',
    },
    slate: {
        badge: 'border-border bg-card text-foreground',
        icon: 'border-border bg-card text-muted-foreground',
        text: 'text-foreground',
        border: 'border-border',
    },
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

function StatTile({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
    return <Stat className="p-6">
        <StatLabel>{label}</StatLabel>
        <StatIndicator className="bg-transparent text-muted-foreground">{icon}</StatIndicator>
        <StatValue className="mt-2 text-3xl font-semibold">{value}</StatValue>
        <StatDescription className="mt-1">{detail}</StatDescription>
    </Stat>;
}

function ActivityBadge({ action }: { action: string }) {
    const normalized = action.toUpperCase();
    const tone = normalized.includes('BAN')
        ? 'red'
        : normalized.includes('KICK') || normalized.includes('WARN') || normalized.includes('TIMEOUT')
            ? 'amber'
            : 'sky';

    return (
        <span className={`inline-flex max-w-full truncate rounded-md border px-2.5 py-1 text-xs font-semibold   ${toneStyles[tone].badge}`}>
            {action}
        </span>
    );
}

export default function ServerDashboard() {
    const params = useParams();
    const serverId = Array.isArray(params.id) ? params.id[0] : String(params.id || '');
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

    async function copyApiKey() {
        if (!config?.api_key) return;

        await navigator.clipboard.writeText(config.api_key);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }

    if (loading) {
        return (
            <div className="mx-auto flex max-w-7xl flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="h-56 animate-pulse rounded-lg border border-border bg-card" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="h-36 animate-pulse rounded-lg border border-border bg-card" />
                    <div className="h-36 animate-pulse rounded-lg border border-border bg-card" />
                    <div className="h-36 animate-pulse rounded-lg border border-border bg-card" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Your community at a glance. Manage {serverName} from one place.</p>
                </div>
                <div className="flex items-center gap-2">
                    {canManageSettings && <Button asChild variant="outline"><Link href={`/dashboard/${serverId}/settings/setup`}><KeyIcon />Connection settings</Link></Button>}
                    {canAccessLivePanel && <Button asChild><Link href={`/dashboard/${serverId}/live-panel`}><RadioIcon />Open live panel</Link></Button>}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Live servers" value={formatNumber(enrichedServers.length)} detail="Connected Roblox servers" icon={<ServerIcon />} />
                <StatTile label="Active players" value={formatNumber(totalPlayers)} detail={`${formatAverage(averagePlayers)} players per server`} icon={<ActivityIcon />} />
                <StatTile label="Pending reports" value={canManageReports ? formatNumber(pendingReports?.length || 0) : 'Restricted'} detail="Waiting for a staff review" icon={<AlertIcon />} />
                <StatTile label="Enabled modules" value={canManageSettings ? formatNumber(enabledModules) : 'Restricted'} detail={`${formatNumber(modulesPayload?.installedCount || 0)} modules installed`} icon={<LayersIcon />} />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
                <Card>
                    <CardHeader className="flex-row items-start justify-between gap-4">
                        <div className="space-y-2"><CardTitle>Recent activity</CardTitle><CardDescription>Moderation actions and events across your servers.</CardDescription></div>
                        <Status variant="default" className="text-xs"><StatusIndicator />Live updates</Status>
                    </CardHeader>
                    <CardContent>
                        {logs.length === 0 ? (
                            <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
                                <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><ActivityIcon /></div>
                                <h3 className="text-sm font-medium">You’re all caught up</h3>
                                <p className="mt-2 max-w-xs text-sm text-muted-foreground">New moderation actions and server events will appear here as they happen.</p>
                                <Button asChild variant="outline" size="sm" className="mt-5"><Link href={`/dashboard/${serverId}/servers`}>View servers<ArrowIcon /></Link></Button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">{logs.slice(0, 8).map(log => <div key={log.id} className="flex items-start justify-between gap-4 py-4">
                                <div className="min-w-0 space-y-2"><ActivityBadge action={log.action} /><p className="truncate text-sm">{log.moderator || 'System'}<span className="text-muted-foreground"> · </span>{log.target || 'Unknown target'}</p></div>
                                <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(log.timestamp)}</time>
                            </div>)}</div>
                        )}
                    </CardContent>
                    <CardFooter className="justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span>Updates every 10 seconds</span><span>{formatNumber(logs.length)} recent events</span></CardFooter>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Connection checklist</CardTitle><Status variant={setupComplete ? 'success' : 'warning'}>{readyRequiredCount}/{visibleRequiredItems.length} ready</Status></div><CardDescription>Everything your community needs to get started.</CardDescription></CardHeader>
                        <CardContent>
                            {[...requiredSetupItems, ...optionalSetupItems].map(item => <div key={item.label} className="flex items-center justify-between gap-3 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.value}</p></div><Status variant={item.state === 'ready' ? 'success' : item.state === 'missing' ? 'warning' : 'default'} className="shrink-0 text-xs">{item.state === 'ready' ? 'Ready' : item.state === 'missing' ? 'Set up' : item.state === 'restricted' ? 'Restricted' : 'Optional'}</Status></div>)}
                        </CardContent>
                        {canManageSettings && <CardFooter className="border-t border-border pt-4"><Button asChild variant="outline" className="w-full"><Link href={`/dashboard/${serverId}/settings/setup`}>Continue setup<ArrowIcon /></Link></Button></CardFooter>}
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Workspace details</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Community</span><span className="truncate font-medium">{serverName}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Last signal</span><span>{formatRelativeTime(latestServerSignal)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Staff commands</span><span>{config?.admin_cmds_enabled || config?.misc_cmds_enabled ? 'Enabled' : 'Disabled'}</span></div>
                            {canManageSettings && <div className="flex items-center justify-between border-t border-border pt-4"><span className="text-muted-foreground">Security key</span><Button variant="ghost" size="sm" onClick={copyApiKey} disabled={!config?.api_key}><CopyIcon />{copied ? 'Copied' : 'Copy key'}</Button></div>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
