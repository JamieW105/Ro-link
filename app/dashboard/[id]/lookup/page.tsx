'use client';

import { useParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

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
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
);

const LiveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
);

export default function PlayerLookup() {
    const { id } = useParams();
    const [query, setQuery] = useState("");
    const [player, setPlayer] = useState<RobloxPlayer | null>(null);
    const [presence, setPresence] = useState<{ inGame: boolean, jobId?: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!query) return;
        setLoading(true);
        setError(null);
        setPlayer(null);
        setPresence(null);

        try {
            const res = await fetch(`/api/roblox/proxy?username=${query}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to find player');
            setPlayer(data);

            // Check Presence in Live Servers
            const { data: servers } = await supabase
                .from('live_servers')
                .select('id, players')
                .eq('server_id', id);

            if (servers) {
                const activeServer = servers.find((s: any) =>
                    s.players?.some((p: string) => p.toLowerCase() === data.username.toLowerCase())
                );
                if (activeServer) {
                    setPresence({ inGame: true, jobId: activeServer.id });
                } else {
                    setPresence({ inGame: false });
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(action: 'KICK' | 'BAN' | 'UNBAN') {
        if (!player || !id) return;

        const confirmMsg = action === 'BAN'
            ? `Are you sure you want to PERMANENTLY BAN ${player.username}?`
            : action === 'KICK'
                ? `Kick ${player.username} from the game?`
                : `Unban ${player.username}?`;

        if (!confirm(confirmMsg)) return;

        setActionLoading(true);
        const { error } = await supabase
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

        if (error) {
            alert("Error: " + error.message);
        } else {
            alert(`${action} command queued for ${player.username}!`);

            // Log the action locally too
            await supabase.from('logs').insert([{
                server_id: id,
                action: action,
                target: player.username,
                moderator: 'Web Admin'
            }]);
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
                    <div className="lg:col-span-1 border border-slate-800 bg-[#020617] rounded-2xl overflow-hidden shadow-2xl">
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

                            {presence?.inGame && presence.jobId ? (
                                <a
                                    href={`roblox://placeId=${id}&gameInstanceId=${presence.jobId}`}
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
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                                <div className="p-2 bg-red-600/10 rounded-lg text-red-500 border border-red-500/10">
                                    <ShieldIcon />
                                </div>
                                Quick Actions
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    onClick={() => handleAction('KICK')}
                                    disabled={actionLoading}
                                    className="px-6 py-4 bg-orange-600/10 border border-orange-500/20 hover:bg-orange-500/20 text-orange-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
                                >
                                    KICK PLAYER
                                </button>
                                <button
                                    onClick={() => handleAction('BAN')}
                                    disabled={actionLoading}
                                    className="px-6 py-4 bg-red-600/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
                                >
                                    BAN PLAYER
                                </button>
                                <button
                                    onClick={() => handleAction('UNBAN')}
                                    disabled={actionLoading}
                                    className="px-6 py-4 bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
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
