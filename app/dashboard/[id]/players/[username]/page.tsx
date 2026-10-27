'use client';
import { useDashboardFeedback } from '@/components/dashboard/DashboardFeedback';
import { useSuccessNotice } from '@/hooks/use-success-notice';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { usePermissions } from "@/context/PermissionsContext";
import {
    ADMIN_PANEL_COMMANDS,
    MODERATION_COMMAND_IDS,
    TARGETED_PLAYER_COMMANDS,
    VALUE_INPUT_COMMAND_IDS,
    canUseDashboardCommand,
} from "@/lib/adminPanelCommands";
import { findLivePlayer } from "@/lib/livePlayers";
import { normalizeDashboardLogs, type NormalizedDashboardLog } from "@/lib/logRecords";

interface RobloxPlayerProfile {
    id: number;
    username: string;
    displayName: string;
    description: string;
    created: string;
    avatarUrl: string;
    isBanned?: boolean;
}

interface LiveServerRecord {
    id: string;
    players?: unknown;
}

interface ServerPlaceConfig {
    place_id?: string | null;
}

type PresenceState = {
    inGame: boolean;
    jobId: string | null;
};

const moderationCommands = ADMIN_PANEL_COMMANDS.filter((command) =>
    MODERATION_COMMAND_IDS.includes(command.id as typeof MODERATION_COMMAND_IDS[number]),
);

const valueCommandSet = new Set<string>(VALUE_INPUT_COMMAND_IDS);
const presenceRequiredCommands = new Set<string>([
    'KICK',
    ...TARGETED_PLAYER_COMMANDS.map((command) => command.id),
]);

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function buildAvatarFallback(userId: number) {
    if (!userId) {
        return '';
    }

    return `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(String(userId))}&width=180&height=180&format=png`;
}

function formatCommandTarget(commandId: string) {
    return commandId === 'SET_CHAR' ? 'Character Username' : 'Value';
}

export default function DashboardPlayerPage() {
    const { confirm } = useDashboardFeedback();
    const params = useParams();
    const perms = usePermissions();

    const guildId = String(params.id ?? '');
    const usernameParam = String(params.username ?? '');
    const decodedUsername = decodeURIComponent(usernameParam);

    const [player, setPlayer] = useState<RobloxPlayerProfile | null>(null);
    const [presence, setPresence] = useState<PresenceState>({ inGame: false, jobId: null });
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [linkedPlaceId, setLinkedPlaceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useSuccessNotice<{ type: 'success' | 'error'; text: string } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [setCharValue, setSetCharValue] = useState("");
    const [teamValue, setTeamValue] = useState("");
    const [valueInputs, setValueInputs] = useState<Record<string, string>>({
        DAMAGE: "25",
        MAX_HEALTH: "100",
        WALK_SPEED: "16",
        JUMP_POWER: "50",
    });

    const resolveRobloxProfile = useCallback(async (): Promise<{ profile: RobloxPlayerProfile; warning: string }> => {
        let profileLoadWarning = '';

        try {
            const profileRes = await fetch(`/api/proxy?username=${encodeURIComponent(decodedUsername)}&serverId=${encodeURIComponent(guildId)}`);
            const profilePayload = await profileRes.json().catch(() => ({}));
            if (!profileRes.ok) {
                throw new Error(trimString(profilePayload.error) || 'Failed to load Roblox profile.');
            }

            const resolvedProfile = profilePayload as RobloxPlayerProfile;
            resolvedProfile.avatarUrl = trimString(resolvedProfile.avatarUrl) || buildAvatarFallback(resolvedProfile.id);
            return { profile: resolvedProfile, warning: '' };
        } catch (profileError) {
            const numericUserId = Number(decodedUsername);
            const fallbackId = Number.isFinite(numericUserId) && numericUserId > 0 ? numericUserId : 0;
            profileLoadWarning = profileError instanceof Error ? profileError.message : 'Roblox profile details are unavailable.';

            return {
                warning: profileLoadWarning,
                profile: {
                    id: fallbackId,
                    username: decodedUsername,
                    displayName: decodedUsername,
                    description: profileLoadWarning,
                    created: '',
                    avatarUrl: fallbackId ? buildAvatarFallback(fallbackId) : '',
                },
            };
        }
    }, [decodedUsername, guildId]);

    const loadDashboardData = useCallback(async (resolvedProfile: RobloxPlayerProfile) => {
        const [serverConfigRes, liveServersRes, logsRes] = await Promise.all([
            fetch(`/api/dashboard/server-config?serverId=${encodeURIComponent(guildId)}`, { cache: 'no-store' }),
            fetch(`/api/dashboard/live-servers?serverId=${encodeURIComponent(guildId)}`, { cache: 'no-store' }),
            fetch(`/api/dashboard/logs?serverId=${encodeURIComponent(guildId)}&target=${encodeURIComponent(resolvedProfile.username)}&limit=20`, { cache: 'no-store' }),
        ]);

        const serverConfig = serverConfigRes.ok ? await serverConfigRes.json() as ServerPlaceConfig | null : null;
        if (serverConfig?.place_id) {
            setLinkedPlaceId(serverConfig.place_id);
        } else {
            setLinkedPlaceId(null);
        }

        const liveServersData = liveServersRes.ok ? await liveServersRes.json() : [];
        const liveServers = Array.isArray(liveServersData) ? liveServersData as LiveServerRecord[] : [];
        const matchingServer = liveServers.find((server) =>
            findLivePlayer(server.players, resolvedProfile.username)
            || findLivePlayer(server.players, String(resolvedProfile.id)),
        );

        setPresence({
            inGame: Boolean(matchingServer),
            jobId: matchingServer?.id || null,
        });

        setLogs(normalizeDashboardLogs(logsRes.ok ? await logsRes.json() : []));
    }, [guildId]);

    useEffect(() => {
        let cancelled = false;
        let interval: ReturnType<typeof setInterval> | null = null;

        async function loadInitialPlayerPage() {
            if (!guildId || !decodedUsername) {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const { profile: resolvedProfile, warning: profileLoadWarning } = await resolveRobloxProfile();
                if (cancelled) {
                    return;
                }

                setPlayer(resolvedProfile);
                if (profileLoadWarning) {
                    setNotice({
                        type: 'error',
                        text: `Roblox profile details could not be loaded: ${profileLoadWarning}. Commands are still available when your permissions allow them.`,
                    });
                }

                await loadDashboardData(resolvedProfile);
                if (cancelled) {
                    return;
                }

                interval = setInterval(() => {
                    loadDashboardData(resolvedProfile).catch((refreshError) => {
                        console.error('[Player Page] Failed to refresh dashboard data:', refreshError);
                    });
                }, 15000);
            } catch (loadError) {
                if (!cancelled) {
                    setError(String(loadError instanceof Error ? loadError.message : loadError));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadInitialPlayerPage();

        return () => {
            cancelled = true;
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [guildId, decodedUsername, loadDashboardData, resolveRobloxProfile, setNotice]);

    async function sendPlayerCommand(commandId: string, extraArgs: Record<string, unknown> = {}, confirmMessage?: string) {
        if (!guildId || !player) {
            return;
        }

        if (!canUseDashboardCommand(perms, commandId)) {
            setNotice({ type: 'error', text: 'You do not have permission to use that command.' });
            return;
        }

        if (presenceRequiredCommands.has(commandId) && !presence.inGame) {
            setNotice({ type: 'error', text: 'That command requires the user to be in a live server.' });
            return;
        }

        if (confirmMessage && !await confirm(confirmMessage)) {
            return;
        }

        setActionLoading(commandId);
        setNotice(null);

        try {
            const response = await fetch('/api/dashboard/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: guildId,
                    command: commandId,
                    args: {
                        username: player.username,
                        ...(presenceRequiredCommands.has(commandId) && presence.jobId ? { job_id: presence.jobId } : {}),
                        ...extraArgs,
                    },
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setNotice({ type: 'error', text: trimString(payload.error) || 'Failed to send command.' });
                return;
            }

            setNotice({
                type: 'success',
                text: trimString(payload.warning) || `${commandId} queued for ${player.username}.`,
            });

            await loadDashboardData(player);
        } catch (commandError) {
            setNotice({ type: 'error', text: `Failed to send command: ${String(commandError)}` });
        } finally {
            setActionLoading(null);
        }
    }

    if (loading) return null;

    const availableModerationCommands = moderationCommands.filter((command) => canUseDashboardCommand(perms, command.id));
    const availableTargetCommands = TARGETED_PLAYER_COMMANDS.filter((command) => canUseDashboardCommand(perms, command.id));
    const quickTargetCommands = availableTargetCommands.filter((command) =>
        command.id !== 'SET_CHAR' && command.id !== 'TEAM' && !valueCommandSet.has(command.id),
    );
    const valueCommands = availableTargetCommands.filter((command) => valueCommandSet.has(command.id));
    const setCharCommand = availableTargetCommands.find((command) => command.id === 'SET_CHAR') || null;
    const teamCommand = availableTargetCommands.find((command) => command.id === 'TEAM') || null;

    if (error || !player) {
        return (
            <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-medium text-foreground tracking-tight">Player Detail</h1>
                    <p className="text-muted-foreground text-sm font-medium">Ro-Link could not load that Roblox user.</p>
                </div>

                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-6 text-sm font-medium text-red-700 dark:text-red-400">
                    {error || 'Unknown player.'}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Roblox Player</p>
                    <h1 className="text-3xl font-medium tracking-tight text-foreground flex items-center gap-3"><PageIcon name="player" />{player.displayName}</h1>
                    <p className="text-sm font-medium text-muted-foreground">@{player.username}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {player.id > 0 && (
                        <a
                            href={`https://www.roblox.com/users/${player.id}/profile`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground transition-all hover:border-border hover:text-foreground"
                        >
                            Open Profile
                        </a>
                    )}
                    {presence.inGame && presence.jobId && linkedPlaceId ? (
                        <a
                            href={`roblox://placeId=${linkedPlaceId}&gameInstanceId=${presence.jobId}`}
                            className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-50"
                        >
                            Join Live Server
                        </a>
                    ) : null}
                </div>
            </div>

            {notice && (
                <div className={`rounded-xl border px-5 py-4 text-sm font-medium ${notice.type === 'success'
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                    : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                    }`}>
                    {notice.text}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className={`h-28  ${player.isBanned ? ' ' : presence.inGame ? ' ' : ' '}`}></div>
                        <div className="px-6 pb-6 -mt-14">
                            <div className="inline-flex rounded-xl border border-border bg-background p-2">
                                {player.avatarUrl ? (
                                    <img
                                        src={player.avatarUrl}
                                        alt={player.username}
                                        className="h-24 w-24 rounded-xl border border-border bg-card object-cover"
                                    />
                                ) : (
                                    <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-border bg-card text-3xl font-semibold text-muted-foreground">
                                        {player.username.slice(0, 1).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <h2 className="text-xl font-medium text-foreground">{player.displayName}</h2>
                                    <p className="text-sm font-medium text-muted-foreground">@{player.username}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-border bg-muted p-4">
                                        <p className="text-xs font-medium text-muted-foreground">User ID</p>
                                        <p className="mt-2 text-sm font-mono font-medium text-foreground">{player.id}</p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted p-4">
                                        <p className="text-xs font-medium text-muted-foreground">Status</p>
                                        <p className={`mt-2 text-sm font-medium ${player.isBanned ? 'text-red-700 dark:text-red-400' : presence.inGame ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                                            {player.isBanned ? 'Banned' : presence.inGame ? 'In Game' : 'Offline'}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-border bg-muted p-4">
                                    <p className="text-xs font-medium text-muted-foreground">Account Created</p>
                                    <p className="mt-2 text-sm font-semibold text-foreground">
                                        {player.created
                                            ? new Date(player.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                            : 'Unknown'}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-border bg-muted p-4">
                                    <p className="text-xs font-medium text-muted-foreground">Live Presence</p>
                                    <p className="mt-2 text-sm font-semibold text-foreground">
                                        {presence.inGame && presence.jobId
                                            ? `Connected to ${presence.jobId.slice(0, 8).toUpperCase()}...`
                                            : 'Not in an active tracked server'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Card className="rounded-xl border border-border bg-card p-6">
                        <p className="text-xs font-medium text-muted-foreground">About</p>
                        <p className="mt-3 text-sm leading-relaxed text-foreground">
                            {trimString(player.description) || 'No Roblox description is set for this account.'}
                        </p>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="rounded-xl border border-border bg-card p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-medium text-foreground">Moderation</h2>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">Kick, ban, or unban this user using your server-scoped dashboard permissions.</p>
                            </div>
                            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                {availableModerationCommands.length} available
                            </span>
                        </div>

                        {availableModerationCommands.length > 0 ? (
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {availableModerationCommands.map((command) => {
                                    const disabled = actionLoading === command.id || (command.id === 'KICK' && !presence.inGame);
                                    const colorClass = command.id === 'UNBAN'
                                        ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                        : command.id === 'KICK'
                                            ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                                            : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400';

                                    return (
                                        <Button variant="outline" size="default"
                                            key={command.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => sendPlayerCommand(
                                                command.id,
                                                command.id === 'KICK' && presence.jobId ? { job_id: presence.jobId } : {},
                                                `${command.label} ${player.username}?`,
                                            )}
                                            className={`    text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${colorClass}`}
                                        >
                                            <p className="text-xs font-semibold">
                                                {actionLoading === command.id ? 'Sending...' : command.label}
                                            </p>
                                            <p className="mt-2 text-xs font-medium text-current/80">{command.description}</p>
                                        </Button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-xl border border-border bg-muted px-4 py-4 text-sm font-medium text-muted-foreground">
                                Your current dashboard roles do not grant moderation actions for this player.
                            </div>
                        )}
                    </Card>

                    <Card className="rounded-xl border border-border bg-card p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-medium text-foreground">Live Player Commands</h2>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">Targeted misc and runtime commands only appear if your dashboard role allows them.</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium   ${presence.inGame
                                ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                : 'border-border bg-muted text-muted-foreground'
                                }`}>
                                {presence.inGame ? 'Live target ready' : 'Offline target'}
                            </span>
                        </div>

                        {quickTargetCommands.length > 0 ? (
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {quickTargetCommands.map((command) => (
                                    <Button variant="outline" size="default"
                                        key={command.id}
                                        type="button"
                                        disabled={actionLoading === command.id || !presence.inGame}
                                        onClick={() => sendPlayerCommand(command.id)}
                                        className="text-left transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <p className="text-xs font-semibold text-foreground">
                                            {actionLoading === command.id ? 'Sending...' : command.label}
                                        </p>
                                        <p className="mt-2 text-xs font-medium text-muted-foreground">{command.description}</p>
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-xl border border-border bg-muted px-4 py-4 text-sm font-medium text-muted-foreground">
                                No live player commands are available for your current dashboard role.
                            </div>
                        )}

                        {(setCharCommand || teamCommand || valueCommands.length > 0) && (
                            <div className="mt-6 grid gap-4 xl:grid-cols-2">
                                {setCharCommand && (
                                    <div className="rounded-xl border border-border bg-muted p-4">
                                        <p className="text-xs font-semibold text-foreground">{setCharCommand.label}</p>
                                        <p className="mt-2 text-xs font-medium text-muted-foreground">{setCharCommand.description}</p>
                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                            <Input
                                                type="text"
                                                value={setCharValue}
                                                onChange={(event) => setSetCharValue(event.target.value)}
                                                placeholder="Username to copy avatar from"
                                                className="flex-1"
                                            />
                                            <Button variant="outline" size="default"
                                                type="button"
                                                disabled={actionLoading === 'SET_CHAR' || !presence.inGame || !trimString(setCharValue)}
                                                onClick={() => sendPlayerCommand('SET_CHAR', { char_user: trimString(setCharValue) })}
                                                className="transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {actionLoading === 'SET_CHAR' ? 'Sending...' : 'Apply'}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {teamCommand && (
                                    <div className="rounded-xl border border-border bg-muted p-4">
                                        <p className="text-xs font-semibold text-foreground">{teamCommand.label}</p>
                                        <p className="mt-2 text-xs font-medium text-muted-foreground">{teamCommand.description}</p>
                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                            <Input
                                                type="text"
                                                value={teamValue}
                                                onChange={(event) => setTeamValue(event.target.value)}
                                                placeholder="Roblox team name"
                                                className="flex-1"
                                            />
                                            <Button variant="outline" size="default"
                                                type="button"
                                                disabled={actionLoading === 'TEAM' || !presence.inGame || !trimString(teamValue)}
                                                onClick={() => sendPlayerCommand('TEAM', { team_name: trimString(teamValue) })}
                                                className="transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {actionLoading === 'TEAM' ? 'Sending...' : 'Apply'}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {valueCommands.map((command) => (
                                    <div key={command.id} className="rounded-xl border border-border bg-muted p-4">
                                        <p className="text-xs font-semibold text-foreground">{command.label}</p>
                                        <p className="mt-2 text-xs font-medium text-muted-foreground">{command.description}</p>
                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                            <Input
                                                type="text"
                                                value={valueInputs[command.id] || ''}
                                                onChange={(event) => setValueInputs((current) => ({ ...current, [command.id]: event.target.value }))}
                                                placeholder={formatCommandTarget(command.id)}
                                                className="flex-1"
                                            />
                                            <Button variant="outline" size="default"
                                                type="button"
                                                disabled={actionLoading === command.id || !presence.inGame || !trimString(valueInputs[command.id])}
                                                onClick={() => sendPlayerCommand(command.id, { amount: trimString(valueInputs[command.id]) })}
                                                className="transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {actionLoading === command.id ? 'Sending...' : 'Apply'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="rounded-xl border border-border bg-card p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-medium text-foreground">Moderation History</h2>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">Recent actions logged for this Roblox account in this Discord server.</p>
                            </div>
                            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                {logs.length} entries
                            </span>
                        </div>

                        {logs.length > 0 ? (
                            <div className="mt-5 space-y-3">
                                {logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="flex flex-col gap-3 rounded-xl border border-border bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`h-2.5 w-2.5 rounded-full ${log.action.includes('BAN')
                                                ? 'bg-red-400'
                                                : log.action === 'KICK'
                                                    ? 'bg-amber-400'
                                                    : 'bg-primary'
                                                }`}></span>
                                            <div>
                                                <p className="text-xs font-semibold text-foreground">{log.action}</p>
                                                <p className="mt-1 text-xs font-medium text-muted-foreground">By {log.moderator}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs font-mono font-medium text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleString([], {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm font-medium text-muted-foreground">
                                No prior moderation history was found for this Roblox user in this server.
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
