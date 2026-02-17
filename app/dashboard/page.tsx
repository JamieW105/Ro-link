'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// SVGs
const LogOutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);

interface Guild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: number | string;
    hasBot?: boolean;
}

export default function Dashboard() {
    const { data: session, status } = useSession();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(false);

    // Admin Actions State
    const [removeModal, setRemoveModal] = useState<{ id: string, name: string } | null>(null);
    const [removeReason, setRemoveReason] = useState("");
    const [processing, setProcessing] = useState(false);

    const handleJoinServer = async (guildId: string) => {
        try {
            const response = await fetch(`/api/guilds/${guildId}/invite`, { method: 'POST' });
            const data = await response.json();
            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                alert('Failed to get invite: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error joining server');
        }
    };

    const handleRemoveBot = async () => {
        if (!removeModal) return;
        if (!removeReason.trim()) return alert("Reason required");

        setProcessing(true);
        try {
            const response = await fetch(`/api/guilds/${removeModal.id}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: removeReason })
            });

            if (response.ok) {
                setGuilds(prev => prev.filter(g => g.id !== removeModal.id));
                setRemoveModal(null);
                setRemoveReason("");
            } else {
                const data = await response.json();
                alert('Failed to remove bot: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error removing bot');
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        if (session?.accessToken) {
            setLoading(true);
            fetch('/api/guilds')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setGuilds(data);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [session]);

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-slate-400 border border-slate-700 shadow-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">Access Denied</h1>
                <p className="text-slate-400 mb-8 max-w-sm text-sm">Please authenticate with Discord to manage your community servers.</p>
                <button
                    onClick={() => signIn('discord')}
                    className="bg-sky-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-sky-500 transition-all shadow-lg shadow-sky-900/10 text-sm"
                >
                    Sign In with Discord
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200">
            {/* Sticky Professional Navbar */}
            <nav className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-9 h-9 rounded-lg object-contain shadow-lg border border-white/5" />
                        <span className="text-xl font-bold tracking-tight text-white hidden xs:block">Ro-Link</span>
                    </Link>

                    <div className="flex items-center gap-3 sm:gap-4 pl-4 border-l border-slate-800 ml-auto">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-white leading-none mb-1">{session?.user?.name}</p>
                            <button onClick={() => signOut()} className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest flex items-center gap-1.5 justify-end">
                                <LogOutIcon />
                                Sign Out
                            </button>
                        </div>
                        <div className="relative group">
                            <img src={session?.user?.image || ''} alt="" className="w-10 h-10 rounded-xl border border-slate-700 shadow-sm transition-transform group-hover:scale-105" />
                            <button
                                onClick={() => signOut()}
                                className="sm:hidden absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-slate-400 hover:text-red-400 shadow-xl"
                                title="Sign Out"
                            >
                                <LogOutIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-12">
                <header className="mb-8 md:mb-12">
                    <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mb-2">Select a Server</h1>
                    <p className="text-slate-500 text-sm md:text-base font-medium">Choose a community to manage and monitor.</p>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="w-10 h-10 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <p className="text-slate-500 text-sm font-medium animate-pulse">Loading servers...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {guilds.map(guild => (
                            <div key={guild.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 hover:border-sky-500/30 transition-all flex flex-col group relative overflow-hidden">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="relative">
                                        {guild.icon ? (
                                            <img
                                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                                                alt={guild.name}
                                                className="w-16 h-16 rounded-xl shadow-lg relative z-10 border border-white/5"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center text-xl font-bold text-sky-500 relative z-10 border border-white/5">
                                                {guild.name.substring(0, 1)}
                                            </div>
                                        )}
                                        {guild.hasBot && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#020617] z-20 shadow-lg"></div>
                                        )}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">
                                        ID: {guild.id.substring(0, 8)}
                                    </div>
                                </div>

                                <h3 className="font-bold text-lg text-white truncate w-full mb-8 tracking-tight">{guild.name}</h3>

                                <div className="mt-auto">
                                    {guild.hasBot ? (
                                        (() => {
                                            const userId = (session?.user as any)?.id;
                                            // We can rely on isReadOnly because the API ONLY sets permissions="0" 
                                            // for the superuser viewing non-admin servers.
                                            const isReadOnly = guild.permissions == 0 || guild.permissions === "0";

                                            // Debug log
                                            if (userId === '953414442060746854') {
                                                console.log(`Guild: ${guild.name} (${guild.id}), ReadOnly: ${isReadOnly}`);
                                            }

                                            if (isReadOnly) {
                                                return (
                                                    <div className="flex flex-col gap-2 w-full">
                                                        <button
                                                            onClick={() => handleJoinServer(guild.id)}
                                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                                                        >
                                                            Join Server
                                                        </button>
                                                        <button
                                                            onClick={() => setRemoveModal({ id: guild.id, name: guild.name })}
                                                            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                                                        >
                                                            Remove Bot
                                                        </button>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <Link
                                                    href={`/dashboard/${guild.id}`}
                                                    className="w-full py-2.5 bg-slate-800 hover:bg-sky-600 text-white border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn shadow-sm"
                                                >
                                                    <SettingsIcon />
                                                    Open Console
                                                </Link>
                                            );
                                        })()
                                    ) : (
                                        <a
                                            href={`https://discord.com/api/oauth2/authorize?client_id=1466340007940722750&permissions=268536470&scope=bot%20applications.commands&guild_id=${guild.id}&disable_guild_select=true`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-sky-900/10 flex items-center justify-center gap-2"
                                        >
                                            <PlusIcon />
                                            Invite
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Remove Bot Modal */}
                {removeModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
                            <h3 className="text-xl font-bold text-white mb-2">Remove Bot</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Remove bot from <span className="text-white font-semibold">{removeModal.name}</span>?
                                <br />
                                The owner will be notified with the reason below.
                            </p>

                            <textarea
                                value={removeReason}
                                onChange={(e) => setRemoveReason(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-red-500 mb-4 h-24 resize-none"
                                placeholder="Reason for removal (required)..."
                            />

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setRemoveModal(null);
                                        setRemoveReason("");
                                    }}
                                    className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                                    disabled={processing}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRemoveBot}
                                    disabled={processing || !removeReason.trim()}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-900/20"
                                >
                                    {processing ? 'Removing...' : 'Confirm Remove'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
