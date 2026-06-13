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

interface RuleIssue {
    rule: string;
    severity: 'low' | 'medium' | 'high';
    location: 'server_name' | 'message';
    evidence: string;
    translatedEvidence?: string;
    channelName?: string;
    messageUrl?: string;
    authorId?: string;
    messageCreatedAt?: string;
}

interface ServerRuleCheck {
    id: string;
    name: string;
    status: 'clear' | 'flagged' | 'limited' | 'error';
    checkedMessages: number;
    translatedMessages: number;
    issues: RuleIssue[];
    errors: string[];
}

interface RuleCheckSummary {
    checkedAt: string;
    scannedServers: number;
    flaggedServers: number;
    checkedMessages: number;
    translatedMessages: number;
    translationProvider: string;
    capped?: boolean;
    maxServers?: number;
    results: ServerRuleCheck[];
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
    const [ruleCheck, setRuleCheck] = useState<RuleCheckSummary | null>(null);
    const [checkingRules, setCheckingRules] = useState(false);
    const [ruleCheckError, setRuleCheckError] = useState("");
    const [currentRuleCheckServer, setCurrentRuleCheckServer] = useState<{ id: string; name: string; index: number; total: number } | null>(null);

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
        } catch {
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
        } catch {
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
        } catch {
            setDashboardError("Error creating test dashboard.");
        } finally {
            setCreatingDashboard(false);
        }
    };

    const handleRuleCheck = async () => {
        setCheckingRules(true);
        setRuleCheckError("");

        try {
            const guildIds = servers
                .filter((server) => server.bot_present !== false)
                .map((server) => ({ id: server.id, name: server.name || server.id }));

            if (guildIds.length === 0) {
                setRuleCheckError('No servers with the bot present are available to scan.');
                return;
            }

            setRuleCheck({
                checkedAt: new Date().toISOString(),
                scannedServers: 0,
                flaggedServers: 0,
                checkedMessages: 0,
                translatedMessages: 0,
                translationProvider: '',
                capped: false,
                maxServers: guildIds.length,
                results: [],
            });

            for (const [index, guild] of guildIds.entries()) {
                setCurrentRuleCheckServer({
                    id: guild.id,
                    name: guild.name,
                    index: index + 1,
                    total: guildIds.length,
                });

                const res = await fetch('/api/management/servers/rule-check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guildIds: [guild.id] }),
                });
                const data = await res.json();

                if (!res.ok) {
                    setRuleCheckError(data.error || `Failed to scan ${guild.name}.`);
                    return;
                }

                const result = Array.isArray(data.results) ? data.results[0] : null;
                if (!result) {
                    setRuleCheckError(`No scan result was returned for ${guild.name}.`);
                    return;
                }

                setRuleCheck((previous) => {
                    const previousResults = previous?.results || [];
                    const results = [
                        ...previousResults.filter((item) => item.id !== result.id),
                        result,
                    ];

                    return {
                        checkedAt: data.checkedAt || previous?.checkedAt || new Date().toISOString(),
                        scannedServers: results.length,
                        flaggedServers: results.filter((item) => item.issues.length > 0).length,
                        checkedMessages: results.reduce((sum, item) => sum + item.checkedMessages, 0),
                        translatedMessages: results.reduce((sum, item) => sum + item.translatedMessages, 0),
                        translationProvider: data.translationProvider || previous?.translationProvider || '',
                        capped: false,
                        maxServers: guildIds.length,
                        results,
                    };
                });
            }
        } catch {
            setRuleCheckError("Error running server rule check.");
        } finally {
            setCheckingRules(false);
            setCurrentRuleCheckServer(null);
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
    const ruleCheckByServer = new Map((ruleCheck?.results || []).map((result) => [result.id, result]));
    const flaggedResults = (ruleCheck?.results || []).filter((result) => result.issues.length > 0);

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

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Server Rule Check</h2>
                        <p className="mt-2 text-sm text-slate-400">
                            Scans the 30 most recent messages from each readable channel for common scam, raid, adult content, and exploit indicators. Likely non-English messages are translated to English before matching.
                        </p>
                    </div>
                    <button
                        onClick={handleRuleCheck}
                        disabled={checkingRules || loading || servers.length === 0}
                        className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {checkingRules ? "Checking..." : "Run Rule Check"}
                    </button>
                </div>

                {ruleCheckError && (
                    <p className="mt-4 text-sm font-medium text-red-400">{ruleCheckError}</p>
                )}

                {checkingRules && currentRuleCheckServer && (
                    <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
                        Scanning {currentRuleCheckServer.name} ({currentRuleCheckServer.index} of {currentRuleCheckServer.total})
                    </div>
                )}

                {ruleCheck && (
                    <div className="mt-5 space-y-5">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Servers Scanned</p>
                                <p className="mt-2 text-2xl font-extrabold text-white">{ruleCheck.scannedServers}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Flagged</p>
                                <p className={`mt-2 text-2xl font-extrabold ${ruleCheck.flaggedServers > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{ruleCheck.flaggedServers}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Messages</p>
                                <p className="mt-2 text-2xl font-extrabold text-white">{ruleCheck.checkedMessages}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Translated</p>
                                <p className="mt-2 text-2xl font-extrabold text-white">{ruleCheck.translatedMessages}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                Checked {new Date(ruleCheck.checkedAt).toLocaleString()}
                                {ruleCheck.translationProvider ? ` using ${ruleCheck.translationProvider}.` : '.'}
                            </span>
                            <span>Review evidence before removing or blocking a server.</span>
                        </div>

                        {ruleCheck.capped && (
                            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                Scan capped at {ruleCheck.maxServers} servers to avoid Discord and translation rate limits.
                            </p>
                        )}

                        {flaggedResults.length === 0 ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
                                No obvious rule violations found in the sampled messages.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {flaggedResults.map((result) => (
                                    <div key={result.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h3 className="font-bold text-white">{result.name}</h3>
                                                <p className="mt-1 font-mono text-[11px] text-slate-500">{result.id}</p>
                                            </div>
                                            <span className="w-fit rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
                                                {result.issues.length} issue{result.issues.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <div className="mt-4 space-y-3">
                                            {result.issues.map((issue, index) => (
                                                <div key={`${issue.rule}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${getSeverityClass(issue.severity)}`}>{issue.severity}</span>
                                                        <span className="text-xs font-bold text-white">{issue.rule}</span>
                                                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{formatIssueLocation(issue)}</span>
                                                    </div>
                                                    <p className="mt-2 break-words text-sm text-slate-300">{issue.evidence}</p>
                                                    {issue.translatedEvidence && (
                                                        <p className="mt-2 break-words border-l-2 border-indigo-400/40 pl-3 text-sm text-indigo-200">
                                                            English: {issue.translatedEvidence}
                                                        </p>
                                                    )}
                                                    {issue.messageUrl && (
                                                        <a
                                                            href={issue.messageUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-2 inline-block text-xs font-bold uppercase tracking-wider text-sky-400 hover:text-sky-300"
                                                        >
                                                            Open Message
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
                    <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="bg-slate-800/50 text-slate-400 font-medium uppercase text-[10px] tracking-widest border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4">Server</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Rule Check</th>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Added At</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filtered.map(server => {
                                const serverCheck = ruleCheckByServer.get(server.id);

                                return (
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
                                    <td className="px-6 py-4">
                                        {checkingRules && currentRuleCheckServer?.id === server.id ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="w-fit rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-300">
                                                    Scanning
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {currentRuleCheckServer.index} of {currentRuleCheckServer.total}
                                                </span>
                                            </div>
                                        ) : serverCheck ? (
                                            <div className="flex flex-col gap-1">
                                                <span className={`w-fit rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${getRuleCheckStatusClass(serverCheck.status)}`}>
                                                    {serverCheck.status}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {serverCheck.issues.length} issue{serverCheck.issues.length === 1 ? '' : 's'} / {serverCheck.checkedMessages} messages
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Not Checked</span>
                                        )}
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
                                );
                            })}
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

function getSeverityClass(severity: RuleIssue['severity']) {
    if (severity === 'high') return 'bg-red-500/15 text-red-300';
    if (severity === 'medium') return 'bg-amber-500/15 text-amber-300';
    return 'bg-sky-500/15 text-sky-300';
}

function getRuleCheckStatusClass(status: ServerRuleCheck['status']) {
    if (status === 'flagged') return 'border-red-500/30 bg-red-500/10 text-red-300';
    if (status === 'limited') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    if (status === 'error') return 'border-slate-600 bg-slate-800 text-slate-300';
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
}

function formatIssueLocation(issue: RuleIssue) {
    if (issue.location === 'server_name') return 'Server name';
    return issue.channelName ? `#${issue.channelName}` : 'Message';
}
