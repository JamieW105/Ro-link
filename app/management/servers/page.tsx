'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Server {
    id: string;
    name: string;
    icon: string;
    owner_id: string;
    created_at: string;
    is_setup: boolean;
    bot_present?: boolean;
}

interface CustomDashboard {
    id: string;
    server_id: string;
    subdomain: string;
    hostname: string;
    hostnames?: string[];
    created_at: string;
}

export default function ManageServers() {
    const [servers, setServers] = useState<Server[]>([]);
    const [customDashboards, setCustomDashboards] = useState<CustomDashboard[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [removeModal, setRemoveModal] = useState<Server | null>(null);
    const [reason, setReason] = useState("");
    const [processing, setProcessing] = useState(false);
    const [dashboardServerId, setDashboardServerId] = useState("");
    const [dashboardSubdomain, setDashboardSubdomain] = useState("");
    const [dashboardNotice, setDashboardNotice] = useState("");
    const [dashboardError, setDashboardError] = useState("");
    const [creatingDashboard, setCreatingDashboard] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/management/servers').then(res => res.json()),
            fetch('/api/management/custom-dashboards').then(res => res.json()),
        ])
            .then(([serverData, dashboardData]) => {
                const nextServers = Array.isArray(serverData) ? serverData : [];
                setServers(nextServers);
                setCustomDashboards(Array.isArray(dashboardData) ? dashboardData : []);
                setDashboardServerId(nextServers.find((server) => server.is_setup)?.id || "");
                setLoading(false);
            })
            .catch(() => {
                setServers([]);
                setCustomDashboards([]);
                setLoading(false);
            });
    }, []);

    const handleRemove = async () => {
        if (!removeModal || !reason.trim()) return;
        setProcessing(true);
        try {
            const res = await fetch(`/api/management/servers/${removeModal.id}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                setServers(prev => prev.filter(s => s.id !== removeModal.id));
                setRemoveModal(null);
                setReason("");
            } else {
                alert("Failed to remove bot");
            }
        } catch (err) {
            alert("Error removing bot");
        } finally {
            setProcessing(false);
        }
    };

    const handleJoin = async (id: string) => {
        try {
            const res = await fetch(`/api/management/servers/${id}/invite`, { method: 'POST' });
            const data = await res.json();
            if (data.url) window.open(data.url, '_blank');
        } catch (err) {
            alert("Error getting invite");
        }
    };

    const handleCreateDashboard = async () => {
        if (!dashboardServerId || !dashboardSubdomain.trim()) return;

        setCreatingDashboard(true);
        setDashboardNotice("");
        setDashboardError("");

        try {
            const res = await fetch('/api/management/custom-dashboards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: dashboardServerId,
                    subdomain: dashboardSubdomain,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                setDashboardError(data.error || 'Failed to create test dashboard.');
                return;
            }

            setCustomDashboards((prev) => [data, ...prev]);
            setDashboardSubdomain("");
            setDashboardNotice(`Created ${data.hostname}`);
        } catch (err) {
            setDashboardError("Error creating test dashboard.");
        } finally {
            setCreatingDashboard(false);
        }
    };

    const filtered = Array.isArray(servers) ? servers.filter(s => {
        const name = (s.name || "").toLowerCase();
        const id = (s.id || "");
        const query = (search || "").toLowerCase();
        return name.includes(query) || id.includes(search);
    }) : [];
    const setupServers = servers.filter((server) => server.is_setup);
    const serverNames = new Map(servers.map((server) => [server.id, server.name || server.id]));

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Manage Servers</h1>
                    <p className="text-slate-400 mt-1">Monitor and manage all servers using Ro-Link.</p>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search by name or ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white w-full md:w-64 focus:outline-none focus:border-sky-500"
                    />
                </div>
            </header>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Test Custom Dashboards</h2>
                        <p className="mt-2 text-sm text-slate-400">
                            Create internal test mappings for wildcard dashboard URLs. The same subdomain works across the configured production and testing root domains.
                        </p>
                    </div>
                    <div className="grid w-full gap-3 lg:w-auto lg:grid-cols-[minmax(220px,280px)_minmax(180px,220px)_auto]">
                        <select
                            value={dashboardServerId}
                            onChange={(e) => setDashboardServerId(e.target.value)}
                            className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                        >
                            <option value="">Select setup server...</option>
                            {setupServers.map((server) => (
                                <option key={server.id} value={server.id}>{server.name || server.id}</option>
                            ))}
                        </select>
                        <div className="flex rounded-xl border border-slate-800 bg-slate-950 focus-within:border-sky-500">
                            <input
                                type="text"
                                placeholder="subdomain"
                                value={dashboardSubdomain}
                                onChange={(e) => setDashboardSubdomain(e.target.value)}
                                className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-white outline-none"
                            />
                            <span className="hidden items-center border-l border-slate-800 px-3 font-mono text-xs text-slate-500 sm:flex">subdomain only</span>
                        </div>
                        <button
                            onClick={handleCreateDashboard}
                            disabled={creatingDashboard || !dashboardServerId || !dashboardSubdomain.trim()}
                            className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {creatingDashboard ? "Creating..." : "Create Test"}
                        </button>
                    </div>
                </div>

                {(dashboardNotice || dashboardError) && (
                    <p className={`mt-4 text-sm font-medium ${dashboardError ? 'text-red-400' : 'text-emerald-400'}`}>
                        {dashboardError || dashboardNotice}
                    </p>
                )}

                {customDashboards.length > 0 && (
                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
                        <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="bg-slate-800/50 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Domain</th>
                                    <th className="px-4 py-3">Server</th>
                                    <th className="px-4 py-3">Created</th>
                                    <th className="px-4 py-3 text-right">Open</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {customDashboards.map((dashboard) => (
                                    <tr key={dashboard.id}>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                {(dashboard.hostnames?.length ? dashboard.hostnames : [dashboard.hostname]).map((hostname) => (
                                                    <span key={hostname} className="font-mono text-sky-300">{hostname}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">{serverNames.get(dashboard.server_id) || dashboard.server_id}</td>
                                        <td className="px-4 py-3 text-slate-500">{new Date(dashboard.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <a
                                                href={`https://${dashboard.hostname}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold uppercase tracking-wider text-sky-400 hover:text-sky-300"
                                            >
                                                Open
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
                    <div className="table-responsive">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-slate-800/50 text-slate-400 font-medium uppercase text-[10px] tracking-widest border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4">Server</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Added At</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filtered.map(server => (
                                <tr key={server.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {server.icon ? (
                                                <img src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} className="w-8 h-8 rounded-lg" alt="" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sky-500 font-bold">
                                                    {(server.name || "?")[0]}
                                                </div>
                                            )}
                                            <span className="font-semibold text-white">{server.name || "Unknown Server"}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${server.bot_present !== false ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                <span className={`text-[10px] font-bold uppercase tracking-tight ${server.bot_present !== false ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {server.bot_present !== false ? 'Bot Present' : 'Bot Left'}
                                                </span>
                                            </div>
                                            {server.is_setup ? (
                                                <span className="text-[9px] font-bold text-sky-400 uppercase tracking-tighter bg-sky-400/10 px-1.5 py-0.5 rounded border border-sky-400/20 w-fit">Set Up</span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 w-fit">Pending Setup</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">{server.id}</td>
                                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{new Date(server.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {server.is_setup && (
                                                <Link
                                                    href={`/dashboard/${server.id}`}
                                                    className="p-2 text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all"
                                                    title="Open Dashboard"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => handleJoin(server.id)}
                                                className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                                                title="Join Server"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                                            </button>
                                            <button
                                                onClick={() => setRemoveModal(server)}
                                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                title="Remove Ro-Link"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}

            {removeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-2">Remove Ro-Link</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            You are about to remove the bot from <span className="text-white font-semibold">{removeModal.name}</span>.
                            The owner will be notified with the reason below.
                        </p>
                        <textarea
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-red-500 h-32 resize-none mb-4"
                            placeholder="Enter reason for removal..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setRemoveModal(null)}
                                className="px-4 py-2 text-slate-400 hover:text-white font-medium"
                                disabled={processing}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRemove}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
                                disabled={processing || !reason.trim()}
                            >
                                {processing ? "Processing..." : "Confirm Removal"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
