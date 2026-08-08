'use client';

import { useEffect, useState } from 'react';
import { Ban, BriefcaseBusiness, ClipboardList, Server, type LucideIcon } from 'lucide-react';

export default function ManagementOverview() {
    const [stats, setStats] = useState({
        totalServers: 0,
        activeApplications: 0,
        totalSubmissions: 0,
        blockedServers: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/management/stats')
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8">
            <header>
                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Management Overview</h1>
                <p className="text-slate-400 mt-1">Global statistics and status for Ro-Link.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {([
                    { label: 'Total Servers', value: stats.totalServers, color: 'text-sky-400', icon: Server },
                    { label: 'Active Jobs', value: stats.activeApplications, color: 'text-emerald-400', icon: BriefcaseBusiness },
                    { label: 'Job Submissions', value: stats.totalSubmissions, color: 'text-purple-400', icon: ClipboardList },
                    { label: 'Blocked Servers', value: stats.blockedServers, color: 'text-red-400', icon: Ban },
                ] satisfies Array<{ label: string; value: number; color: string; icon: LucideIcon }>).map((stat) => {
                    const Icon = stat.icon;
                    return (
                    <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2 rounded-lg bg-slate-800 ${stat.color}`}>
                                <Icon className="h-5 w-5" fill="none" aria-hidden="true" />
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                        <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    </div>
                    );
                })}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8">
                <h2 className="mb-4 text-lg font-bold text-white md:text-xl">Developer Note</h2>
                <p className="text-slate-400 leading-relaxed">
                    This dashboard is restricted to authorized personnel. You can manage servers, block abusive communities, and handle job applications for the Ro-Link team.
                    Be careful with deletions as they are permanent.
                </p>
            </div>
        </div>
    );
}
