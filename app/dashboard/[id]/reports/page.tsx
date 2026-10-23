'use client';

import { Button } from '@/components/ui/button';


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
                <h1 className="text-2xl font-medium text-foreground tracking-tight flex items-center gap-2">
                    <ReportIcon /> Reports System
                </h1>
                <p className="text-muted-foreground text-sm font-medium">Manage and review player reports submitted via Discord.</p>
            </div>

            {/* Reports List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Pending Reports <span className="ml-2 px-2 py-0.5 bg-accent text-foreground rounded-full text-xs">{reports.length}</span></h3>
                    <Button variant="ghost" size="icon" className="transition-colors"><FilterIcon /></Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loadingReports ? (
                        <div className="col-span-full text-center py-8 text-muted-foreground text-xs animate-pulse">Loading Reports...</div>
                    ) : reports.length === 0 ? (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-border rounded-xl text-muted-foreground text-xs">
                            No pending reports
                        </div>
                    ) : (
                        reports.map(report => (
                            <Link
                                key={report.id}
                                href={`/dashboard/${id}/reports/${report.id}`}
                                className="block p-4 rounded-xl border bg-card border-border hover:bg-muted hover:border-border transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-medium text-foreground bg-muted px-2 py-0.5 rounded border border-border">{report.reported_roblox_username}</span>
                                    <span className="text-xs font-mono text-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-muted-foreground text-xs line-clamp-2 mb-3">{report.reason}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
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
