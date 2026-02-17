'use client';

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/context/PermissionsContext";

interface LiveServer {
    id: string;
    players: string[];
    updated_at?: string;
}

// Icons
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
    const { data: session } = useSession();
    const [players, setPlayers] = useState<{ name: string; serverId: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [charUser, setCharUser] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        async function fetchPlayers() {
            if (!guildId) return;
            const { data, error } = await supabase
                .from('live_servers')
                .select('id, players')
                .eq('server_id', guildId);

            if (!error && data) {
                const allPlayers: { name: string; serverId: string }[] = [];
                data.forEach((server: LiveServer) => {
                    if (Array.isArray(server.players)) {
                        server.players.forEach(p => {
                            allPlayers.push({ name: p, serverId: server.id });
                        });
                    }
                });
                setPlayers(allPlayers);
            }
            setLoading(false);
        }

        fetchPlayers();
        const interval = setInterval(fetchPlayers, 15000);
        return () => clearInterval(interval);
    }, [guildId]);

    const perms = usePermissions();

    async function handleAction(target: string, action: string, extraArgs = {}) {
        if (!guildId) return;

        // Final permission check before sending
        const isAllowed = perms.is_admin || perms.allowed_misc_cmds.includes('*') || perms.allowed_misc_cmds.includes(action);
        if (!isAllowed) {
            alert("You do not have permission to use this command.");
            return;
        }

        setActionLoading(`${target}-${action}`);

        const { error } = await supabase
            .from('command_queue')
            .insert([{
                server_id: guildId,
                command: action,
                args: {
                    username: target,
                    moderator: session?.user?.name || "Dashboard",
                    ...extraArgs
                },
                status: 'PENDING'
            }]);

        if (error) {
            alert("Error: " + error.message);
        }
        setActionLoading(null);
    }

    if (loading) return null;

    const filteredPlayers = players.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isManualTarget = searchQuery.length > 0 && !players.some(p => p.name.toLowerCase() === searchQuery.toLowerCase());

    const availableActions = ['FLY', 'NOCLIP', 'INVIS', 'GHOST', 'HEAL', 'KILL', 'RESET', 'REFRESH'].filter(action =>
        perms.is_admin || perms.allowed_misc_cmds.includes('*') || perms.allowed_misc_cmds.includes(action)
    );

    return (
        <div className="space-y-10 max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1 text-left">
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-sky-600/10 rounded-lg text-sky-500 border border-sky-500/10">
                        <MagicIcon />
                    </span>
                    Miscellaneous Actions
                </h1>
                <p className="text-slate-500 text-sm font-medium">Manage player effects and appearances across all live servers.</p>
            </div>

            <div className="w-full">
                {/* Search & Manual Bar */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Search live players or enter username for manual action..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Player List */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[400px]">
                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center">
                        <h2 className="text-xs font-bold text-white uppercase tracking-widest">
                            {searchQuery ? `Search Results (${filteredPlayers.length})` : `Active Players (${players.length})`}
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-800/50 max-h-[700px] overflow-y-auto custom-scrollbar">
                        {/* Manual Target Row (Only shown if searching and no exact match) */}
                        {isManualTarget && (
                            <div className="p-6 bg-sky-500/5 border-b border-sky-500/10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="px-2 py-0.5 bg-sky-600 text-white text-[9px] font-black uppercase rounded">Manual Target</div>
                                    <h3 className="font-bold text-white text-sm">{searchQuery}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {availableActions.map(action => (
                                        <button
                                            key={action}
                                            disabled={actionLoading === `${searchQuery}-${action}`}
                                            onClick={() => handleAction(searchQuery, action)}
                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all border disabled:opacity-50 ${action === 'KILL' ? 'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border-red-500/20' :
                                                action === 'HEAL' ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border-emerald-500/20' :
                                                    'bg-slate-800 hover:bg-sky-600 text-white border-slate-700'
                                                }`}
                                        >
                                            {actionLoading === `${searchQuery}-${action}` ? "..." : action}
                                        </button>
                                    ))}
                                </div>
                                {(perms.is_admin || perms.allowed_misc_cmds.includes('*') || perms.allowed_misc_cmds.includes('SET_CHAR')) && (
                                    <div className="mt-4 flex gap-2 max-w-md">
                                        <input
                                            type="text"
                                            placeholder="Username to copy appearance..."
                                            value={charUser}
                                            onChange={(e) => setCharUser(e.target.value)}
                                            className="flex-1 bg-black/40 border border-slate-800 rounded-md px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium"
                                        />
                                        <button
                                            disabled={!charUser || actionLoading === `${searchQuery}-SET_CHAR`}
                                            onClick={() => {
                                                handleAction(searchQuery, 'SET_CHAR', { char_user: charUser });
                                                setCharUser("");
                                            }}
                                            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-[10px] font-bold uppercase tracking-tight transition-all disabled:opacity-50"
                                        >
                                            Set Char
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {filteredPlayers.length === 0 && !isManualTarget ? (
                            <div className="p-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                                {searchQuery ? "No matching players found." : "No players online."}
                            </div>
                        ) : (
                            filteredPlayers.map(player => (
                                <div key={`${player.name}-${player.serverId}`} className="p-6 hover:bg-sky-500/5 transition-all">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-700">
                                                <UserIcon />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm">{player.name}</h3>
                                                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">SERVER: {player.serverId.substring(0, 8)}...</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {availableActions.map(action => (
                                                <button
                                                    key={action}
                                                    disabled={actionLoading === `${player.name}-${action}`}
                                                    onClick={() => handleAction(player.name, action)}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all border disabled:opacity-50 ${action === 'KILL' ? 'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border-red-500/20' :
                                                        action === 'HEAL' ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border-emerald-500/20' :
                                                            'bg-slate-800 hover:bg-sky-600 text-white border-slate-700'
                                                        }`}
                                                >
                                                    {actionLoading === `${player.name}-${action}` ? "..." : action}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Set Char Input */}
                                    {(perms.is_admin || perms.allowed_misc_cmds.includes('*') || perms.allowed_misc_cmds.includes('SET_CHAR')) && (
                                        <div className="mt-4 flex gap-2 max-w-md">
                                            <input
                                                type="text"
                                                placeholder="Enter Character Username..."
                                                value={charUser}
                                                onChange={(e) => setCharUser(e.target.value)}
                                                className="flex-1 bg-black/40 border border-slate-800 rounded-md px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-medium"
                                            />
                                            <button
                                                disabled={!charUser || actionLoading === `${player.name}-SET_CHAR`}
                                                onClick={() => {
                                                    handleAction(player.name, 'SET_CHAR', { char_user: charUser });
                                                    setCharUser("");
                                                }}
                                                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-[10px] font-bold uppercase tracking-tight transition-all disabled:opacity-50"
                                            >
                                                {actionLoading === `${player.name}-SET_CHAR` ? "..." : "Set Char"}
                                            </button>
                                        </div>
                                    )}
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
