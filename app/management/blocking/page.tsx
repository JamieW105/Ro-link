'use client';

import { useEffect, useState } from 'react';

interface BlockedServer {
    guild_id: string;
    reason: string;
    blocked_by: string;
    blocked_at: string;
}

export default function BlockServers() {
    const [blocked, setBlocked] = useState<BlockedServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [idToBlock, setIdToBlock] = useState("");
    const [reason, setReason] = useState("");
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetch('/api/management/blocking')
            .then(res => res.json())
            .then(data => {
                setBlocked(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!idToBlock || !reason.trim()) return;
        setProcessing(true);
        try {
            const res = await fetch('/api/management/blocking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guildId: idToBlock, reason })
            });
            if (res.ok) {
                const data = await res.json();
                setBlocked(prev => [data, ...prev]);
                setIdToBlock("");
                setReason("");
                alert("Server blocked and data deleted.");
            } else {
                alert("Failed to block server");
            }
        } catch (err) {
            alert("Error blocking server");
        } finally {
            setProcessing(false);
        }
    };

    const handleUnblock = async (id: string) => {
        if (!confirm("Are you sure you want to unblock this server?")) return;
        try {
            const res = await fetch(`/api/management/blocking/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setBlocked(prev => prev.filter(b => b.guild_id !== id));
            }
        } catch (err) {
            alert("Error unblocking server");
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Blocked Servers</h1>
                <p className="text-slate-400 mt-1">Prevent specific servers from using Ro-Link.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form */}
                <div className="lg:col-span-1">
                    <form onSubmit={handleBlock} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4">
                        <h3 className="text-lg font-bold text-white">Block New Server</h3>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Server ID</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                                placeholder="Enter Discord Guild ID..."
                                value={idToBlock}
                                onChange={(e) => setIdToBlock(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Reason</label>
                            <textarea
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-red-500 h-24 resize-none"
                                placeholder="Reason for blocking..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={processing || !idToBlock || !reason.trim()}
                            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20"
                        >
                            {processing ? "Blocking..." : "Block Server"}
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800/50 text-slate-400 font-medium uppercase text-[10px] tracking-widest border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Guild ID</th>
                                    <th className="px-6 py-4">Reason</th>
                                    <th className="px-6 py-4">Blocked At</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {blocked.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-slate-500">No blocked servers found.</td>
                                    </tr>
                                ) : (
                                    blocked.map(b => (
                                        <tr key={b.guild_id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-white">{b.guild_id}</td>
                                            <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={b.reason}>{b.reason}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(b.blocked_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleUnblock(b.guild_id)}
                                                    className="text-sky-400 hover:text-sky-300 font-bold text-xs"
                                                >
                                                    Unblock
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
