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

export default function LogsPage() {
    const { id } = useParams();
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLogs() {
            if (!id) return;

            const { data } = await supabase
                .from('logs')
                .select('*')
                .eq('server_id', id)
                .order('timestamp', { ascending: false })
                .limit(50); // Fetch more logs for the dedicated page

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
                    setLogs((prev) => [payload.new as Log, ...prev].slice(0, 50));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [id]);

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
                <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-3">
                        Latest Events
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        Live Feed
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {logs.length === 0 ? (
                        <div className="p-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                            No logs found.
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
