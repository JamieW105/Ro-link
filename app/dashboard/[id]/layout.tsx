'use client';

import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

// --- PREMIUM SVG ICONS ---

const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const ServersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
);

const MagicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
    </svg>
);

const SetupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
    </svg>
);

const BackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
);

const LookupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
);

export default function ServerLayout({ children }: { children: React.ReactNode }) {
    const { id } = useParams();
    const pathname = usePathname();
    const { data: session } = useSession();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) return;
        const userId = (session?.user as any)?.id;
        const superUserId = '953414442060746854';

        fetch('/api/guilds')
            .then(res => res.json())
            .then(guilds => {
                const g = guilds.find((g: any) => g.id === id);

                // Permission Guard
                if (!g) {
                    console.log("[Guard] Server not found in user list or superuser monitor.");
                    router.push('/dashboard');
                    return;
                }

                // Bot Presence Guard
                if (!g.hasBot) {
                    console.log("[Guard] Bot not present in this server.");
                    router.push('/dashboard');
                    return;
                }

                if (userId === superUserId) {
                    if (g.permissions !== "0") {
                        setIsReadOnly(false);
                    } else {
                        setIsReadOnly(true);
                    }
                } else {
                    setIsReadOnly(false);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("[Guard] Error checking permissions:", err);
                router.push('/dashboard');
            });
    }, [session, id, router]);

    // Close sidebar on pathname change (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    if (loading) return null; // Don't flash sidebar while checking perms

    const utilityItems = [
        { label: "Home", icon: <HomeIcon />, href: `/dashboard/${id}` },
        { label: "Live Servers", icon: <ServersIcon />, href: `/dashboard/${id}/servers` },
        {
            label: "Verification",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                </svg>
            ),
            href: `/dashboard/${id}/verification`
        },
    ];

    const moderationItems = [
        { label: "Player Lookup", icon: <LookupIcon />, href: `/dashboard/${id}/lookup` },
        {
            label: "Reports",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            ),
            href: `/dashboard/${id}/reports`
        },
        { label: "Misc Actions", icon: <MagicIcon />, href: `/dashboard/${id}/misc` },
    ];

    const ScrollIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" /><path d="M12 11V7" /><path d="M12 17v-2" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h8" /></svg>
    );

    const settingItems = [
        {
            label: "General",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
                </svg>
            ),
            href: `/dashboard/${id}/settings`,
            hide: isReadOnly
        },
        { label: "Logs", icon: <ScrollIcon />, href: `/dashboard/${id}/settings/logs`, hide: isReadOnly },
        { label: "Logs", icon: <ScrollIcon />, href: `/dashboard/${id}/settings/logs`, hide: isReadOnly },
    ].filter(item => !item.hide);

    const allItems = [...utilityItems, ...moderationItems, ...settingItems];

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans">
            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar (Desktop & Mobile Drawer) */}
            <aside className={`
                fixed inset-y-0 left-0 w-72 bg-[#020617] border-r border-slate-800 z-[70] 
                transform transition-transform duration-300 ease-in-out flex flex-col
                md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                        <Link href="/dashboard" className="flex items-center gap-3 pl-2 hover:opacity-80 transition-opacity cursor-pointer">
                            <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-8 h-8 rounded object-contain shadow-lg shadow-sky-500/10" />
                            <span className="text-xl font-black tracking-tighter text-white uppercase italic">Ro-Link</span>
                        </Link>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-500 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <nav className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                        <div>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 ml-2">Utility</p>
                            <div className="space-y-1">
                                {utilityItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                }`}
                                        >
                                            <span className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                {item.icon}
                                            </span>
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 ml-2">Moderation</p>
                            <div className="space-y-1">
                                {moderationItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                }`}
                                        >
                                            <span className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                {item.icon}
                                            </span>
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {settingItems.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2">Setting</p>
                                <div className="space-y-1">
                                    {settingItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                    ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                            >
                                                <span className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </nav>

                    <div className="mt-auto pt-6 border-t border-slate-800">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all font-semibold text-sm group"
                        >
                            <BackIcon />
                            Back to Servers
                        </Link>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-72 min-h-screen flex flex-col">
                <header className="h-16 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-10 sticky top-0 z-50">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:block">Server ID</span>
                            <div className="h-4 w-[1px] bg-slate-800 mx-2 hidden sm:block"></div>
                            <code className="text-[10px] font-mono text-sky-400 bg-sky-400/5 px-2 py-1 rounded border border-sky-400/10 uppercase tracking-wider truncate max-w-[100px] sm:max-w-none">
                                {id}
                            </code>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-6 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
                            <span className="hidden xs:inline">Network:</span> <span className="text-emerald-500">Nominal</span>
                        </div>
                        <div className="h-3 w-[1px] bg-slate-800 hidden sm:block"></div>
                        <span className="hidden sm:inline">API Latency:</span> <span className="text-sky-500 hidden sm:inline">12ms</span>
                    </div>
                </header>

                <div className="p-4 md:p-10 flex-1 bg-gradient-to-tr from-[#020617] via-[#020617] to-sky-950/5">
                    {children}
                </div>
            </main>
        </div>
    );
}
