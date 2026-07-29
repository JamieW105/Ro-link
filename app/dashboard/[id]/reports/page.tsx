'use client';

import { FileText as LucideFileText, Funnel as LucideFunnel } from 'lucide-react';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { usePermissions } from "@/context/PermissionsContext";

// Icons
const ReportIcon = () => (
    <LucideFileText width="20" height="20" strokeWidth="2" />
);
const FilterIcon = () => (
    <LucideFunnel width="16" height="16" strokeWidth="2" />
);
export default function ReportsPage() {
    const { id } = useParams();
    const perms = usePermissions();

    // Reports State
    const [reports, setReports] = useState<any[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);

    // Fetch Reports
    useEffect(() => {
        if (!id) return;

        async function fetchData() {
            setLoadingReports(true);

            try {
                const response = await fetch(`/api/reports?serverId=${encodeURIComponent(String(id))}&status=PENDING`, {
                    cache: 'no-store',
                });

                if (!response.ok) {
                    throw new Error(`Failed to load reports (${response.status})`);
                }

                const reportData = await response.json();
                if (Array.isArray(reportData)) {
                    setReports(reportData);
                } else {
                    setReports([]);
                }
            } catch (error) {
                console.error("Failed to fetch reports:", error);
                setReports([]);
            }

            setLoadingReports(false);
        }

        fetchData();
    }, [id]);

    if (!perms.can_manage_reports) return null;

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
