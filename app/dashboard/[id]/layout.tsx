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
    const [isReadOnly, setIsReadOnly] = useState(true);

    useEffect(() => {
        if (!session) return;
        const userId = (session?.user as any)?.id;
        const superUserId = '953414442060746854';

        if (userId === superUserId) {
            // Fetch guilds to see if cherubmanaged this one
            fetch('/api/guilds')
                .then(res => res.json())
                .then(guilds => {
                    const g = guilds.find((g: any) => g.id === id);
                    if (g && g.permissions !== "0") {
                        setIsReadOnly(false);
                    } else {
                        setIsReadOnly(true);
                    }
                });
        } else {
            setIsReadOnly(false);
        }
    }, [session, id]);

    const utilityItems = [
        { label: "Home", icon: <HomeIcon />, href: `/dashboard/${id}` },
        { label: "Live Servers", icon: <ServersIcon />, href: `/dashboard/${id}/servers` },
        { label: "Player Lookup", icon: <LookupIcon />, href: `/dashboard/${id}/lookup` },
        { label: "Misc Actions", icon: <MagicIcon />, href: `/dashboard/${id}/misc` },
    ];

    const settingItems = [
        { label: "Setup", icon: <SetupIcon />, href: `/dashboard/${id}/setup`, hide: isReadOnly },
    ].filter(item => !item.hide);

    const allItems = [...utilityItems, ...settingItems];

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex w-64 border-r border-slate-800 bg-[#020617] flex-col fixed inset-y-0 h-full z-50">
                <div className="p-6">
                    <Link href="/dashboard" className="flex items-center gap-3 mb-10 pl-2 hover:opacity-80 transition-opacity cursor-pointer">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-8 h-8 rounded object-contain shadow-lg shadow-sky-500/10" />
                        <span className="text-xl font-black tracking-tighter text-white uppercase italic">Ro-Link</span>
                    </Link>

                    <nav className="space-y-8">
                        <div>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 ml-2">Utility</p>
                            <div className="space-y-1">
                                {utilityItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group font-semibold text-sm ${isActive
                                                ? "bg-sky-600/10 text-sky-400 border border-sky-500/10"
                                                : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
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
                                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group font-semibold text-sm ${isActive
                                                    ? "bg-sky-600/10 text-sky-400 border border-sky-500/10"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
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
                </div>

                <div className="mt-auto p-6">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-all font-semibold text-sm group"
                    >
                        <BackIcon />
                        Back to Servers
                    </Link>
                </div>
            </aside>

            {/* Bottom Nav (Mobile) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#020617]/90 border-t border-slate-800 backdrop-blur-md z-50 flex justify-around items-center h-16 px-2">
                {allItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${isActive ? "text-sky-400" : "text-slate-500"}`}
                        >
                            {item.icon}
                            <span className="text-[10px] font-bold mt-1">{item.label}</span>
                        </Link>
                    )
                })}
                <Link href="/dashboard" className="flex flex-col items-center justify-center p-2 text-slate-500">
                    <BackIcon />
                    <span className="text-[10px] font-bold mt-1">Exit</span>
                </Link>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 min-h-screen flex flex-col mb-16 md:mb-0">
                <header className="h-16 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-10 sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest hidden sm:block">Server ID</span>
                        <div className="h-4 w-[1px] bg-slate-800 mx-2 hidden sm:block"></div>
                        <code className="text-[10px] font-mono text-sky-500 bg-sky-500/5 px-2 py-1 rounded border border-sky-500/10 uppercase tracking-wider truncate max-w-[120px] sm:max-w-none">
                            {id}
                        </code>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-6 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
                            <span className="hidden sm:inline">Network Status:</span> <span className="text-emerald-500">Nominal</span>
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
