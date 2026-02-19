'use client';

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/context/PermissionsContext";

interface RobloxPlayer {
    id: number;
    username: string;
    displayName: string;
    description: string;
    created: string;
    avatarUrl: string;
    isBanned?: boolean;
}

// SVGs
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
);

const LiveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
);

export default function PlayerLookup() {
    const { id } = useParams();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState("");
    const [player, setPlayer] = useState<RobloxPlayer | null>(null);
    const [presence, setPresence] = useState<{ inGame: boolean, jobId?: string } | null>(null);
    const [linkedPlaceId, setLinkedPlaceId] = useState<string | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const perms = usePermissions();

    // Fetch Server Config (Place ID)
    useEffect(() => {
        async function fetchConfig() {
            if (!id) return;
            const { data } = await supabase.from('servers').select('place_id').eq('id', id).single();
            if (data) setLinkedPlaceId(data.place_id);
        }
        fetchConfig();
    }, [id]);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery) return;
        setLoading(true);
        setError(null);
        setPlayer(null);
        setPresence(null);
        setLogs([]);

        try {
            const res = await fetch(`/api/proxy?username=${searchQuery}&serverId=${id}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to find player');
            setPlayer(data);

            // Fetch Presence and Logs in Parallel
            const [serversRes, logsRes] = await Promise.all([
                supabase.from('live_servers').select('id, players').eq('server_id', id),
                supabase.from('logs').select('*').eq('server_id', id).eq('target', data.username).order('timestamp', { ascending: false })
            ]);

            if (serversRes.data) {
                const activeServer = serversRes.data.find((s: any) =>
                    s.players?.some((p: string) => p.toLowerCase() === data.username.toLowerCase())
                );
                if (activeServer) {
                    setPresence({ inGame: true, jobId: activeServer.id });
                } else {
                    setPresence({ inGame: false });
                }
            }

            if (logsRes.data) {
                setLogs(logsRes.data);
            }
            if (data.username) {
                await fetch('/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serverId: id,
                        action: 'LOOKUP',
                        target: data.username,
                        moderator: session?.user?.name || 'Web Admin'
                    })
                });
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id, session]);

    // Handle initial search from query param
    useEffect(() => {
        const usernameParam = searchParams.get('username');
        if (usernameParam) {
            setQuery(usernameParam);
            performSearch(usernameParam);
        }
    }, [searchParams, performSearch]);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        performSearch(query);
    }

    async function handleAction(action: 'KICK' | 'BAN' | 'UNBAN') {
        if (!player || !id) return;

        // Permission Checks
        if (action === 'KICK' && !perms.can_kick) {
            alert("You do not have permission to KICK players.");
            return;
        }

        if ((action === 'BAN' || action === 'UNBAN') && !perms.can_ban) {
            alert(`You do not have permission to ${action} players.`);
            return;
        }

        const confirmMsg = action === 'BAN'
            ? `Are you sure you want to PERMANENTLY BAN ${player.username}?`
            : action === 'KICK'
                ? `Kick ${player.username} from the game?`
                : `Unban ${player.username}?`;

        if (!confirm(confirmMsg)) return;

        setActionLoading(true);

        // 1. Queue in Database (Fallback & History)
        const { error: dbError } = await supabase
            .from('command_queue')
            .insert([{
                server_id: id,
                command: action,
                args: {
                    username: player.username,
                    job_id: action === 'KICK' ? presence?.jobId : null,
                    reason: 'Dashboard Action',
                    moderator: 'Web Admin'
                },
                status: 'PENDING'
            }]);

        // 2. Trigger Messaging Service (Instant Action)
        try {
            await fetch('/api/roblox/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    command: action,
                    args: {
                        username: player.username,
                        job_id: action === 'KICK' ? presence?.jobId : null,
                        reason: 'Dashboard Action',
                        moderator: 'Web Admin'
                    }
                })
            });
        } catch (msgError) {
            console.error('Messaging Service failed, falling back to polling.', msgError);
        }

        if (dbError) {
            alert("Error: " + dbError.message);
        } else {
            alert(`${action} signal sent to Roblox! (Instant via Open Cloud)`);

            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    action: action,
                    target: player.username,
                    moderator: session?.user?.name || 'Web Admin'
                })
            });

            // Re-fetch logs
            const { data } = await supabase.from('logs').select('*').eq('server_id', id).eq('target', player.username).order('timestamp', { ascending: false });
            if (data) setLogs(data);
        }
        setActionLoading(false);
    }

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">Player Lookup</h1>
                <p className="text-slate-500 text-sm font-medium">Search for Roblox users using official User API data.</p>
            </div>

            {/* Search Bar */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1 group">
                        <div className="absolute inset-y-0 left-4 flex items-center text-slate-500 group-focus-within:text-sky-500 transition-colors">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Type a Roblox username..."
                            className="w-full bg-black/40 border border-slate-800 rounded-lg pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !query}
                        className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-8 py-3 rounded-lg text-sm font-bold transition-all shadow-lg shadow-sky-900/20 flex items-center gap-2"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : "SEARCH"}
                    </button>
                </form>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-wider animate-in shake duration-300">
                    ⚠️ {error}
                </div>
            )}

            {player && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Player Card */}
                    <div className="lg:col-span-1 border border-slate-800 bg-[#020617] rounded-2xl overflow-hidden shadow-2xl h-fit">
                        <div className={`h-24 bg-gradient-to-r ${player.isBanned ? 'from-red-600 to-rose-900' : 'from-sky-600 to-indigo-600'}`}></div>
                        <div className="px-8 pb-8 -mt-12 text-center">
                            <div className="inline-block p-1.5 bg-[#020617] rounded-full mb-4">
                                <img
                                    src={player.avatarUrl}
                                    alt={player.username}
                                    className="w-24 h-24 rounded-full border border-slate-800 bg-slate-900 object-cover shadow-xl"
                                />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-1">{player.displayName}</h2>
                            <p className="text-slate-500 text-sm font-semibold mb-6">@{player.username}</p>

                            <div className="grid grid-cols-2 gap-3 mb-8">
                                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">User ID</span>
                                    <span className="text-xs font-mono font-bold text-sky-500">{player.id}</span>
                                </div>
                                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">Status</span>
                                    {presence?.inGame ? (
                                        <span className="text-[9px] font-bold text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 uppercase flex items-center justify-center gap-1.5">
                                            <LiveIcon /> IN GAME
                                        </span>
                                    ) : player.isBanned ? (
                                        <span className="text-[9px] font-bold text-red-500 px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/20 uppercase tracking-tighter">Banned</span>
                                    ) : (
                                        <span className="text-[9px] font-bold text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700 uppercase tracking-tighter">Offline</span>
                                    )}
                                </div>
                            </div>

                            {presence?.inGame && presence.jobId && linkedPlaceId ? (
                                <a
                                    href={`roblox://placeId=${linkedPlaceId}&gameInstanceId=${presence.jobId}`}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                                >
                                    <LiveIcon /> JOIN SERVER
                                </a>
                            ) : (
                                <button
                                    disabled={true}
                                    className="w-full bg-slate-800/50 border border-slate-700 text-slate-500 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-not-allowed opacity-50"
                                >
                                    JOIN SERVER (OFFLINE)
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Details & Actions */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                                <div className="p-2 bg-sky-600/10 rounded-lg text-sky-500 border border-sky-500/10">
                                    <UserIcon />
                                </div>
                                About Player
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Description</label>
                                    <p className="text-slate-400 text-sm leading-relaxed italic">
                                        &quot;{player.description || "No description provided."}&quot;
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Account Created</label>
                                    <p className="text-white text-sm font-semibold">
                                        {new Date(player.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                                <div className="p-2 bg-amber-600/10 rounded-lg text-amber-500 border border-amber-500/10">
                                    <ShieldIcon />
                                </div>
                                Moderation History
                            </h3>
                            {logs.length > 0 ? (
                                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {logs.map((log) => (
                                        <div key={log.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between group hover:bg-slate-800/50 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-2 h-2 rounded-full ${log.action === 'BAN' ? 'bg-red-500' : log.action === 'KICK' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{log.action}</span>
                                                    <p className="text-[11px] text-slate-500 mt-1 font-medium">By {log.moderator} • {new Date(log.timestamp).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest italic">No prior history found.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                                <div className="p-2 bg-red-600/10 rounded-lg text-red-500 border border-red-500/10">
                                    <ShieldIcon />
                                </div>
                                Quick Actions
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    onClick={() => handleAction('KICK')}
                                    disabled={actionLoading || !perms.can_kick}
                                    className="px-6 py-4 bg-orange-600/10 border border-orange-500/20 hover:bg-orange-500/20 text-orange-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    KICK PLAYER
                                </button>
                                <button
                                    onClick={() => handleAction('BAN')}
                                    disabled={actionLoading || !perms.can_ban}
                                    className="px-6 py-4 bg-red-600/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    BAN PLAYER
                                </button>
                                <button
                                    onClick={() => handleAction('UNBAN')}
                                    disabled={actionLoading || !perms.can_ban}
                                    className="px-6 py-4 bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    UNBAN PLAYER
                                </button>
                            </div>
                        </div>

                        <div className="p-6 bg-sky-500/5 rounded-xl border border-sky-500/10 flex items-start gap-4">
                            <div className="text-sky-500 mt-0.5">
                                <InfoIcon />
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                                Join Server and Presence features require the latest Kernel Update (v1.2).
                                If the player is currently in-game, you will see a &quot;LIVE&quot; badge above.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!player && !loading && (
                <div className="py-20 text-center space-y-4 max-w-md mx-auto">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-700 mx-auto border border-slate-800/50">
                        <UserIcon />
                    </div>
                    <div>
                        <h3 className="text-slate-300 font-bold uppercase text-[10px] tracking-[0.2em] mb-2">Search Required</h3>
                        <p className="text-slate-600 text-[11px] font-medium leading-relaxed">
                            Enter a Roblox username above to view their profile, avatar, and execute administrative actions across all game servers.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
