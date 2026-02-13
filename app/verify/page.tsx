'use client';

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { supabase } from "@/lib/supabase";

const RobloxIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.5,1.5L5.5,4.5L1.5,18.5L14.5,22.5L22.5,9.5L18.5,1.5ZM14.5,12.5L9.5,13.5L8.5,8.5L13.5,7.5L14.5,12.5Z" />
    </svg>
);

const DiscordIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.555.099 18.017a.083.083 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
    </svg>
);

export default function VerifyPage() {
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(false);
    const [linkedAccount, setLinkedAccount] = useState<any>(null);
    const [fetchingLinked, setFetchingLinked] = useState(true);

    useEffect(() => {
        if (session && session.user) {
            checkLinkedAccount();
        } else if (status !== 'loading') {
            setFetchingLinked(false);
        }
    }, [session, status]);

    async function checkLinkedAccount() {
        const userId = (session?.user as any)?.id;
        if (!userId) return;

        const { data, error } = await supabase
            .from('verified_users')
            .select('*')
            .eq('discord_id', userId)
            .maybeSingle();

        if (data) {
            setLinkedAccount(data);
        }
        setFetchingLinked(false);
    }

    const handleRobloxLink = () => {
        setLoading(true);
        // Redirect to Roblox OAuth2 flow
        window.location.href = '/api/roblox/auth';
    };

    if (status === 'loading' || fetchingLinked) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-10 shadow-2xl backdrop-blur-xl">
                    <div className="w-16 h-16 bg-sky-600/10 rounded-2xl flex items-center justify-center text-sky-500 mb-8 mx-auto border border-sky-500/10">
                        <DiscordIcon />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-4 tracking-tight uppercase italic">Welcome to Ro-Link</h1>
                    <p className="text-slate-400 mb-8 text-sm leading-relaxed">To link your Roblox account, you must first sign in with your Discord account.</p>
                    <button
                        onClick={() => signIn('discord')}
                        className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-3 active:scale-95 text-sm uppercase tracking-wider"
                    >
                        <DiscordIcon />
                        Sign in with Discord
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center font-sans">
            <div className="max-w-xl w-full bg-slate-900/50 border border-slate-800 rounded-[2rem] p-10 shadow-3xl backdrop-blur-2xl relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-600/10 blur-[100px] rounded-full"></div>

                <div className="relative">
                    <div className="flex items-center justify-center gap-4 mb-10">
                        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-xl border border-slate-700">
                            <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-8 h-8 object-contain" />
                        </div>
                        <div className="h-0.5 w-12 bg-gradient-to-r from-slate-800 to-sky-600"></div>
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-black shadow-xl">
                            <RobloxIcon />
                        </div>
                    </div>

                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight uppercase italic">Account Verification</h1>
                    <p className="text-slate-400 mb-10 text-xs font-bold uppercase tracking-[0.2em]">Discord Link Portal</p>

                    {linkedAccount ? (
                        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                            <div className="bg-black/40 p-8 rounded-2xl border border-slate-800 group transition-all hover:border-sky-500/30">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Linked Roblox Account</p>
                                <div className="flex items-center gap-5">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-800 overflow-hidden border-2 border-slate-700 shadow-xl group-hover:border-sky-500/50 transition-all">
                                        <img
                                            src={`https://www.roblox.com/headshot-thumbnail/image?userId=${linkedAccount.roblox_id}&width=420&height=420&format=png`}
                                            alt={linkedAccount.roblox_username}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="text-left">
                                        <h2 className="text-xl font-black text-white tracking-tight">{linkedAccount.roblox_username}</h2>
                                        <p className="text-xs font-mono text-sky-500">ID: {linkedAccount.roblox_id}</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Verified</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col gap-3">
                                <button
                                    onClick={handleRobloxLink}
                                    disabled={loading}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-xl transition-all border border-slate-700 text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {loading ? (
                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        "Change Linked Account"
                                    )}
                                </button>
                                <p className="text-[10px] text-slate-600 font-medium italic">Your roles in Ro-Link servers will update automatically.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-sky-600/5 border border-sky-500/10 rounded-2xl p-8 mb-8">
                                <p className="text-sm text-slate-300 leading-relaxed">Link your account to gain access to <b>Verified</b> roles and manage your player data across all Ro-Link integrated games.</p>
                            </div>

                            <button
                                onClick={handleRobloxLink}
                                disabled={loading}
                                className="w-full bg-white hover:bg-slate-100 text-black font-black py-5 rounded-2xl transition-all shadow-2xl shadow-sky-900/10 flex items-center justify-center gap-4 active:scale-95 text-sm uppercase tracking-widest group"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <RobloxIcon />
                                        LINK ROBLOX ACCOUNT
                                    </>
                                )}
                            </button>

                            <div className="flex flex-col gap-1">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Signed in as {session.user?.name}</p>
                                <p className="text-[10px] text-slate-600 font-medium">Not you? Re-login via Discord</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <footer className="mt-12 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                Protected by Ro-Link Security &bull; Official OAuth2 Integration
            </footer>
        </div>
    );
}
