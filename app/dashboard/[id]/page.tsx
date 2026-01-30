'use client';

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Log {
    id: string;
    action: string;
    target: string;
    moderator: string;
    timestamp: string;
}

// SVGs
const ScrollIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" /><path d="M12 11V7" /><path d="M12 17v-2" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h8" /></svg>
);

const KeyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2a5 5 0 0 0-7 7l-9 9v3h3l9-9a5 5 0 0 0 7-7l2-2Z" /><path d="m15 5 4 4" /></svg>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);

const ActivityIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
);

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
);

export default function ServerDashboard() {
    const { id } = useParams();
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            if (!id) return;
            const { data: server } = await supabase
                .from('servers')
                .select('*')
                .eq('id', id)
                .single();

            if (server) setApiKey(server.api_key);

            const { data: logData } = await supabase
                .from('logs')
                .select('*')
                .eq('server_id', id)
                .order('timestamp', { ascending: false })
                .limit(10);

            if (logData) setLogs(logData);
            setLoading(false);
        }
        fetchData();
    }, [id]);

    if (loading) return null;

    return (
        <div className="space-y-8 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header / Intro */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">Overview</h1>
                <p className="text-slate-500 text-sm font-medium">See what&apos;s happening in your game.</p>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <ActivityIcon />
                            Health
                        </span>
                        <span className="text-[9px] font-bold text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 uppercase tracking-tighter">Online</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-bold text-white">99.9%</h3>
                        <span className="text-xs font-semibold text-slate-500">Uptime</span>
                    </div>
                    <div className="w-full bg-slate-800/50 h-1 mt-6 rounded-full overflow-hidden">
                        <div className="bg-sky-500 h-full w-[99.9%]"></div>
                    </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <GlobeIcon />
                            Activity
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-bold text-white">{logs.length}</h3>
                        <span className="text-xs font-semibold text-slate-500">Today</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-5 font-medium uppercase tracking-tight">Synced across all nodes</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <KeyIcon />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">Security Key</span>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-black/40 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-sky-500 truncate select-none">
                            {apiKey}
                        </code>
                        <button
                            onClick={() => navigator.clipboard.writeText(apiKey || '')}
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all rounded-lg border border-slate-700 active:scale-95 shadow-sm"
                        >
                            <CopyIcon />
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-600 mt-3 font-semibold uppercase tracking-tight">Connect your game using this key.</p>
                </div>
            </div>

            {/* Activity Stream */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl shadow-xl relative overflow-hidden backdrop-blur-md">
                <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-3">
                        <span className="p-2 bg-sky-600/10 rounded-lg text-sky-500 border border-sky-500/10">
                            <ScrollIcon />
                        </span>
                        Recent Activity
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        Live Feed
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {logs.length === 0 ? (
                        <div className="p-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                            Waiting for activity...
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest bg-slate-800/30">
                                <tr>
                                    <th className="px-8 py-3">Action</th>
                                    <th className="px-8 py-3">Server</th>
                                    <th className="px-8 py-3">Moderator</th>
                                    <th className="px-8 py-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-sky-500/5 transition-all group">
                                        <td className="px-8 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-tight border inline-block ${log.action === 'BAN' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                log.action === 'KICK' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                    'bg-sky-500/10 text-sky-500 border-sky-500/20'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 font-semibold text-white">{log.target}</td>
                                        <td className="px-8 py-4 text-slate-400 font-medium">{log.moderator}</td>
                                        <td className="px-8 py-4 text-right text-slate-600 font-mono text-[10px] font-bold">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center gap-4">
                <div className="p-3 bg-sky-500/10 rounded-lg text-sky-500 border border-sky-500/10">
                    <GlobeIcon />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-tight">Live Monitoring</h4>
                    <p className="text-[11px] text-slate-500 font-medium tracking-tight">Your game is safely connected and monitored.</p>
                </div>
            </div>
        </div>
    );
}
