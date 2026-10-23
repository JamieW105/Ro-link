'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';


import { ArrowDownUp as LucideArrowDownUp, NotebookText as LucideNotebookText, Search as LucideSearch } from 'lucide-react';

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeDashboardLogs, type NormalizedDashboardLog } from "@/lib/logRecords";

const ScrollIcon = () => (
    <LucideNotebookText width="24" height="24" strokeWidth="2" />
);

const SearchIcon = () => (
    <LucideSearch width="16" height="16" strokeWidth="2" />
);

const SortIcon = () => (
    <LucideArrowDownUp width="16" height="16" strokeWidth="2" />
);

export default function LogsPage() {
    const { id } = useParams();
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(false);

    useEffect(() => {
        async function fetchLogs() {
            if (!id) return;

            const response = await fetch(`/api/dashboard/logs?serverId=${encodeURIComponent(String(id))}&limit=200`, {
                cache: 'no-store',
            });
            const data = response.ok ? await response.json() : [];
            setLogs(normalizeDashboardLogs(data));
            setLoading(false);
        }
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [id]);

    const filteredLogs = logs
        .filter(log =>
            (log.target?.toLowerCase() || "").includes(search.toLowerCase()) ||
            (log.action?.toLowerCase() || "").includes(search.toLowerCase()) ||
            (log.moderator?.toLowerCase() || "").includes(search.toLowerCase()) ||
            log.targetIdentities.some((identity) => identity.toLowerCase().includes(search.toLowerCase())) ||
            log.moderatorIdentities.some((identity) => identity.toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return sortAsc ? timeA - timeB : timeB - timeA;
        });

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full pb-20">
            {/* Page Header */}
            <div className="mb-10 pb-8 border-b border-border">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-foreground border border-border">
                        <ScrollIcon />
                    </div>
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Activity Logs</h1>
                        <p className="text-muted-foreground text-sm font-medium mt-1">Real-time audit trail of all server actions.</p>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl relative overflow-hidden">
                {/* Controls */}
                <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-96 group">
                        <div className="absolute inset-y-0 left-3 flex items-center text-muted-foreground group-focus-within:text-foreground transition-colors">
                            <SearchIcon />
                        </div>
                        <Input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search logs by user, action..."
                            className="w-full transition-all tracking-wide"
                        />
                    </div>

                    <Button variant="outline" size="icon"
                        onClick={() => setSortAsc(!sortAsc)}
                        className="flex items-center transition-all"
                    >
                        <SortIcon />
                        {sortAsc ? "Oldest First" : "Newest First"}
                    </Button>
                </div>

                <div className="table-responsive custom-scrollbar">
                    {filteredLogs.length === 0 ? (
                        <div className="p-20 text-center text-muted-foreground font-medium text-xs text-nowrap">
                            No logs found matching your criteria.
                        </div>
                    ) : (
                        <Table className="w-full text-left text-xs min-w-[600px]">
                            <TableHeader className="text-muted-foreground text-xs font-medium bg-muted">
                                <TableRow>
                                    <TableHead className="px-4 md:px-8 py-3">Action</TableHead>
                                    <TableHead className="px-4 md:px-8 py-3">Target</TableHead>
                                    <TableHead className="px-4 md:px-8 py-3">Moderator</TableHead>
                                    <TableHead className="px-4 md:px-8 py-3 text-right">Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border">
                                {filteredLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-accent transition-all group">
                                        <TableCell className="px-4 md:px-8 py-4">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium tracking-tight border inline-block ${log.action === 'BAN' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900' :
                                                log.action === 'KICK' ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900' :
                                                    log.action.includes('LOOKUP') ? 'bg-accent text-foreground border-border' :
                                                        'bg-accent text-foreground border-border'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 md:px-8 py-4 font-semibold text-foreground">{log.target}</TableCell>
                                        <TableCell className="px-4 md:px-8 py-4 text-muted-foreground font-medium">{log.moderator}</TableCell>
                                        <TableCell className="px-4 md:px-8 py-4 text-right text-muted-foreground font-mono text-xs font-medium">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            <span className="ml-2 text-muted-foreground">{new Date(log.timestamp).toLocaleDateString()}</span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        </div>
    );
}
