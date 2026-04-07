'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
    canUseDashboardCommand,
    getAdminPanelCommandDefinition,
    MISC_ACTION_COMMAND_IDS,
    VALUE_INPUT_COMMAND_IDS,
} from "@/lib/adminPanelCommands";
import { normalizeLivePlayerList } from "@/lib/livePlayers";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/context/PermissionsContext";

interface LiveServer {
    id: string;
    players?: unknown;
}

interface PlayerSummary {
    name: string;
    displayName: string;
    userId: string | null;
    avatarUrl: string | null;
    serverId: string;
}

const VALUE_INPUT_CONFIG: Record<string, { prompt: string; defaultValue: string }> = {
    DAMAGE: {
        prompt: 'Enter damage amount to apply:',
        defaultValue: '25',
    },
    MAX_HEALTH: {
        prompt: 'Enter the max health value:',
        defaultValue: '100',
    },
    WALK_SPEED: {
        prompt: 'Enter the walk speed value:',
        defaultValue: '16',
    },
    JUMP_POWER: {
        prompt: 'Enter the jump power value:',
        defaultValue: '50',
    },
};

const VALUE_COMMAND_SET = new Set<string>(VALUE_INPUT_COMMAND_IDS);

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function getCommandLabel(commandId: string) {
    return getAdminPanelCommandDefinition(commandId)?.label || commandId.replace(/_/g, ' ');
}

function getActionButtonClasses(commandId: string) {
    if (commandId === 'KILL') {
        return 'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border-red-500/20';
    }

    if (commandId === 'HEAL' || commandId === 'UNFREEZE' || commandId === 'FORCEFIELD_ADD') {
        return 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border-emerald-500/20';
    }

    if (commandId === 'FREEZE' || commandId === 'FORCEFIELD_REMOVE') {
        return 'bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border-amber-500/20';
    }

    if (VALUE_COMMAND_SET.has(commandId) || commandId === 'SET_CHAR') {
        return 'bg-violet-500/10 hover:bg-violet-500 text-violet-400 hover:text-white border-violet-500/20';
    }

    return 'bg-slate-800 hover:bg-sky-600 text-white border-slate-700';
}

const MagicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
    </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
);

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
);

export default function MiscPage() {
    const { id: guildId } = useParams();
    const [players, setPlayers] = useState<PlayerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const perms = usePermissions();

    useEffect(() => {
        async function fetchPlayers() {
            if (!guildId) return;

            const { data, error } = await supabase
                .from('live_servers')
                .select('id, players')
                .eq('server_id', guildId);

            if (!error && data) {
                const allPlayers: PlayerSummary[] = [];
                data.forEach((server: LiveServer) => {
                    normalizeLivePlayerList(server.players).forEach((player) => {
                        allPlayers.push({
                            name: player.username,
                            displayName: player.displayName,
                            userId: player.userId,
                            avatarUrl: player.avatarUrl,
                            serverId: server.id,
                        });
                    });
                });

                setPlayers(allPlayers);
            }

            setLoading(false);
        }

        fetchPlayers();
        const interval = setInterval(fetchPlayers, 15000);
        return () => clearInterval(interval);
    }, [guildId]);

    async function handleAction(target: string, action: string) {
        if (!guildId) return;

        if (!canUseDashboardCommand(perms, action)) {
            alert("You do not have permission to use this command.");
            return;
        }

        const extraArgs: Record<string, unknown> = {};

        if (action === 'SET_CHAR') {
            const charUser = trimString(prompt(`Enter the Roblox username to copy onto ${target}:`, ''));
            if (!charUser) {
                return;
            }
            extraArgs.char_user = charUser;
        }

        if (VALUE_COMMAND_SET.has(action)) {
            const config = VALUE_INPUT_CONFIG[action];
            const amount = trimString(prompt(config.prompt, config.defaultValue));
            if (!amount) {
                return;
            }
            extraArgs.amount = amount;
        }

        setActionLoading(`${target}-${action}`);

        const res = await fetch('/api/dashboard/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: guildId,
                command: action,
                args: {
                    username: target,
                    ...extraArgs,
                },
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert("Error: " + (data.error || 'Failed to send command.'));
        }

        setActionLoading(null);
    }

    function renderActions(target: string) {
        const availableActions = [...MISC_ACTION_COMMAND_IDS].filter((action) => canUseDashboardCommand(perms, action));
        const instantActions = availableActions.filter((action) => action !== 'SET_CHAR' && !VALUE_COMMAND_SET.has(action));
        const promptedActions = availableActions.filter((action) => action === 'SET_CHAR' || VALUE_COMMAND_SET.has(action));

        return (
            <div className="space-y-3">
                {instantActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {instantActions.map((action) => (
                            <button
                                key={action}
                                disabled={actionLoading === `${target}-${action}`}
                                onClick={() => handleAction(target, action)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all border disabled:opacity-50 ${getActionButtonClasses(action)}`}
                            >
                                {actionLoading === `${target}-${action}` ? "..." : getCommandLabel(action)}
                            </button>
                        ))}
                    </div>
                )}

                {promptedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {promptedActions.map((action) => (
                            <button
                                key={action}
                                disabled={actionLoading === `${target}-${action}`}
                                onClick={() => handleAction(target, action)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all border disabled:opacity-50 ${getActionButtonClasses(action)}`}
                            >
                                {actionLoading === `${target}-${action}` ? "..." : getCommandLabel(action)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (loading) return null;

    const query = trimString(searchQuery).toLowerCase();
    const filteredPlayers = players.filter((player) =>
        player.name.toLowerCase().includes(query)
        || player.displayName.toLowerCase().includes(query),
    );

    const isManualTarget = query.length > 0 && !players.some((player) => player.name.toLowerCase() === query);

    return (
        <div className="space-y-10 max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1 text-left">
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-sky-600/10 rounded-lg text-sky-500 border border-sky-500/10">
                        <MagicIcon />
                    </span>
                    Miscellaneous Actions
                </h1>
                <p className="text-slate-500 text-sm font-medium">Run every non-global admin panel command that targets a live player.</p>
            </div>

            <div className="w-full">
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Search live players or enter a username for a manual target..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="w-full bg-black/40 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[400px]">
                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center">
                        <h2 className="text-xs font-bold text-white uppercase tracking-widest">
                            {searchQuery ? `Search Results (${filteredPlayers.length})` : `Active Players (${players.length})`}
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-800/50 max-h-[700px] overflow-y-auto custom-scrollbar">
                        {isManualTarget && (
                            <div className="p-6 bg-sky-500/5 border-b border-sky-500/10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="px-2 py-0.5 bg-sky-600 text-white text-[9px] font-black uppercase rounded">Manual Target</div>
                                    <h3 className="font-bold text-white text-sm">{searchQuery}</h3>
                                </div>
                                {renderActions(searchQuery)}
                            </div>
                        )}

                        {filteredPlayers.length === 0 && !isManualTarget ? (
                            <div className="p-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                                {searchQuery ? "No matching players found." : "No players online."}
                            </div>
                        ) : (
                            filteredPlayers.map((player) => (
                                <div key={`${player.name}-${player.serverId}`} className="p-6 hover:bg-sky-500/5 transition-all">
                                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                                        <div className="flex items-center gap-4 min-w-0">
                                            {player.avatarUrl ? (
                                                <img
                                                    src={player.avatarUrl}
                                                    alt={player.name}
                                                    className="w-10 h-10 rounded-full border border-slate-700 bg-slate-900 object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-700">
                                                    <UserIcon />
                                                </div>
                                            )}

                                            <div className="min-w-0">
                                                <Link
                                                    href={`/dashboard/${guildId}/players/${encodeURIComponent(player.name)}`}
                                                    className="font-bold text-white text-sm hover:text-sky-400 transition-colors"
                                                >
                                                    {player.displayName}
                                                </Link>
                                                <p className="truncate text-[10px] font-mono text-slate-500 uppercase tracking-tighter">
                                                    @{player.name} • {player.userId || 'NO ID'} • SERVER: {player.serverId.substring(0, 8)}...
                                                </p>
                                            </div>
                                        </div>

                                        <div className="max-w-4xl xl:text-right">
                                            {renderActions(player.name)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
            `}</style>
        </div>
    );
}
