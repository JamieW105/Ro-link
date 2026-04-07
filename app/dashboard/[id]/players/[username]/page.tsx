'use client';

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { usePermissions } from "@/context/PermissionsContext";
import {
    ADMIN_PANEL_COMMANDS,
    MODERATION_COMMAND_IDS,
    TARGETED_PLAYER_COMMANDS,
    VALUE_INPUT_COMMAND_IDS,
    canUseDashboardCommand,
} from "@/lib/adminPanelCommands";
import { findLivePlayer } from "@/lib/livePlayers";
import { supabase } from "@/lib/supabase";

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

interface LogRecord {
    id: string;
    action: string;
    moderator: string;
    timestamp: string;
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
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(String(userId))}&width=180&height=180&format=png`;
}

function formatCommandTarget(commandId: string) {
    return commandId === 'SET_CHAR' ? 'Character Username' : 'Value';
}

export default function DashboardPlayerPage() {
    const params = useParams();
    const perms = usePermissions();

    const guildId = String(params.id ?? '');
    const usernameParam = String(params.username ?? '');
    const decodedUsername = decodeURIComponent(usernameParam);

    const [player, setPlayer] = useState<RobloxPlayerProfile | null>(null);
    const [presence, setPresence] = useState<PresenceState>({ inGame: false, jobId: null });
    const [logs, setLogs] = useState<LogRecord[]>([]);
    const [linkedPlaceId, setLinkedPlaceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [setCharValue, setSetCharValue] = useState("");
    const [valueInputs, setValueInputs] = useState<Record<string, string>>({
        DAMAGE: "25",
        MAX_HEALTH: "100",
        WALK_SPEED: "16",
        JUMP_POWER: "50",
    });

    async function loadPlayerPage(showLoader = true) {
        if (!guildId || !decodedUsername) {
            return;
        }

        if (showLoader) {
            setLoading(true);
        }

        setError(null);

        try {
            const profileRes = await fetch(`/api/proxy?username=${encodeURIComponent(decodedUsername)}&serverId=${encodeURIComponent(guildId)}`);
            const profilePayload = await profileRes.json().catch(() => ({}));
            if (!profileRes.ok) {
                throw new Error(trimString(profilePayload.error) || 'Failed to load Roblox profile.');
            }

            const resolvedProfile = profilePayload as RobloxPlayerProfile;
            resolvedProfile.avatarUrl = trimString(resolvedProfile.avatarUrl) || buildAvatarFallback(resolvedProfile.id);
            setPlayer(resolvedProfile);

            const [serverConfigRes, liveServersRes, logsRes] = await Promise.all([
                supabase
                    .from('servers')
                    .select('place_id')
                    .eq('id', guildId)
                    .single(),
                supabase
                    .from('live_servers')
                    .select('id, players')
                    .eq('server_id', guildId),
                supabase
                    .from('logs')
                    .select('id, action, moderator, timestamp')
                    .eq('server_id', guildId)
                    .ilike('target', resolvedProfile.username)
                    .order('timestamp', { ascending: false })
                    .limit(20),
            ]);

            if (serverConfigRes.data?.place_id) {
                setLinkedPlaceId(serverConfigRes.data.place_id);
            } else {
                setLinkedPlaceId(null);
            }

            const liveServers = Array.isArray(liveServersRes.data) ? liveServersRes.data as LiveServerRecord[] : [];
            const matchingServer = liveServers.find((server) =>
                findLivePlayer(server.players, resolvedProfile.username)
                || findLivePlayer(server.players, String(resolvedProfile.id)),
            );

            setPresence({
                inGame: Boolean(matchingServer),
                jobId: matchingServer?.id || null,
            });

            setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
        } catch (loadError) {
            setError(String(loadError instanceof Error ? loadError.message : loadError));
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }

    useEffect(() => {
        loadPlayerPage();
        const interval = setInterval(() => {
            loadPlayerPage(false);
        }, 15000);

        return () => clearInterval(interval);
    }, [guildId, decodedUsername]);

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

        if (confirmMessage && !confirm(confirmMessage)) {
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

            await loadPlayerPage(false);
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
        command.id !== 'SET_CHAR' && !valueCommandSet.has(command.id),
    );
    const valueCommands = availableTargetCommands.filter((command) => valueCommandSet.has(command.id));
    const setCharCommand = availableTargetCommands.find((command) => command.id === 'SET_CHAR') || null;

    if (error || !player) {
        return (
            <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold text-white tracking-tight">Player Detail</h1>
                    <p className="text-slate-500 text-sm font-medium">Ro-Link could not load that Roblox user.</p>
                </div>

                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm font-medium text-red-300">
                    {error || 'Unknown player.'}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Roblox Player</p>
                    <h1 className="text-3xl font-bold tracking-tight text-white">{player.displayName}</h1>
                    <p className="text-sm font-medium text-slate-400">@{player.username}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <a
                        href={`https://www.roblox.com/users/${player.id}/profile`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-300 transition-all hover:border-sky-500/30 hover:text-white"
                    >
                        Open Profile
                    </a>
                    {presence.inGame && presence.jobId && linkedPlaceId ? (
                        <a
                            href={`roblox://placeId=${linkedPlaceId}&gameInstanceId=${presence.jobId}`}
                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-emerald-300 transition-all hover:bg-emerald-500/20"
                        >
                            Join Live Server
                        </a>
                    ) : null}
                </div>
            </div>

            {notice && (
                <div className={`rounded-2xl border px-5 py-4 text-sm font-medium ${notice.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/20 bg-red-500/10 text-red-300'
                    }`}>
                    {notice.text}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50">
                        <div className={`h-28 bg-gradient-to-r ${player.isBanned ? 'from-red-700 to-rose-900' : presence.inGame ? 'from-emerald-600 to-teal-700' : 'from-sky-600 to-indigo-700'}`}></div>
                        <div className="px-6 pb-6 -mt-14">
                            <div className="inline-flex rounded-3xl border border-slate-800 bg-[#020617] p-2">
                                <img
                                    src={player.avatarUrl}
                                    alt={player.username}
                                    className="h-24 w-24 rounded-2xl border border-slate-800 bg-slate-900 object-cover"
                                />
                            </div>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{player.displayName}</h2>
                                    <p className="text-sm font-medium text-slate-400">@{player.username}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">User ID</p>
                                        <p className="mt-2 text-sm font-mono font-bold text-sky-400">{player.id}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</p>
                                        <p className={`mt-2 text-sm font-bold ${player.isBanned ? 'text-red-400' : presence.inGame ? 'text-emerald-400' : 'text-slate-300'}`}>
                                            {player.isBanned ? 'Banned' : presence.inGame ? 'In Game' : 'Offline'}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Account Created</p>
                                    <p className="mt-2 text-sm font-semibold text-white">
                                        {player.created
                                            ? new Date(player.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                            : 'Unknown'}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live Presence</p>
                                    <p className="mt-2 text-sm font-semibold text-white">
                                        {presence.inGame && presence.jobId
                                            ? `Connected to ${presence.jobId.slice(0, 8).toUpperCase()}...`
                                            : 'Not in an active tracked server'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">About</p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-300">
                            {trimString(player.description) || 'No Roblox description is set for this account.'}
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Moderation</h2>
                                <p className="mt-1 text-sm font-medium text-slate-500">Kick, ban, or unban this user using your server-scoped dashboard permissions.</p>
                            </div>
                            <span className="rounded-full border border-slate-800 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {availableModerationCommands.length} available
                            </span>
                        </div>

                        {availableModerationCommands.length > 0 ? (
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {availableModerationCommands.map((command) => {
                                    const disabled = actionLoading === command.id || (command.id === 'KICK' && !presence.inGame);
                                    const colorClass = command.id === 'UNBAN'
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                        : command.id === 'KICK'
                                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                            : 'border-red-500/20 bg-red-500/10 text-red-300';

                                    return (
                                        <button
                                            key={command.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => sendPlayerCommand(
                                                command.id,
                                                command.id === 'KICK' && presence.jobId ? { job_id: presence.jobId } : {},
                                                `${command.label} ${player.username}?`,
                                            )}
                                            className={`rounded-2xl border px-4 py-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${colorClass}`}
                                        >
                                            <p className="text-xs font-black uppercase tracking-widest">
                                                {actionLoading === command.id ? 'Sending...' : command.label}
                                            </p>
                                            <p className="mt-2 text-[11px] font-medium text-current/80">{command.description}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-2xl border border-slate-800 bg-black/20 px-4 py-4 text-sm font-medium text-slate-500">
                                Your current dashboard roles do not grant moderation actions for this player.
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Live Player Commands</h2>
                                <p className="mt-1 text-sm font-medium text-slate-500">Targeted misc and runtime commands only appear if your dashboard role allows them.</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${presence.inGame
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                : 'border-slate-800 bg-black/20 text-slate-400'
                                }`}>
                                {presence.inGame ? 'Live target ready' : 'Offline target'}
                            </span>
                        </div>

                        {quickTargetCommands.length > 0 ? (
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {quickTargetCommands.map((command) => (
                                    <button
                                        key={command.id}
                                        type="button"
                                        disabled={actionLoading === command.id || !presence.inGame}
                                        onClick={() => sendPlayerCommand(command.id)}
                                        className="rounded-2xl border border-slate-800 bg-black/20 px-4 py-4 text-left transition-all hover:border-sky-500/30 hover:bg-sky-500/5 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <p className="text-xs font-black uppercase tracking-widest text-white">
                                            {actionLoading === command.id ? 'Sending...' : command.label}
                                        </p>
                                        <p className="mt-2 text-[11px] font-medium text-slate-500">{command.description}</p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-2xl border border-slate-800 bg-black/20 px-4 py-4 text-sm font-medium text-slate-500">
                                No live player commands are available for your current dashboard role.
                            </div>
                        )}

                        {(setCharCommand || valueCommands.length > 0) && (
                            <div className="mt-6 grid gap-4 xl:grid-cols-2">
                                {setCharCommand && (
                                    <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-white">{setCharCommand.label}</p>
                                        <p className="mt-2 text-[11px] font-medium text-slate-500">{setCharCommand.description}</p>
                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                            <input
                                                type="text"
                                                value={setCharValue}
                                                onChange={(event) => setSetCharValue(event.target.value)}
                                                placeholder="Username to copy avatar from"
                                                className="flex-1 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                                            />
                                            <button
                                                type="button"
                                                disabled={actionLoading === 'SET_CHAR' || !presence.inGame || !trimString(setCharValue)}
                                                onClick={() => sendPlayerCommand('SET_CHAR', { char_user: trimString(setCharValue) })}
                                                className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-300 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {actionLoading === 'SET_CHAR' ? 'Sending...' : 'Apply'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {valueCommands.map((command) => (
                                    <div key={command.id} className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-white">{command.label}</p>
                                        <p className="mt-2 text-[11px] font-medium text-slate-500">{command.description}</p>
                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                            <input
                                                type="text"
                                                value={valueInputs[command.id] || ''}
                                                onChange={(event) => setValueInputs((current) => ({ ...current, [command.id]: event.target.value }))}
                                                placeholder={formatCommandTarget(command.id)}
                                                className="flex-1 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                                            />
                                            <button
                                                type="button"
                                                disabled={actionLoading === command.id || !presence.inGame || !trimString(valueInputs[command.id])}
                                                onClick={() => sendPlayerCommand(command.id, { amount: trimString(valueInputs[command.id]) })}
                                                className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-300 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {actionLoading === command.id ? 'Sending...' : 'Apply'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Moderation History</h2>
                                <p className="mt-1 text-sm font-medium text-slate-500">Recent actions logged for this Roblox account in this Discord server.</p>
                            </div>
                            <span className="rounded-full border border-slate-800 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {logs.length} entries
                            </span>
                        </div>

                        {logs.length > 0 ? (
                            <div className="mt-5 space-y-3">
                                {logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`h-2.5 w-2.5 rounded-full ${log.action.includes('BAN')
                                                ? 'bg-red-400'
                                                : log.action === 'KICK'
                                                    ? 'bg-amber-400'
                                                    : 'bg-sky-400'
                                                }`}></span>
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-white">{log.action}</p>
                                                <p className="mt-1 text-[11px] font-medium text-slate-500">By {log.moderator}</p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
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
                            <div className="mt-5 rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm font-medium text-slate-500">
                                No prior moderation history was found for this Roblox user in this server.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
