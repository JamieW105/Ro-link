'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';

import { Stat, StatLabel, StatValue, StatDescription } from '@/components/ui/stat';
import { Status, StatusIndicator } from '@/components/ui/status';
import { ChevronDown, Server, SlidersHorizontal, X } from 'lucide-react';

import { Card } from '@/components/ui/card';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import { Select } from '@/components/ui/select';

import { Power as LucidePower, RefreshCw as LucideRefreshCw } from 'lucide-react';

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { usePermissions } from "@/context/PermissionsContext";
import { hasAdminPanelCommandAccess } from "@/lib/adminPanelCommands";
import { normalizeLivePlayerList } from "@/lib/livePlayers";

interface LiveServer {
    id: string;
    server_id: string;
    player_count: number;
    players?: unknown;
    updated_at: string;
}

type NoticeState = {
    type: 'success' | 'error';
    text: string;
} | null;

const GLOBAL_TARGET_VALUE = 'GLOBAL';

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function formatServerId(serverId: string) {
    return `${serverId.slice(0, 8).toUpperCase()}...`;
}

const RestartIcon = () => (
    <LucideRefreshCw width="17" height="17" strokeWidth="2.2" aria-hidden="true" />
);

const ShutdownIcon = () => (
    <LucidePower width="17" height="17" strokeWidth="2.2" aria-hidden="true" />
);

export default function ServersPage() {
    const { id } = useParams();
    const perms = usePermissions();

    const [serverControlsOpen, setServerControlsOpen] = useState(false);
    const [liveServers, setLiveServers] = useState<LiveServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
    const [selectedTarget, setSelectedTarget] = useState<string>(GLOBAL_TARGET_VALUE);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [notice, setNotice] = useState<NoticeState>(null);
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [gravityValue, setGravityValue] = useState("196.2");
    const [brightnessValue, setBrightnessValue] = useState("2");
    const [restartReason, setRestartReason] = useState("Server restart requested from Ro-Link.");
    const [shutdownReason, setShutdownReason] = useState("This server has been shut down from Ro-Link.");

    useEffect(() => {
        async function fetchData() {
            if (!id) return;

            const response = await fetch(`/api/dashboard/live-servers?serverId=${encodeURIComponent(String(id))}&cleanupStale=true`, {
                cache: 'no-store',
            });

            if (response.ok) {
                const data = await response.json();
                setLiveServers(data);
            }

            setLoading(false);
        }

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        if (selectedTarget === GLOBAL_TARGET_VALUE) {
            return;
        }

        if (!liveServers.some((server) => server.id === selectedTarget)) {
            setSelectedTarget(GLOBAL_TARGET_VALUE);
        }
    }, [liveServers, selectedTarget]);

    const canBroadcast = perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'BROADCAST');
    const canGravity = perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'GRAVITY');
    const canBrightness = perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'BRIGHTNESS');
    const canRestart = perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'UPDATE');
    const canShutdown = perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'SHUTDOWN');
    const hasGlobalControls = canBroadcast || canGravity || canBrightness || canRestart || canShutdown;

    const normalizedServers = liveServers.map((server) => {
        const players = normalizeLivePlayerList(server.players).sort((left, right) =>
            left.username.localeCompare(right.username, undefined, { sensitivity: 'base' }),
        );

        return {
            ...server,
            players,
            visiblePlayerCount: players.length > 0 ? players.length : Number(server.player_count || 0),
        };
    });

    const totalPlayers = normalizedServers.reduce((sum, server) => sum + server.visiblePlayerCount, 0);
    const targetIsGlobal = selectedTarget === GLOBAL_TARGET_VALUE;
    const targetLabel = targetIsGlobal ? 'all live servers' : `server ${formatServerId(selectedTarget)}`;

    function buildTargetArgs(extraArgs: Record<string, unknown> = {}) {
        return {
            ...extraArgs,
            target_scope: targetIsGlobal ? 'GLOBAL' : 'SERVER',
            target_label: targetIsGlobal ? 'global' : selectedTarget,
            ...(targetIsGlobal ? {} : { job_id: selectedTarget }),
        };
    }

    function buildServerTargetArgs(serverId: string, extraArgs: Record<string, unknown> = {}) {
        return {
            ...extraArgs,
            target_scope: 'SERVER',
            target_label: serverId,
            job_id: serverId,
        };
    }

    async function sendCommand(command: string, extraArgs: Record<string, unknown>, confirmMessage?: string, successMessage?: string) {
        if (!id) return;
        if (confirmMessage && !confirm(confirmMessage)) {
            return;
        }

        setActionLoading(command);
        setNotice(null);

        try {
            const response = await fetch('/api/dashboard/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    command,
                    args: buildTargetArgs(extraArgs),
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setNotice({ type: 'error', text: trimString(payload.error) || 'Failed to send command.' });
                return;
            }

            setNotice({
                type: 'success',
                text: trimString(payload.warning) || successMessage || `${command} queued for ${targetLabel}.`,
            });
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to send command: ${String(error)}` });
        } finally {
            setActionLoading(null);
        }
    }

    async function sendServerCommand(serverId: string, command: 'UPDATE' | 'SHUTDOWN') {
        if (!id) return;

        const label = command === 'UPDATE' ? 'Restart' : 'Shut down';
        const reason = command === 'UPDATE' ? trimString(restartReason) : trimString(shutdownReason);
        const confirmation = command === 'UPDATE'
            ? `Restart server ${formatServerId(serverId)}? Players will be moved through a reserved server and then back into public servers.`
            : `Shut down server ${formatServerId(serverId)}? Players in this live server will be disconnected.`;

        if (!confirm(confirmation)) {
            return;
        }

        setActionLoading(`${command}:${serverId}`);
        setNotice(null);

        try {
            const response = await fetch('/api/dashboard/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    command,
                    args: buildServerTargetArgs(serverId, { reason }),
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setNotice({ type: 'error', text: trimString(payload.error) || 'Failed to send command.' });
                return;
            }

            setNotice({
                type: 'success',
                text: trimString(payload.warning) || `${label} queued for server ${formatServerId(serverId)}.`,
            });
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to send command: ${String(error)}` });
        } finally {
            setActionLoading(null);
        }
    }

    if (loading) return null;

    return (
        <div className="space-y-8 max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div><h1 className="text-2xl font-semibold tracking-tight">Live servers</h1><p className="mt-1 text-sm text-muted-foreground">Monitor connected servers and inspect their players.</p></div>
                {hasGlobalControls && <Button variant="outline" onClick={() => setServerControlsOpen(true)}><SlidersHorizontal className="size-4" />Server controls</Button>}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Stat className="p-5"><StatLabel>Live servers</StatLabel><StatValue>{normalizedServers.length}</StatValue><StatDescription>Connected Roblox jobs</StatDescription></Stat>
                <Stat className="p-5"><StatLabel>Concurrent players</StatLabel><StatValue>{totalPlayers}</StatValue><StatDescription>Across all live servers</StatDescription></Stat>
                <Stat className="p-5"><StatLabel>Players per server</StatLabel><StatValue>{normalizedServers.length ? (totalPlayers / normalizedServers.length).toFixed(1) : '0.0'}</StatValue><StatDescription>Average connected players</StatDescription></Stat>
            </div>

            {hasGlobalControls && (
                <Dialog open={serverControlsOpen} onOpenChange={setServerControlsOpen}><DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto p-0"><DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close server controls" className="absolute right-3 top-3 z-10"><X className="size-4" /></Button></DialogClose>
                    <div className="border-b border-border bg-card px-5 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div className="space-y-1">
                                <DialogTitle>Server controls</DialogTitle>
                                <DialogDescription>Choose a target, then send broadcast, world, or lifecycle actions.</DialogDescription>
                            </div>
                            <div className="w-full xl:max-w-md">
                                <label className="mb-2 block text-xs font-medium text-muted-foreground">Target</label>
                                <Select
                                    value={selectedTarget}
                                    onValueChange={(nextValue) => setSelectedTarget(nextValue)}
                                    className="w-full transition-all"
                                    aria-label="Command target"
                                    options={[{ value: GLOBAL_TARGET_VALUE, label: 'Global (all live servers)' }, ...normalizedServers.map(server => ({ value: server.id, label: `Server ${formatServerId(server.id)} (${server.visiblePlayerCount} players)` }))]}
                                />
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {targetIsGlobal
                                        ? `Applies to ${normalizedServers.length} live servers.`
                                        : `Applies only to ${formatServerId(selectedTarget)}.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 space-y-5">
                        {notice && (
                            <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${notice.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400'
                                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400'
                                }`}>
                                {notice.text}
                            </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-5">
                            {canBroadcast && (
                                <section className="rounded-xl bg-muted border border-border p-5 space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-semibold text-foreground">Broadcast</h3>
                                        <p className="text-xs text-muted-foreground">Send one message to the selected live servers.</p>
                                    </div>
                                    <Textarea
                                        value={broadcastMessage}
                                        onChange={(event) => setBroadcastMessage(event.target.value)}
                                        rows={4}
                                        placeholder="Type a message..."
                                        className="w-full transition-all resize-none"
                                    />
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs text-muted-foreground">Roblox may filter or trim certain announcements.</p>
                                        <Button variant="default" size="default"
                                            onClick={() => {
                                                const message = trimString(broadcastMessage);
                                                if (!message) {
                                                    setNotice({ type: 'error', text: 'Enter a message before broadcasting.' });
                                                    return;
                                                }
                                                sendCommand('BROADCAST', { message }, undefined, `Broadcast queued for ${targetLabel}.`);
                                            }}
                                            disabled={actionLoading === 'BROADCAST' || normalizedServers.length === 0}
                                            className="transition-all"
                                        >
                                            {actionLoading === 'BROADCAST' ? 'Sending...' : 'Send'}
                                        </Button>
                                    </div>
                                </section>
                            )}

                            <div className="space-y-5">
                                {(canGravity || canBrightness) && (
                                    <section className="rounded-xl bg-muted border border-border p-5 space-y-4">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-foreground">World</h3>
                                            <p className="text-xs text-muted-foreground">Adjust live environment values.</p>
                                        </div>
                                        {canGravity && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Gravity</label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="text"
                                                        value={gravityValue}
                                                        onChange={(event) => setGravityValue(event.target.value)}
                                                        className="flex-1 transition-all"
                                                    />
                                                    <Button variant="default" size="default"
                                                        onClick={() => sendCommand('GRAVITY', { amount: trimString(gravityValue) }, undefined, `Gravity queued for ${targetLabel}.`)}
                                                        disabled={actionLoading === 'GRAVITY' || normalizedServers.length === 0}
                                                        className="transition-all"
                                                    >
                                                        {actionLoading === 'GRAVITY' ? '...' : 'Set'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {canBrightness && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Brightness</label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="text"
                                                        value={brightnessValue}
                                                        onChange={(event) => setBrightnessValue(event.target.value)}
                                                        className="flex-1 transition-all"
                                                    />
                                                    <Button variant="default" size="default"
                                                        onClick={() => sendCommand('BRIGHTNESS', { amount: trimString(brightnessValue) }, undefined, `Brightness queued for ${targetLabel}.`)}
                                                        disabled={actionLoading === 'BRIGHTNESS' || normalizedServers.length === 0}
                                                        className="transition-all"
                                                    >
                                                        {actionLoading === 'BRIGHTNESS' ? '...' : 'Set'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {(canRestart || canShutdown) && (
                                    <section className="rounded-xl bg-muted border border-border p-5 space-y-4">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-foreground">Lifecycle</h3>
                                            <p className="text-xs text-muted-foreground">Restart or shut down the selected live servers.</p>
                                        </div>
                                        {canRestart && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Restart message</label>
                                                <Textarea
                                                    value={restartReason}
                                                    onChange={(event) => setRestartReason(event.target.value)}
                                                    rows={2}
                                                    className="w-full transition-all resize-none"
                                                />
                                                <Button variant="outline" size="default"
                                                    onClick={() => sendCommand('UPDATE', { reason: trimString(restartReason) }, `Restart ${targetLabel}? Players will be moved through a reserved server and then back into public servers.`, `Restart queued for ${targetLabel}.`)}
                                                    disabled={actionLoading === 'UPDATE' || normalizedServers.length === 0}
                                                    className="w-full transition-all"
                                                >
                                                    {actionLoading === 'UPDATE' ? 'Queueing restart...' : 'Restart'}
                                                </Button>
                                            </div>
                                        )}
                                        {canShutdown && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Shutdown message</label>
                                                <Textarea
                                                    value={shutdownReason}
                                                    onChange={(event) => setShutdownReason(event.target.value)}
                                                    rows={2}
                                                    className="w-full transition-all resize-none"
                                                />
                                                <Button variant="destructive" size="default"
                                                    onClick={() => sendCommand('SHUTDOWN', { reason: trimString(shutdownReason) }, `Shut down ${targetLabel}? Players in the targeted live servers will be disconnected.`, `Shutdown queued for ${targetLabel}.`)}
                                                    disabled={actionLoading === 'SHUTDOWN' || normalizedServers.length === 0}
                                                    className="w-full transition-all"
                                                >
                                                    {actionLoading === 'SHUTDOWN' ? 'Queueing shutdown...' : 'Shut down'}
                                                </Button>
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent></Dialog>
            )}

            <Card className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-card">
                    <h2 className="text-sm font-medium text-foreground">Server List</h2>
                    <Status variant="default"><StatusIndicator />Updates every 10s</Status>
                </div>

                {normalizedServers.length === 0 ? (
                    <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-8 text-center"><Server className="size-8 text-muted-foreground" /><p className="text-sm font-medium">No servers online</p><p className="max-w-sm text-sm text-muted-foreground">Live servers will appear here when your Roblox experience connects to Ro-Link.</p></div>
                ) : (
                    <div className="divide-y divide-border">
                        {normalizedServers.map((server) => {
                            const isExpanded = expandedServerId === server.id;

                            return (
                                <div key={server.id} className="bg-card">
                                    <div className="flex flex-col gap-3 px-5 py-5 transition-all hover:bg-accent xl:flex-row xl:items-center xl:justify-between">
                                        <Button variant="ghost" size="default"
                                            type="button"
                                            aria-expanded={isExpanded}
                                            aria-label={`View players on server ${formatServerId(server.id)}`}
                                            onClick={() => setExpandedServerId(isExpanded ? null : server.id)}
                                            className="h-auto min-h-9 justify-start whitespace-normal py-3 min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-transform ${isExpanded
                                                    ? 'border-border bg-accent text-foreground rotate-180'
                                                    : 'border-border bg-muted text-muted-foreground'
                                                    }`}>
                                                    <ChevronDown className="size-4" aria-hidden="true" />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                            Nominal
                                                        </span>
                                                        <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                                                            {formatServerId(server.id)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-muted-foreground">
                                                        Expand this live server to inspect every connected Roblox user and open their full command page.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                                                <div className="rounded-xl border border-border bg-muted px-4 py-3">
                                                    <p className="text-xs font-medium text-muted-foreground">Players</p>
                                                    <p className="mt-1 text-xl font-medium text-foreground">{server.visiblePlayerCount}</p>
                                                </div>
                                                <div className="rounded-xl border border-border bg-muted px-4 py-3">
                                                    <p className="text-xs font-medium text-muted-foreground">Last Seen</p>
                                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                                        {new Date(server.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-border bg-muted px-4 py-3 col-span-2 sm:col-span-1">
                                                    <p className="text-xs font-medium text-muted-foreground">Roster</p>
                                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                                        {server.players.length > 0 ? `${server.players.length} resolved` : 'Legacy names only'}
                                                    </p>
                                                </div>
                                            </div>
                                            </div>
                                        </Button>

                                        {(canRestart || canShutdown) && (
                                            <div className="flex shrink-0 items-center gap-2">
                                                {canRestart && (
                                                    <Button variant="outline" size="icon"
                                                        type="button"
                                                        aria-label={`Restart server ${formatServerId(server.id)}`}
                                                        title={`Restart ${formatServerId(server.id)}`}
                                                        onClick={() => sendServerCommand(server.id, 'UPDATE')}
                                                        disabled={actionLoading === `UPDATE:${server.id}`}
                                                        className="flex items-center justify-center transition-all disabled:cursor-not-allowed"
                                                    >
                                                        <RestartIcon />
                                                    </Button>
                                                )}
                                                {canShutdown && (
                                                    <Button variant="outline" size="icon"
                                                        type="button"
                                                        aria-label={`Shut down server ${formatServerId(server.id)}`}
                                                        title={`Shut down ${formatServerId(server.id)}`}
                                                        onClick={() => sendServerCommand(server.id, 'SHUTDOWN')}
                                                        disabled={actionLoading === `SHUTDOWN:${server.id}`}
                                                        className="flex items-center justify-center transition-all disabled:cursor-not-allowed"
                                                    >
                                                        <ShutdownIcon />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-border px-5 pb-5">
                                            {server.players.length > 0 ? (
                                                <div className="grid gap-3 pt-5">
                                                    {server.players.map((player) => (
                                                        <Link
                                                            key={`${server.id}-${player.userId || player.username}`}
                                                            href={`/dashboard/${id}/players/${encodeURIComponent(player.username)}`}
                                                            className="group flex flex-col gap-4 rounded-xl border border-border bg-muted p-4 transition-all hover:border-border hover:bg-accent md:flex-row md:items-center md:justify-between"
                                                        >
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                {player.avatarUrl ? (
                                                                    <img
                                                                        src={player.avatarUrl}
                                                                        alt={player.username}
                                                                        className="h-14 w-14 rounded-xl border border-border bg-card object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card text-lg font-semibold text-muted-foreground">
                                                                        {player.username.slice(0, 1).toUpperCase()}
                                                                    </div>
                                                                )}

                                                                <div className="min-w-0 space-y-1">
                                                                    <p className="truncate text-base font-medium text-foreground">{player.displayName}</p>
                                                                    <p className="truncate text-sm font-medium text-muted-foreground">@{player.username}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-3 md:items-end">
                                                                <div className="flex flex-wrap gap-2">
                                                                    <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                                                        User ID {player.userId || 'Unknown'}
                                                                    </span>
                                                                    <span className="rounded-lg border border-border bg-accent px-3 py-1.5 text-xs font-medium text-foreground">
                                                                        Open Player Page
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                                                                    View Roblox info, moderation history, and live commands for this user.
                                                                </p>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="pt-5 text-xs text-muted-foreground font-medium">No players detected or this server is running an older bridge payload.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            <Card className="p-5 bg-card border border-border rounded-xl text-xs text-muted-foreground font-medium">
                Servers that stop sending data are automatically removed from this list. Player cards stay compatible with the older flat roster format while the Roblox bridge updates.
            </Card>
        </div>
    );
}
