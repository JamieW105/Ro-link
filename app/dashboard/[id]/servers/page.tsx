'use client';

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LiveServer {
    id: string;
    server_id: string;
    player_count: number;
    updated_at: string;
}

// SVGs
const SignalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12a7 7 0 0 1 14 0" /><path d="M8.5 15.5a3.5 3.5 0 0 1 7 0" /><path d="M2 8a12 12 0 0 1 20 0" /><circle cx="12" cy="18" r="1" /></svg>
);

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const CpuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" /></svg>
);

const HistoryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

const HashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
);

export default function ServersPage() {
    const { id } = useParams();
    const [liveServers, setLiveServers] = useState<LiveServer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            if (!id) return;
            const { data, error } = await supabase
                .from('live_servers')
                .select('*')
                .eq('server_id', id)
                .order('updated_at', { ascending: false });

            if (!error && data) setLiveServers(data);
            setLoading(false);
        }

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [id]);

    const totalPlayers = liveServers.reduce((sum, s) => sum + s.player_count, 0);

    if (loading) return null;

    return (
        <div className="space-y-10 max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">Live Servers</h1>
                <p className="text-slate-500 text-sm font-medium">See live data from your game servers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-sky-500">
                        <SignalIcon />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Live Servers</span>
                    <h3 className="text-3xl font-bold text-white">{liveServers.length}</h3>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500">
                        <UsersIcon />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Concurrent Users</span>
                    <h3 className="text-3xl font-bold text-emerald-500">{totalPlayers}</h3>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-slate-500">
                        <CpuIcon />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Avg Players</span>
                    <h3 className="text-3xl font-bold text-slate-200">
                        {liveServers.length > 0 ? (totalPlayers / liveServers.length).toFixed(1) : "0.0"}
                    </h3>
                </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl shadow-xl overflow-hidden backdrop-blur-md">
                <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-3">
                        <span className="p-2 bg-sky-600/10 rounded-lg text-sky-500 border border-sky-500/10">
                            <HistoryIcon />
                        </span>
                        Servers List
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        Update: 10s <span className="w-1 h-1 bg-slate-700 rounded-full"></span> Live
                    </span>
                </div>

                {liveServers.length === 0 ? (
                    <div className="p-32 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                        No live servers found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest bg-slate-800/30">
                                <tr>
                                    <th className="px-8 py-3">Status</th>
                                    <th className="px-8 py-3">Server ID</th>
                                    <th className="px-8 py-3 text-center">Players</th>
                                    <th className="px-8 py-3 text-right">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {liveServers.map((server) => (
                                    <tr key={server.id} className="hover:bg-sky-500/5 transition-all group">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                <span className="text-[10px] font-bold text-emerald-500 tracking-tight uppercase">Nominal</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 px-8 py-4 font-mono text-[10px] text-slate-400 flex items-center gap-2">
                                            <HashIcon />
                                            {server.id.substring(0, 16).toUpperCase()}...
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center justify-center gap-4">
                                                <div className="w-32 bg-slate-800/50 h-1.5 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className="bg-sky-600 h-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${Math.min((server.player_count / 50) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="font-bold text-white w-4 text-center">{server.player_count}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-right text-slate-500 font-mono text-[10px] font-bold">
                                            {new Date(server.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden group">
                <div className="relative z-10 flex items-start gap-4">
                    <div className="p-3 bg-sky-500/10 rounded-lg text-sky-500 border border-sky-500/10">
                        <InfoIcon />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-tight">Auto-Cleanup</h4>
                        <p className="text-[11px] text-slate-500 font-medium tracking-tight">
                            Servers that stop sending data are automatically removed from this list to keep it accurate.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
