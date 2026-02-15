'use client';

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

// Icons
const ReportIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const FilterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
);
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);
const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default function ReportsPage() {
    const { id } = useParams();
    const { data: session } = useSession();

    // Config State
    const [reportsEnabled, setReportsEnabled] = useState(false);
    const [reportsChannelId, setReportsChannelId] = useState("");
    const [moderatorRoleId, setModeratorRoleId] = useState("");
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [savingConfig, setSavingConfig] = useState(false);

    // Reports State
    const [reports, setReports] = useState<any[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [selectedReport, setSelectedReport] = useState<any | null>(null);

    // Fetch Config & Reports
    useEffect(() => {
        if (!id) return;

        async function fetchData() {
            setLoadingConfig(true);
            setLoadingReports(true);

            // Fetch Settings
            const { data: serverData } = await supabase
                .from('servers')
                .select('reports_enabled, reports_channel_id, moderator_role_id')
                .eq('id', id)
                .single();

            if (serverData) {
                setReportsEnabled(serverData.reports_enabled || false);
                setReportsChannelId(serverData.reports_channel_id || "");
                setModeratorRoleId(serverData.moderator_role_id || "");
            }
            setLoadingConfig(false);

            // Fetch Reports
            const { data: reportData } = await supabase
                .from('reports')
                .select('*')
                .eq('server_id', id)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });

            if (reportData) {
                setReports(reportData);
            }
            setLoadingReports(false);
        }

        fetchData();
    }, [id]);

    // Save Settings
    const handleSaveSettings = async () => {
        setSavingConfig(true);
        const { error } = await supabase
            .from('servers')
            .update({
                reports_enabled: reportsEnabled,
                reports_channel_id: reportsChannelId,
                moderator_role_id: moderatorRoleId
            })
            .eq('id', id);

        if (error) alert("Failed to save settings: " + error.message);
        setSavingConfig(false);
    };

    // Quick Actions
    const handleQuickAction = async (reportId: string, action: string, type: 'DISCORD' | 'ROBLOX') => {
        if (!selectedReport) return;
        if (!confirm(`Are you sure you want to ${action} user ${selectedReport.reported_roblox_username}?`)) return;

        if (type === 'ROBLOX') {
            // Queue Action
            const { error: dbError } = await supabase.from('command_queue').insert([{
                server_id: id,
                command: action,
                args: {
                    username: selectedReport.reported_roblox_username,
                    reason: `Report Resolve: ${selectedReport.reason}`,
                    moderator: 'Web Admin'
                },
                status: 'PENDING'
            }]);

            if (dbError) {
                alert("Database Error: " + dbError.message);
                return;
            }

            // Trigger Real-time
            try {
                await fetch('/api/roblox/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serverId: id,
                        command: action,
                        args: {
                            username: selectedReport.reported_roblox_username,
                            reason: `Report Resolve: ${selectedReport.reason}`,
                            moderator: 'Web Admin'
                        }
                    })
                });
            } catch (e) {
                console.error("Messaging failed", e);
            }

            // Log it
            await supabase.from('logs').insert([{
                server_id: id,
                action: action,
                target: selectedReport.reported_roblox_username,
                moderator: 'Web Admin'
            }]);

            await handleResolve(reportId, `${action} applied to Roblox User.`);
        } else {
            alert("Discord moderation actions coming soon! (Requires new bot permissions scope)");
            await handleResolve(reportId, `${action} (Discord) marked as applied manually.`);
        }
    };

    const handleResolve = async (reportId: string, note: string) => {
        const { error } = await supabase
            .from('reports')
            .update({
                status: 'RESOLVED',
                moderator_id: (session?.user as any)?.id || 'Unknown',
                moderator_note: note,
                resolved_at: new Date().toISOString()
            })
            .eq('id', reportId);

        if (!error) {
            setReports(reports.filter(r => r.id !== reportId));
            setSelectedReport(null);
        } else {
            alert("Failed to resolve report: " + error.message);
        }
    };

    return (
        <div className="space-y-8 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <ReportIcon /> Reports System
                </h1>
                <p className="text-slate-500 text-sm font-medium">Manage and review player reports submitted via Discord.</p>
            </div>

            {/* Settings Card */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <SettingsIcon /> Configuration
                    </h3>
                    <button
                        onClick={handleSaveSettings}
                        disabled={savingConfig}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                    >
                        {savingConfig ? "SAVING..." : "SAVE CHANGES"}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                            <span className={`text-sm font-bold ${reportsEnabled ? "text-emerald-400" : "text-slate-500"}`}>
                                {reportsEnabled ? "ENABLED" : "DISABLED"}
                            </span>
                        </div>
                        <button
                            onClick={() => setReportsEnabled(!reportsEnabled)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${reportsEnabled ? "bg-emerald-500" : "bg-slate-700"}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${reportsEnabled ? "left-7" : "left-1"}`}></div>
                        </button>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Reports Channel ID</span>
                        <input
                            type="text"
                            value={reportsChannelId}
                            onChange={(e) => setReportsChannelId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                            placeholder="e.g. 123456789..."
                        />
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Moderator Role ID</span>
                        <input
                            type="text"
                            value={moderatorRoleId}
                            onChange={(e) => setModeratorRoleId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                            placeholder="e.g. 987654321..."
                        />
                    </div>
                </div>
            </div>

            {/* Reports List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List Column */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pending Reports <span className="ml-2 px-2 py-0.5 bg-sky-500/10 text-sky-500 rounded-full text-[10px]">{reports.length}</span></h3>
                        <button className="text-slate-500 hover:text-white transition-colors"><FilterIcon /></button>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {loadingReports ? (
                            <div className="text-center py-8 text-slate-500 text-xs uppercase tracking-widest animate-pulse">Loading Reports...</div>
                        ) : reports.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs uppercase tracking-widest">
                                No pending reports
                            </div>
                        ) : (
                            reports.map(report => (
                                <div
                                    key={report.id}
                                    onClick={() => setSelectedReport(report)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedReport?.id === report.id
                                        ? "bg-sky-600/10 border-sky-500/30 shadow-lg shadow-sky-900/10"
                                        : "bg-slate-900/40 border-slate-800/50 hover:bg-slate-800 hover:border-slate-700"}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{report.reported_roblox_username}</span>
                                        <span className="text-[10px] font-mono text-slate-500">{new Date(report.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-slate-400 text-xs line-clamp-2 mb-3">{report.reason}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                                        <span>By: {report.reporter_roblox_username || report.reporter_discord_id}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail Column */}
                <div className="lg:col-span-2">
                    {selectedReport ? (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md sticky top-24">
                            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Report Details</h2>
                                    <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">ID: {selectedReport.id}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleResolve(selectedReport.id, "Dismissed via Dashboard")}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                                    >
                                        <XIcon /> Dismiss
                                    </button>
                                    <button
                                        onClick={() => handleResolve(selectedReport.id, "Resolved via Dashboard")}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                                    >
                                        <CheckIcon /> Resolve
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Reported User</label>
                                    <div className="text-white font-bold text-lg">{selectedReport.reported_roblox_username}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Reporter</label>
                                    <div className="text-white font-semibold">{selectedReport.reporter_roblox_username || "Unknown"}</div>
                                    <div className="text-slate-500 text-xs font-mono mt-1">Discord ID: {selectedReport.reporter_discord_id}</div>
                                </div>
                            </div>

                            <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50 mb-8">
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Reason / Evidence</label>
                                <p className="text-slate-300 text-sm leading-relaxed">{selectedReport.reason}</p>
                            </div>

                            {/* Actions */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Actions</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Discord Actions */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Discord Actions</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => handleQuickAction(selectedReport.id, 'TIMEOUT', 'DISCORD')} className="p-2 bg-slate-800 hover:bg-orange-900/20 hover:text-orange-400 border border-slate-700 rounded text-xs font-bold transition-colors">Timeout</button>
                                            <button onClick={() => handleQuickAction(selectedReport.id, 'KICK', 'DISCORD')} className="p-2 bg-slate-800 hover:bg-red-900/20 hover:text-red-400 border border-slate-700 rounded text-xs font-bold transition-colors">Kick</button>
                                            <button onClick={() => handleQuickAction(selectedReport.id, 'BAN', 'DISCORD')} className="p-2 bg-slate-800 hover:bg-red-900/20 hover:text-red-400 border border-slate-700 rounded text-xs font-bold col-span-2 transition-colors">Ban User</button>
                                        </div>
                                    </div>

                                    {/* Roblox Actions */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Roblox Actions</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => handleQuickAction(selectedReport.id, 'KICK', 'ROBLOX')} className="p-2 bg-slate-800 hover:bg-orange-900/20 hover:text-orange-400 border border-slate-700 rounded text-xs font-bold transition-colors">Kick</button>
                                            <button onClick={() => handleQuickAction(selectedReport.id, 'SOFTBAN', 'ROBLOX')} className="p-2 bg-slate-800 hover:bg-red-900/20 hover:text-red-400 border border-slate-700 rounded text-xs font-bold transition-colors">Soft Ban (12h)</button>
                                            <button onClick={() => handleQuickAction(selectedReport.id, 'BAN', 'ROBLOX')} className="p-2 bg-slate-800 hover:bg-red-900/20 hover:text-red-400 border border-slate-700 rounded text-xs font-bold col-span-2 transition-colors">Perm Ban</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center border border-slate-800/50 rounded-2xl bg-slate-900/20">
                            <div className="p-4 bg-slate-800/50 rounded-full mb-4 text-slate-600">
                                <ReportIcon />
                            </div>
                            <h3 className="text-slate-400 font-bold uppercase text-xs tracking-widest">Select a Report</h3>
                            <p className="text-slate-600 text-sm mt-2 max-w-xs">Click on any pending report from the list to view details and take action.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
