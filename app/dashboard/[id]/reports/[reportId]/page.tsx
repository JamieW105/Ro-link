'use client';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';


import { ArrowLeft as LucideArrowLeft, ExternalLink as LucideExternalLink, Shield as LucideShield } from 'lucide-react';

import { hasAdminPanelCommandAccess } from "@/lib/adminPanelCommands";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/context/PermissionsContext";
import { normalizeDashboardLogs, type NormalizedDashboardLog } from "@/lib/logRecords";

// Icons
const ChevronLeftIcon = () => (
    <LucideArrowLeft width="16" height="16" strokeWidth="2" />
);
const ShieldIcon = () => (
    <LucideShield width="16" height="16" strokeWidth="2" />
);

export default function ReportDetailsPage() {
    const { id, reportId } = useParams();
    const router = useRouter();
    const { data: session } = useSession();

    const perms = usePermissions();

    const [report, setReport] = useState<any | null>(null);
    const [profiles, setProfiles] = useState<any | null>(null);
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [reason, setReason] = useState("");
    const [discordUser, setDiscordUser] = useState<any | null>(null); // For fetching Discord profile data (avatar, etc)
    const [serverName, setServerName] = useState<string>("this server");
    const [guildNameMap, setGuildNameMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!id || !reportId) return;

        async function fetchData() {
            setLoading(true);

            // Fetch guild names from Discord-backed API instead of assuming servers.name exists in Supabase.
            try {
                const guildsRes = await fetch('/api/guilds');
                const guildsData = await guildsRes.json();

                if (Array.isArray(guildsData)) {
                    const nextGuildNameMap = Object.fromEntries(
                        guildsData.map((guild: any) => [String(guild.id), guild.name || String(guild.id)])
                    );
                    setGuildNameMap(nextGuildNameMap);

                    const currentGuild = guildsData.find((guild: any) => String(guild.id) === String(id));
                    if (currentGuild?.name) {
                        setServerName(currentGuild.name);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch guild names:", error);
            }

            // 1. Fetch report details, linked profile, and moderation history.
            const reportResponse = await fetch(`/api/reports/${encodeURIComponent(String(reportId))}/context?serverId=${encodeURIComponent(String(id))}`, {
                cache: 'no-store',
            });

            if (!reportResponse.ok) {
                alert("Report not found");
                router.push(`/dashboard/${id}/reports`);
                return;
            }

            const contextData = await reportResponse.json();
            const reportData = contextData.report;
            setReport(reportData);
            setReason(`Re: Report #${reportData.id.slice(0, 8)} - ${reportData.reason}`);
            setProfiles(contextData.profile || null);
            setLogs(normalizeDashboardLogs(contextData.logs));

            setLoading(false);
        }

        fetchData();
    }, [id, reportId, router]);

    // Fetch Discord User Data if it's a Discord ID
    useEffect(() => {
        if (!report?.reported_roblox_username) return;

        const isDiscordId = /^\d{17,20}$/.test(report.reported_roblox_username);
        const discordId = isDiscordId ? report.reported_roblox_username : profiles?.discord_id;

        if (discordId) {
            fetch(`/api/discord/user?userId=${discordId}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.error) setDiscordUser(data);
                })
                .catch(err => console.error("Failed to fetch Discord user:", err));
        }
    }, [report, profiles]);

    if (!perms.can_manage_reports) return null;

    const handleAction = async (action: 'KICK' | 'BAN' | 'SOFTBAN', type: 'ROBLOX') => {
        const hasCommandPermission = perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, action);

        // Permission Check
        if (action === 'KICK' && !hasCommandPermission) {
            alert("You do not have permission to KICK users.");
            return;
        }
        if ((action === 'BAN' || action === 'SOFTBAN') && !hasCommandPermission) {
            alert("You do not have permission to BAN users.");
            return;
        }

        const isDiscordId = /^\d{17,20}$/.test(report.reported_roblox_username);
        const targetUsername = profiles?.roblox_username || report.reported_roblox_username;

        if (isDiscordId && !profiles?.roblox_username) {
            alert("❌ This report is against a Discord ID that is NOT linked to a Roblox account. Roblox moderation actions cannot be applied.");
            return;
        }

        if (!confirm(`Are you sure you want to ${action} ${targetUsername}?`)) return;
        setActionLoading(true);

        const moderator = (session?.user as any)?.name || 'Web Admin';
        const moderatorId = (session?.user as any)?.id;

        const commandResponse = await fetch('/api/dashboard/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: id,
                command: action,
                args: {
                    username: targetUsername,
                    reason: reason,
                }
            })
        });

        const commandResult = await commandResponse.json().catch(() => ({}));
        if (!commandResponse.ok) {
            alert("Error: " + (commandResult.error || 'Failed to send command.'));
            setActionLoading(false);
            return;
        }

        // 2. Resolve the Report
        const reportUpdateResponse = await fetch(`/api/reports/${encodeURIComponent(String(reportId))}?serverId=${encodeURIComponent(String(id))}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'RESOLVED',
                moderatorNote: `Action: ${action} - ${reason}`,
            }),
        });

        if (!reportUpdateResponse.ok) {
            const reportUpdateResult = await reportUpdateResponse.json().catch(() => ({}));
            alert("Report action succeeded, but resolving the report failed: " + (reportUpdateResult.error || 'Unknown error.'));
            setActionLoading(false);
            return;
        }

        // 3. Notify User via Discord DM
        if (profiles?.discord_id) {
            try {
                await fetch('/api/discord/dm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: profiles.discord_id,
                        embed: {
                            title: `Moderation Action from ${serverName}: ${action}`,
                            color: 0xff0000,
                            description: `You have been **${action.toLowerCase()}** from **${serverName}**.`,
                            fields: [
                                { name: "Reason", value: reason || "No reason provided" },
                                { name: "Moderator", value: moderator }
                            ],
                            timestamp: new Date().toISOString()
                        }
                    })
                });
            } catch (e) {
                console.error("Failed to DM user", e);
            }
        }

        setActionLoading(false);
        router.push(`/dashboard/${id}/reports`); // Go back to list
    };

    const handleDismiss = async () => {
        if (!confirm("Dismiss this report without action?")) return;

        const dismissResponse = await fetch(`/api/reports/${encodeURIComponent(String(reportId))}?serverId=${encodeURIComponent(String(id))}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'DISMISSED',
                moderatorNote: 'Dismissed from dashboard',
            }),
        });

        if (!dismissResponse.ok) {
            const dismissResult = await dismissResponse.json().catch(() => ({}));
            alert("Failed to dismiss report: " + (dismissResult.error || 'Unknown error.'));
            return;
        }

        router.push(`/dashboard/${id}/reports`);
    };

    if (loading) {
        return <div className="p-12 text-center text-muted-foreground animate-pulse font-medium text-xs">Loading Report Details...</div>;
    }

    return (
        <div className="space-y-6 md:space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header / Nav */}
            <div>
                <Link href={`/dashboard/${id}/reports`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium mb-4">
                    <ChevronLeftIcon /> Back to Reports
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-medium text-foreground tracking-tight">Report Review</h1>
                        <p className="text-muted-foreground text-sm font-medium">Reviewing Pending Report <span className="font-mono text-muted-foreground">#{report.id.slice(0, 8)}</span></p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" size="default"
                            onClick={handleDismiss}
                            className="transition-colors"
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8">
                {/* Main Content: Info & Evidence */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Report Information */}
                    <Card className="bg-card border border-border rounded-xl p-5 sm:p-6 md:p-8">
                        <h3 className="text-sm font-medium text-foreground mb-6 flex items-center gap-3">
                            <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                                <ShieldIcon />
                            </div>
                            Incident Details
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-2">Reporter</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-medium border border-border">?</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{report.reporter_roblox_username || "Unknown Roblox User"}</p>
                                        <p className="text-xs font-mono text-muted-foreground">Discord ID: {report.reporter_discord_id}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                    {
                                        label: 'Reporter server at submission',
                                        jobId: report.reporter_live_server_id,
                                        joinUrl: report.reporter_join_url,
                                    },
                                    {
                                        label: 'Reported user server at submission',
                                        jobId: report.reported_live_server_id,
                                        joinUrl: report.reported_join_url,
                                    },
                                ].map((serverContext) => (
                                    <div key={serverContext.label} className="rounded-xl border border-border bg-muted p-4">
                                        <p className="text-xs font-medium text-muted-foreground">{serverContext.label}</p>
                                        {serverContext.jobId ? (
                                            <>
                                                <p className="mt-2 break-all font-mono text-xs text-foreground">{serverContext.jobId}</p>
                                                {serverContext.joinUrl && (
                                                    <a
                                                        href={serverContext.joinUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-3 inline-flex text-xs font-medium text-foreground hover:text-foreground"
                                                    >
                                                        Join server ↗
                                                    </a>
                                                )}
                                            </>
                                        ) : (
                                            <p className="mt-2 text-xs text-muted-foreground">Not found in a live server when reported.</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="bg-muted p-4 sm:p-6 rounded-xl border border-border">
                                <label className="text-xs font-medium text-muted-foreground block mb-2">Detailed Reason / Evidence</label>
                                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{report.reason}</p>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-border">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Submitted</label>
                                    <p className="text-xs font-mono text-muted-foreground">{new Date(report.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                                    <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded border border-orange-200 dark:border-orange-900 text-xs font-medium">{report.status}</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Global History */}
                    <Card className="bg-card border border-border rounded-xl p-5 sm:p-6 md:p-8">
                        <h3 className="text-sm font-medium text-foreground mb-6 flex items-center gap-3">
                            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                                <ShieldIcon />
                            </div>
                            Global Moderation History
                        </h3>

                        {logs.length > 0 ? (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {logs.map((log) => (
                                    <div key={log.id} className="bg-muted border border-border rounded-xl p-4 flex items-center justify-between group hover:bg-muted transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-2 rounded-full ${log.action === 'BAN' ? 'bg-red-500' : log.action === 'KICK' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-foreground">{log.action}</span>
                                                    <span className="text-xs font-medium text-muted-foreground px-1.5 py-px bg-muted rounded border border-border">
                                                        {guildNameMap[String(log.server_id)] || (log.server_id ? `Server ${String(log.server_id).slice(0, 8)}` : "Unknown Server")}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 font-medium">By {log.moderator} • {new Date(log.timestamp).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-mono text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
                                <p className="text-xs font-medium text-muted-foreground">No prior history found.</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Sidebar: Profile & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* User Profile Card */}
                    <div className="bg-background border border-border rounded-xl overflow-hidden">
                        <div className="h-20"></div>
                        <div className="px-4 sm:px-6 pb-4 sm:pb-6 -mt-10">
                            <div className="relative inline-block">
                                <img
                                    src={profiles?.roblox_id
                                        ? `https://www.roblox.com/headshot-thumbnail/image?userId=${profiles.roblox_id}&width=420&height=420&format=png`
                                        : discordUser?.avatar_url
                                            ? discordUser.avatar_url
                                            : /^\d+$/.test(report.reported_roblox_username)
                                                ? `https://api.dicebear.com/7.x/identicon/svg?seed=${report.reported_roblox_username}`
                                                : `https://www.roblox.com/headshot-thumbnail/image?userId=1&width=420&height=420&format=png`
                                    }
                                    className="w-20 h-20 rounded-xl border-4 border-border bg-muted object-cover"
                                    alt="Avatar"
                                />
                                {(profiles?.discord_id || /^\d+$/.test(report.reported_roblox_username)) && (
                                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-background rounded-full border-2 border-border flex items-center justify-center text-foreground text-xs">D</div>
                                )}
                            </div>

                            <div className="mt-4">
                                <h2 className="text-lg font-medium text-foreground">
                                    {discordUser ? (discordUser.global_name || discordUser.username) : report.reported_roblox_username}
                                </h2>
                                {discordUser && discordUser.global_name && (
                                    <p className="text-xs font-mono text-muted-foreground">@{discordUser.username}</p>
                                )}
                                {profiles?.roblox_id && <p className="text-xs font-mono text-muted-foreground mt-1">Roblox ID: {profiles.roblox_id}</p>}
                                {/^\d+$/.test(report.reported_roblox_username) && !profiles?.roblox_id && !discordUser && (
                                    <p className="text-xs font-mono text-muted-foreground mt-1">Unlinked Discord User</p>
                                )}
                            </div>

                            <div className="mt-6 space-y-3">
                                <a
                                    href={profiles?.roblox_id
                                        ? `https://www.roblox.com/users/${profiles.roblox_id}/profile`
                                        : /^\d+$/.test(report.reported_roblox_username)
                                            ? `https://discord.com/users/${report.reported_roblox_username}`
                                            : `https://www.roblox.com/search/users?keyword=${report.reported_roblox_username}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between p-3 bg-card rounded-xl border border-border hover:bg-muted hover:border-border transition-all group"
                                >
                                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                        {/^\d+$/.test(report.reported_roblox_username) && !profiles?.roblox_id ? "Discord Profile" : "Roblox Profile"}
                                    </span>
                                    <LucideExternalLink width="14" height="14" strokeWidth="2" className="text-muted-foreground group-hover:text-foreground" />
                                </a>
                                {profiles?.discord_id ? (
                                    <div className="p-3 bg-card rounded-xl border border-border">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-medium text-muted-foreground">Discord Account</span>
                                            <span className="text-xs bg-background text-[#5865F2] px-1.5 py-0.5 rounded border border-border font-medium">Linked</span>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground truncate">{profiles.discord_id}</div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-card rounded-xl border border-border opacity-50">
                                        <span className="text-xs font-medium text-muted-foreground">No Discord Linked</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Panel */}
                    <Card className="bg-card border border-border rounded-xl p-5 sm:p-6">
                        <h3 className="text-xs font-medium text-foreground mb-4 flex items-center gap-2">
                            <ShieldIcon /> Take Action
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-2">Reason for Moderation</label>
                                <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full min-h-[100px]"
                                    placeholder="Enter the reason for this action (sent to user)..."
                                />
                            </div>

                            <Button variant="outline" size="default"
                            onClick={() => handleAction('KICK', 'ROBLOX')}
                                disabled={actionLoading || !(perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'KICK'))}
                                className="w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Kick User
                            </Button>
                            <Button variant="outline" size="default"
                                onClick={() => handleAction('SOFTBAN', 'ROBLOX')}
                                disabled={actionLoading || !(perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'SOFTBAN'))}
                                className="w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Soft Ban (12h)
                            </Button>
                            <Button variant="destructive" size="default"
                                onClick={() => handleAction('BAN', 'ROBLOX')}
                                disabled={actionLoading || !(perms.is_admin || hasAdminPanelCommandAccess(perms.allowed_misc_cmds, 'BAN'))}
                                className="w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Permanent Ban
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 text-center leading-relaxed">
                            Actions will be logged globally. If the user has a linked Discord, they will receive a DM notification from the bot.
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
