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

const ScrollIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" /><path d="M12 11V7" /><path d="M12 17v-2" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h8" /></svg>
);

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
);

const SortIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
);

export default function LogsPage() {
    const { id } = useParams();
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(false);

    useEffect(() => {
        async function fetchLogs() {
            if (!id) return;

            const { data } = await supabase
                .from('logs')
                .select('*')
                .eq('server_id', id)
                .order('timestamp', { ascending: false })
                .limit(200);

            if (data) setLogs(data);
            setLoading(false);
        }
        fetchLogs();

        const channel = supabase
            .channel(`logs_page_${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'logs',
                    filter: `server_id=eq.${id}`
                },
                (payload) => {
                    setLogs((prev) => [payload.new as Log, ...prev].slice(0, 200));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [id]);

    const filteredLogs = logs
        .filter(log =>
            (log.target?.toLowerCase() || "").includes(search.toLowerCase()) ||
            (log.action?.toLowerCase() || "").includes(search.toLowerCase()) ||
            (log.moderator?.toLowerCase() || "").includes(search.toLowerCase())
        )
        .sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return sortAsc ? timeA - timeB : timeB - timeA;
        });

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full pb-20">
            {/* Page Header */}
            <div className="mb-10 pb-8 border-b border-slate-800/60">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-sky-600/10 rounded-2xl flex items-center justify-center text-sky-500 border border-sky-500/20 shadow-2xl shadow-sky-900/10">
                        <ScrollIcon />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Activity Logs</h1>
                        <p className="text-slate-500 text-sm font-medium mt-1">Real-time audit trail of all server actions.</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl shadow-xl relative overflow-hidden backdrop-blur-md">
                {/* Controls */}
                <div className="px-6 py-5 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-96 group">
                        <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 group-focus-within:text-sky-500 transition-colors">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search logs by user, action..."
                            className="w-full bg-black/40 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-sky-500 transition-all placeholder:text-slate-600 uppercase tracking-wide"
                        />
                    </div>

                    <button
                        onClick={() => setSortAsc(!sortAsc)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider"
                    >
                        <SortIcon />
                        {sortAsc ? "Oldest First" : "Newest First"}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {filteredLogs.length === 0 ? (
                        <div className="p-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                            No logs found matching your criteria.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest bg-slate-800/30">
                                <tr>
                                    <th className="px-8 py-3">Action</th>
                                    <th className="px-8 py-3">Target</th>
                                    <th className="px-8 py-3">Moderator</th>
                                    <th className="px-8 py-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-sky-500/5 transition-all group">
                                        <td className="px-8 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-tight border inline-block ${log.action === 'BAN' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                log.action === 'KICK' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                    log.action.includes('LOOKUP') ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                                                        'bg-sky-500/10 text-sky-500 border-sky-500/20'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 font-semibold text-white">{log.target}</td>
                                        <td className="px-8 py-4 text-slate-400 font-medium">{log.moderator}</td>
                                        <td className="px-8 py-4 text-right text-slate-600 font-mono text-[10px] font-bold">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            <span className="ml-2 text-slate-700">{new Date(log.timestamp).toLocaleDateString()}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
