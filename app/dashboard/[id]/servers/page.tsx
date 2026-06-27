'use client';

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
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 1-9 9 8.6 8.6 0 0 1-6-2.4" />
        <path d="M3 12a9 9 0 0 1 15-6.6" />
        <path d="M18 2v4h-4" />
        <path d="M6 22v-4h4" />
    </svg>
);

const ShutdownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v10" />
        <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
);

export default function ServersPage() {
    const { id } = useParams();
    const perms = usePermissions();

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
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Live Servers</h1>
                <p className="text-slate-500 text-sm font-medium">Monitor live jobs, expand each server roster, and drill into any active Roblox player.</p>
            </div>

            {hasGlobalControls && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/35 overflow-hidden">
                    <div className="border-b border-slate-800 bg-slate-950/20 px-5 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div className="space-y-1">
                                <h2 className="text-base font-bold text-white tracking-tight">Server controls</h2>
                                <p className="text-sm text-slate-500 font-medium">Choose a target once, then send broadcast, world, or lifecycle actions.</p>
                            </div>
                            <div className="w-full xl:max-w-md">
                                <label className="mb-2 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target</label>
                                <select
                                    value={selectedTarget}
                                    onChange={(event) => setSelectedTarget(event.target.value)}
                                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium"
                                >
                                    <option value={GLOBAL_TARGET_VALUE}>Global (all live servers)</option>
                                    {normalizedServers.map((server) => (
                                        <option key={server.id} value={server.id}>
                                            Server {formatServerId(server.id)} ({server.visiblePlayerCount} players)
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-2 text-xs text-slate-500">
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
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                                }`}>
                                {notice.text}
                            </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-5">
                            {canBroadcast && (
                                <section className="rounded-xl bg-black/20 border border-slate-800/80 p-5 space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-semibold text-white">Broadcast</h3>
                                        <p className="text-xs text-slate-500">Send one message to the selected live servers.</p>
                                    </div>
                                    <textarea
                                        value={broadcastMessage}
                                        onChange={(event) => setBroadcastMessage(event.target.value)}
                                        rows={4}
                                        placeholder="Type a message..."
                                        className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium resize-none"
                                    />
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs text-slate-500">Roblox may filter or trim certain announcements.</p>
                                        <button
                                            onClick={() => {
                                                const message = trimString(broadcastMessage);
                                                if (!message) {
                                                    setNotice({ type: 'error', text: 'Enter a message before broadcasting.' });
                                                    return;
                                                }
                                                sendCommand('BROADCAST', { message }, undefined, `Broadcast queued for ${targetLabel}.`);
                                            }}
                                            disabled={actionLoading === 'BROADCAST' || normalizedServers.length === 0}
                                            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                        >
                                            {actionLoading === 'BROADCAST' ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                </section>
                            )}

                            <div className="space-y-5">
                                {(canGravity || canBrightness) && (
                                    <section className="rounded-xl bg-black/20 border border-slate-800/80 p-5 space-y-4">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-white">World</h3>
                                            <p className="text-xs text-slate-500">Adjust live environment values.</p>
                                        </div>
                                        {canGravity && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gravity</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={gravityValue}
                                                        onChange={(event) => setGravityValue(event.target.value)}
                                                        className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium"
                                                    />
                                                    <button
                                                        onClick={() => sendCommand('GRAVITY', { amount: trimString(gravityValue) }, undefined, `Gravity queued for ${targetLabel}.`)}
                                                        disabled={actionLoading === 'GRAVITY' || normalizedServers.length === 0}
                                                        className="px-4 py-2.5 bg-slate-800 hover:bg-sky-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                                    >
                                                        {actionLoading === 'GRAVITY' ? '...' : 'Set'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {canBrightness && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Brightness</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={brightnessValue}
                                                        onChange={(event) => setBrightnessValue(event.target.value)}
                                                        className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium"
                                                    />
                                                    <button
                                                        onClick={() => sendCommand('BRIGHTNESS', { amount: trimString(brightnessValue) }, undefined, `Brightness queued for ${targetLabel}.`)}
                                                        disabled={actionLoading === 'BRIGHTNESS' || normalizedServers.length === 0}
                                                        className="px-4 py-2.5 bg-slate-800 hover:bg-sky-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                                    >
                                                        {actionLoading === 'BRIGHTNESS' ? '...' : 'Set'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {(canRestart || canShutdown) && (
                                    <section className="rounded-xl bg-black/20 border border-slate-800/80 p-5 space-y-4">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-white">Lifecycle</h3>
                                            <p className="text-xs text-slate-500">Restart or shut down the selected live servers.</p>
                                        </div>
                                        {canRestart && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Restart message</label>
                                                <textarea
                                                    value={restartReason}
                                                    onChange={(event) => setRestartReason(event.target.value)}
                                                    rows={2}
                                                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium resize-none"
                                                />
                                                <button
                                                    onClick={() => sendCommand('UPDATE', { reason: trimString(restartReason) }, `Restart ${targetLabel}? Players will be moved through a reserved server and then back into public servers.`, `Restart queued for ${targetLabel}.`)}
                                                    disabled={actionLoading === 'UPDATE' || normalizedServers.length === 0}
                                                    className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                                >
                                                    {actionLoading === 'UPDATE' ? 'Queueing restart...' : 'Restart'}
                                                </button>
                                            </div>
                                        )}
                                        {canShutdown && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Shutdown message</label>
                                                <textarea
                                                    value={shutdownReason}
                                                    onChange={(event) => setShutdownReason(event.target.value)}
                                                    rows={2}
                                                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium resize-none"
                                                />
                                                <button
                                                    onClick={() => sendCommand('SHUTDOWN', { reason: trimString(shutdownReason) }, `Shut down ${targetLabel}? Players in the targeted live servers will be disconnected.`, `Shutdown queued for ${targetLabel}.`)}
                                                    disabled={actionLoading === 'SHUTDOWN' || normalizedServers.length === 0}
                                                    className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                                >
                                                    {actionLoading === 'SHUTDOWN' ? 'Queueing shutdown...' : 'Shut down'}
                                                </button>
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Servers</span>
                    <h3 className="text-3xl font-bold text-white mt-1">{normalizedServers.length}</h3>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Concurrent Users</span>
                    <h3 className="text-3xl font-bold text-emerald-500 mt-1">{totalPlayers}</h3>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Players</span>
                    <h3 className="text-3xl font-bold text-slate-200 mt-1">{normalizedServers.length > 0 ? (totalPlayers / normalizedServers.length).toFixed(1) : "0.0"}</h3>
                </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Server List</h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Update: 10s</span>
                </div>

                {normalizedServers.length === 0 ? (
                    <div className="p-24 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                        No live servers found.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/60">
                        {normalizedServers.map((server) => {
                            const isExpanded = expandedServerId === server.id;

                            return (
                                <div key={server.id} className="bg-slate-950/10">
                                    <div className="flex flex-col gap-3 px-5 py-5 transition-all hover:bg-sky-500/5 xl:flex-row xl:items-center xl:justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedServerId(isExpanded ? null : server.id)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-black transition-transform ${isExpanded
                                                    ? 'border-sky-500/30 bg-sky-500/10 text-sky-400 rotate-180'
                                                    : 'border-slate-800 bg-black/30 text-slate-500'
                                                    }`}>
                                                    <span>v</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                                            Nominal
                                                        </span>
                                                        <span className="rounded-full border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                                            {formatServerId(server.id)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-400">
                                                        Expand this live server to inspect every connected Roblox user and open their full command page.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                                                <div className="rounded-xl border border-slate-800 bg-black/20 px-4 py-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Players</p>
                                                    <p className="mt-1 text-xl font-bold text-white">{server.visiblePlayerCount}</p>
                                                </div>
                                                <div className="rounded-xl border border-slate-800 bg-black/20 px-4 py-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Seen</p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-300">
                                                        {new Date(server.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-slate-800 bg-black/20 px-4 py-3 col-span-2 sm:col-span-1">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Roster</p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-300">
                                                        {server.players.length > 0 ? `${server.players.length} resolved` : 'Legacy names only'}
                                                    </p>
                                                </div>
                                            </div>
                                            </div>
                                        </button>

                                        {(canRestart || canShutdown) && (
                                            <div className="flex shrink-0 items-center gap-2">
                                                {canRestart && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Restart server ${formatServerId(server.id)}`}
                                                        title={`Restart ${formatServerId(server.id)}`}
                                                        onClick={() => sendServerCommand(server.id, 'UPDATE')}
                                                        disabled={actionLoading === `UPDATE:${server.id}`}
                                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 transition-all hover:border-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600"
                                                    >
                                                        <RestartIcon />
                                                    </button>
                                                )}
                                                {canShutdown && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Shut down server ${formatServerId(server.id)}`}
                                                        title={`Shut down ${formatServerId(server.id)}`}
                                                        onClick={() => sendServerCommand(server.id, 'SHUTDOWN')}
                                                        disabled={actionLoading === `SHUTDOWN:${server.id}`}
                                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 transition-all hover:border-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600"
                                                    >
                                                        <ShutdownIcon />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-slate-800/60 px-5 pb-5">
                                            {server.players.length > 0 ? (
                                                <div className="grid gap-3 pt-5">
                                                    {server.players.map((player) => (
                                                        <Link
                                                            key={`${server.id}-${player.userId || player.username}`}
                                                            href={`/dashboard/${id}/players/${encodeURIComponent(player.username)}`}
                                                            className="group flex flex-col gap-4 rounded-2xl border border-slate-800 bg-black/20 p-4 transition-all hover:border-sky-500/30 hover:bg-sky-500/5 md:flex-row md:items-center md:justify-between"
                                                        >
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                {player.avatarUrl ? (
                                                                    <img
                                                                        src={player.avatarUrl}
                                                                        alt={player.username}
                                                                        className="h-14 w-14 rounded-2xl border border-slate-800 bg-slate-900 object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-lg font-black text-slate-500">
                                                                        {player.username.slice(0, 1).toUpperCase()}
                                                                    </div>
                                                                )}

                                                                <div className="min-w-0 space-y-1">
                                                                    <p className="truncate text-base font-bold text-white">{player.displayName}</p>
                                                                    <p className="truncate text-sm font-medium text-slate-400">@{player.username}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-3 md:items-end">
                                                                <div className="flex flex-wrap gap-2">
                                                                    <span className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                        User ID {player.userId || 'Unknown'}
                                                                    </span>
                                                                    <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-400">
                                                                        Open Player Page
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] font-medium text-slate-500 group-hover:text-slate-300">
                                                                    View Roblox info, moderation history, and live commands for this user.
                                                                </p>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="pt-5 text-xs text-slate-500 font-medium italic">No players detected or this server is running an older bridge payload.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-500 font-medium">
                Servers that stop sending data are automatically removed from this list. Player cards stay compatible with the older flat roster format while the Roblox bridge updates.
            </div>
        </div>
    );
}
