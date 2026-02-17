'use client';

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Icons
const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
);
const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
);

export default function ReportDetailsPage() {
    const { id, reportId } = useParams();
    const router = useRouter();
    const { data: session } = useSession();

    const [report, setReport] = useState<any | null>(null);
    const [profiles, setProfiles] = useState<any | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [reason, setReason] = useState("");
    const [discordUser, setDiscordUser] = useState<any | null>(null); // For fetching Discord profile data (avatar, etc)
    const [serverName, setServerName] = useState<string>("this server");

    useEffect(() => {
        if (!id || !reportId) return;

        async function fetchData() {
            setLoading(true);

            // Fetch Server Name
            const { data: serverInfo } = await supabase
                .from('servers')
                .select('name')
                .eq('id', id)
                .single();

            if (serverInfo && serverInfo.name) {
                setServerName(serverInfo.name);
            }

            // 1. Fetch Report Details
            const { data: reportData, error: reportError } = await supabase
                .from('reports')
                .select('*')
                .eq('id', reportId)
                .single();

            if (reportError || !reportData) {
                alert("Report not found");
                router.push(`/dashboard/${id}/reports`);
                return;
            }
            setReport(reportData);
            setReason(`Re: Report #${reportData.id.slice(0, 8)} - ${reportData.reason}`);

            // 2. Fetch Linked Profiles (Verified Users)
            // Try to find by Roblox Username OR Discord ID
            const isDiscordId = /^\d{17,20}$/.test(reportData.reported_roblox_username);

            let profileQuery = supabase.from('verified_users').select('*');
            if (isDiscordId) {
                profileQuery = profileQuery.eq('discord_id', reportData.reported_roblox_username);
            } else {
                profileQuery = profileQuery.ilike('roblox_username', reportData.reported_roblox_username);
            }

            const { data: profileData } = await profileQuery.maybeSingle();
            setProfiles(profileData);

            // 3. Fetch Global Moderation Logs
            // Search logs for the reported target OR the linked Roblox username if found
            const { data: logsData } = await supabase
                .from('logs')
                .select(`
                    *,
                    servers ( name )
                `)
                .or(`target.eq.${reportData.reported_roblox_username}${profileData?.roblox_username ? `,target.eq.${profileData.roblox_username}` : ''}`)
                .order('timestamp', { ascending: false });

            if (logsData) {
                setLogs(logsData);
            }

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

    const handleAction = async (action: 'KICK' | 'BAN' | 'SOFTBAN', type: 'ROBLOX') => {
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

        // 1. Queue Roblox Command
        const { error: dbError } = await supabase.from('command_queue').insert([{
            server_id: id,
            command: action,
            args: {
                username: targetUsername,
                reason: reason,
                moderator: moderator
            },
            status: 'PENDING'
        }]);

        if (dbError) {
            alert("Database Error: " + dbError.message);
            setActionLoading(false);
            return;
        }

        // 2. Trigger Real-time Messaging
        try {
            await fetch('/api/roblox/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    command: action,
                    args: {
                        username: report.reported_roblox_username,
                        reason: reason,
                        moderator: moderator
                    }
                })
            });
        } catch (e) {
            console.error("Messaging failed", e);
        }

        // 3. Log the Action
        await supabase.from('logs').insert([{
            server_id: id,
            action: action,
            target: report.reported_roblox_username,
            moderator: moderator
        }]);

        // 4. Resolve the Report
        await supabase
            .from('reports')
            .update({
                status: 'RESOLVED',
                moderator_id: moderatorId,
                moderator_note: `Action: ${action} - ${reason}`,
                resolved_at: new Date().toISOString()
            })
            .eq('id', reportId);

        // 5. Notify User via Discord DM
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

        await supabase
            .from('reports')
            .update({
                status: 'DISMISSED',
                moderator_id: (session?.user as any)?.id,
                resolved_at: new Date().toISOString()
            })
            .eq('id', reportId);

        const moderator = (session?.user as any)?.name || 'Web Admin';
        await supabase.from('logs').insert([{
            server_id: id,
            action: 'REPORT_DISMISSED',
            target: report.reported_roblox_username,
            moderator: moderator
        }]);

        router.push(`/dashboard/${id}/reports`);
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse uppercase tracking-widest font-bold text-xs">Loading Report Details...</div>;
    }

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header / Nav */}
            <div>
                <Link href={`/dashboard/${id}/reports`} className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mb-4">
                    <ChevronLeftIcon /> Back to Reports
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Report Review</h1>
                        <p className="text-slate-500 text-sm font-medium">Reviewing Pending Report <span className="font-mono text-slate-600">#{report.id.slice(0, 8)}</span></p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleDismiss}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Info & Evidence */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Report Information */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                            <div className="p-2 bg-red-600/10 rounded-lg text-red-500 border border-red-500/10">
                                <ShieldIcon />
                            </div>
                            Incident Details
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Reporter</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-700">?</div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{report.reporter_roblox_username || "Unknown Roblox User"}</p>
                                        <p className="text-xs font-mono text-slate-500">Discord ID: {report.reporter_discord_id}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50">
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Detailed Reason / Evidence</label>
                                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{report.reason}</p>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-800/50">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-600 tracking-widest block mb-1">Submitted</label>
                                    <p className="text-xs font-mono text-slate-400">{new Date(report.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-600 tracking-widest block mb-1">Status</label>
                                    <span className="px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded border border-orange-500/20 text-[10px] font-bold uppercase tracking-wider">{report.status}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Global History */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                            <div className="p-2 bg-amber-600/10 rounded-lg text-amber-500 border border-amber-500/10">
                                <ShieldIcon />
                            </div>
                            Global Moderation History
                        </h3>

                        {logs.length > 0 ? (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {logs.map((log) => (
                                    <div key={log.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between group hover:bg-slate-800/50 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-2 rounded-full ${log.action === 'BAN' ? 'bg-red-500' : log.action === 'KICK' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{log.action}</span>
                                                    <span className="text-[9px] font-bold text-slate-500 px-1.5 py-px bg-slate-800 rounded border border-slate-700">{log.servers?.name || "Unknown Server"}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-1 font-medium">By {log.moderator} • {new Date(log.timestamp).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-8 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest italic">No prior history found.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Profile & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* User Profile Card */}
                    <div className="bg-[#020617] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <div className="h-20 bg-gradient-to-r from-red-900 to-slate-900"></div>
                        <div className="px-6 pb-6 -mt-10">
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
                                    className="w-20 h-20 rounded-xl border-4 border-[#020617] bg-slate-800 object-cover shadow-lg"
                                    alt="Avatar"
                                />
                                {(profiles?.discord_id || /^\d+$/.test(report.reported_roblox_username)) && (
                                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-[#5865F2] rounded-full border-2 border-[#020617] flex items-center justify-center text-white text-[10px]">D</div>
                                )}
                            </div>

                            <div className="mt-4">
                                <h2 className="text-lg font-bold text-white">
                                    {discordUser ? (discordUser.global_name || discordUser.username) : report.reported_roblox_username}
                                </h2>
                                {discordUser && discordUser.global_name && (
                                    <p className="text-xs font-mono text-slate-500">@{discordUser.username}</p>
                                )}
                                {profiles?.roblox_id && <p className="text-xs font-mono text-slate-500 mt-1">Roblox ID: {profiles.roblox_id}</p>}
                                {/^\d+$/.test(report.reported_roblox_username) && !profiles?.roblox_id && !discordUser && (
                                    <p className="text-xs font-mono text-slate-500 mt-1">Unlinked Discord User</p>
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
                                    className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all group"
                                >
                                    <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">
                                        {/^\d+$/.test(report.reported_roblox_username) && !profiles?.roblox_id ? "Discord Profile" : "Roblox Profile"}
                                    </span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 group-hover:text-white"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                </a>
                                {profiles?.discord_id ? (
                                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-slate-400">Discord Account</span>
                                            <span className="text-[10px] bg-[#5865F2]/20 text-[#5865F2] px-1.5 py-0.5 rounded border border-[#5865F2]/30 font-bold uppercase">Linked</span>
                                        </div>
                                        <div className="text-xs font-mono text-slate-500 truncate">{profiles.discord_id}</div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 opacity-50">
                                        <span className="text-xs font-bold text-slate-500">No Discord Linked</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ShieldIcon /> Take Action
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Reason for Moderation</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-700 focus:outline-none focus:border-red-500/50 min-h-[100px]"
                                    placeholder="Enter the reason for this action (sent to user)..."
                                />
                            </div>

                            <button
                                onClick={() => handleAction('KICK', 'ROBLOX')}
                                disabled={actionLoading}
                                className="w-full py-3 bg-orange-600/10 border border-orange-500/20 hover:bg-orange-500/20 text-orange-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest disabled:opacity-50"
                            >
                                Kick User
                            </button>
                            <button
                                onClick={() => handleAction('SOFTBAN', 'ROBLOX')}
                                disabled={actionLoading}
                                className="w-full py-3 bg-red-600/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all uppercase tracking-widest disabled:opacity-50"
                            >
                                Soft Ban (12h)
                            </button>
                            <button
                                onClick={() => handleAction('BAN', 'ROBLOX')}
                                disabled={actionLoading}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 rounded-xl text-xs font-bold transition-all uppercase tracking-widest disabled:opacity-50"
                            >
                                Permanent Ban
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-4 text-center leading-relaxed">
                            Actions will be logged globally. If the user has a linked Discord, they will receive a DM notification from the bot.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
