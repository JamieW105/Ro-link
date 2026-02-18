'use client';

import { useEffect, useState } from 'react';

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
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Management Overview</h1>
                <p className="text-slate-400 mt-1">Global statistics and status for Ro-Link.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Servers', value: stats.totalServers, color: 'text-sky-400', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                    { label: 'Active Jobs', value: stats.activeApplications, color: 'text-emerald-400', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                    { label: 'Job Submissions', value: stats.totalSubmissions, color: 'text-purple-400', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
                    { label: 'Blocked Servers', value: stats.blockedServers, color: 'text-red-400', icon: 'M18.36 6.64a9 9 0 11-12.73 0M12 2v10' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2 rounded-lg bg-slate-800 ${stat.color}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                                </svg>
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                        <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-4">Developer Note</h2>
                <p className="text-slate-400 leading-relaxed">
                    This dashboard is restricted to authorized personnel. You can manage servers, block abusive communities, and handle job applications for the Ro-Link team.
                    Be careful with deletions as they are permanent.
                </p>
            </div>
        </div>
    );
}
