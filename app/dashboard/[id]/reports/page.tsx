'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/context/PermissionsContext";

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

export default function ReportsPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const perms = usePermissions();

    // Reports State
    const [reports, setReports] = useState<any[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);

    if (!perms.can_manage_reports) return null;

    // Fetch Reports
    useEffect(() => {
        if (!id) return;

        async function fetchData() {
            setLoadingReports(true);

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

    return (
        <div className="space-y-8 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex flex-col gap-1 mb-8">
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <ReportIcon /> Reports System
                </h1>
                <p className="text-slate-500 text-sm font-medium">Manage and review player reports submitted via Discord.</p>
            </div>

            {/* Reports List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pending Reports <span className="ml-2 px-2 py-0.5 bg-sky-500/10 text-sky-500 rounded-full text-[10px]">{reports.length}</span></h3>
                    <button className="text-slate-500 hover:text-white transition-colors"><FilterIcon /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loadingReports ? (
                        <div className="col-span-full text-center py-8 text-slate-500 text-xs uppercase tracking-widest animate-pulse">Loading Reports...</div>
                    ) : reports.length === 0 ? (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs uppercase tracking-widest">
                            No pending reports
                        </div>
                    ) : (
                        reports.map(report => (
                            <Link
                                key={report.id}
                                href={`/dashboard/${id}/reports/${report.id}`}
                                className="block p-4 rounded-xl border bg-slate-900/40 border-slate-800/50 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{report.reported_roblox_username}</span>
                                    <span className="text-[10px] font-mono text-slate-500">{new Date(report.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-slate-400 text-xs line-clamp-2 mb-3">{report.reason}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                                    <span>By: {report.reporter_roblox_username || report.reporter_discord_id}</span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
