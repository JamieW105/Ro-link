'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from 'next/link';

// SVGs
const LogOutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
);

interface Guild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: number;
    hasBot?: boolean;
}

export default function Dashboard() {
    const { data: session, status } = useSession();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(false);

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
                <a
                    href="https://discord.com/oauth2/authorize?client_id=1466340007940722750&response_type=code&redirect_uri=https%3A%2F%2Frolink.cloud%2Fapi%2Fauth%2Fcallback%2Fdiscord&scope=identify+guilds"
                    className="bg-sky-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-sky-500 transition-all shadow-lg shadow-sky-900/10 text-sm"
                >
                    Sign In with Discord
                </a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-8 sm:p-12">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 border-b border-slate-800 pb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-12 h-12 rounded-xl object-contain shadow-lg border border-white/5 bg-slate-900/50 p-1" />
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Your Servers</h1>
                            <p className="text-slate-500 text-sm font-medium mt-1">Select a server to manage.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800 shadow-sm backdrop-blur-sm">
                        <img src={session?.user?.image || ''} alt="" className="w-10 h-10 rounded-lg border border-slate-700" />
                        <div className="text-left pr-2">
                            <p className="font-semibold text-sm text-white">{session?.user?.name}</p>
                            <button onClick={() => signOut()} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-red-400 transition-colors mt-0.5 uppercase tracking-wider">
                                <LogOutIcon />
                                Sign Out
                            </button>
                        </div>
                    </div>
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
                                        <Link
                                            href={`/dashboard/${guild.id}`}
                                            className="w-full py-2.5 bg-slate-800 hover:bg-sky-600 text-white border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn shadow-sm"
                                        >
                                            <SettingsIcon />
                                            Open Console
                                        </Link>
                                    ) : (
                                        <a
                                            href={`https://discord.com/api/oauth2/authorize?client_id=1466340007940722750&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}&disable_guild_select=true`}
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
            </div>
        </div>
    );
}
