'use client';
import { Box, MessageCircle } from "lucide-react";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { DGSU_BAN_AUTH_ERROR, DGSU_BAN_ERROR_MESSAGE } from "@/lib/dgsuBanConstants";
import { buildRobloxAvatarUrl } from "@/lib/robloxAvatars";

const RobloxIcon = () => <Box size={18} aria-hidden="true" />;

const DiscordIcon = () => <MessageCircle size={24} aria-hidden="true" />;

type LinkedAccount = {
    roblox_id: string;
    roblox_username: string;
};

export default function VerifyPage() {
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(false);
    const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
    const [fetchingLinked, setFetchingLinked] = useState(true);
    const [failedAvatarUserId, setFailedAvatarUserId] = useState<string | null>(null);
    const pageError = session?.error === DGSU_BAN_AUTH_ERROR ? DGSU_BAN_ERROR_MESSAGE : null;

    useEffect(() => {
        let cancelled = false;

        async function loadLinkedAccount() {
            const response = await fetch('/api/verify/linked-account', { cache: 'no-store' });
            if (cancelled) return;

            if (response.ok) {
                const data: LinkedAccount | null = await response.json();
                if (!cancelled && data) {
                    setLinkedAccount(data);
                }
            }

            if (!cancelled) {
                setFetchingLinked(false);
            }
        }

        if (session && session.user) {
            loadLinkedAccount();
        } else if (status !== 'loading') {
            queueMicrotask(() => {
                if (!cancelled) {
                    setFetchingLinked(false);
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [session, status]);

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

    const linkedRobloxUserId = linkedAccount?.roblox_id ? String(linkedAccount.roblox_id) : '';
    const avatarFailed = failedAvatarUserId === linkedRobloxUserId;
    const linkedRobloxAvatarUrl = linkedRobloxUserId
        ? buildRobloxAvatarUrl(linkedRobloxUserId, 420)
        : null;

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

                    {pageError ? (
                        <div className="mb-8 rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm font-semibold leading-6 text-red-100">
                            {pageError}
                        </div>
                    ) : null}

                    {linkedAccount ? (
                        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                            <div className="bg-black/40 p-8 rounded-2xl border border-slate-800 group transition-all hover:border-sky-500/30">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Linked Roblox Account</p>
                                <div className="flex items-center gap-5">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-800 overflow-hidden border-2 border-slate-700 shadow-xl group-hover:border-sky-500/50 transition-all">
                                        <img
                                            src={!avatarFailed && linkedRobloxAvatarUrl ? linkedRobloxAvatarUrl : "/Media/Roblox.png"}
                                            alt={linkedAccount.roblox_username}
                                            onError={() => setFailedAvatarUserId(linkedRobloxUserId)}
                                            className={`w-full h-full ${avatarFailed ? 'object-contain p-4' : 'object-cover'}`}
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

