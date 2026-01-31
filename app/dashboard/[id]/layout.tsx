'use client';

import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// SVGs
const OverviewIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
);

const ServersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12a7 7 0 0 1 14 0" /><path d="M8.5 15.5a3.5 3.5 0 0 1 7 0" /><path d="M2 8a12 12 0 0 1 20 0" /><circle cx="12" cy="18" r="1" /></svg>
);

const SetupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
);

const BackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
);

const LookupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);

export default function ServerLayout({ children }: { children: React.ReactNode }) {
    const { id } = useParams();
    const pathname = usePathname();

    const menuItems = [
        { label: "Overview", icon: <OverviewIcon />, href: `/dashboard/${id}` },
        { label: "Live Servers", icon: <ServersIcon />, href: `/dashboard/${id}/servers` },
        { label: "Player Lookup", icon: <LookupIcon />, href: `/dashboard/${id}/lookup` },
        { label: "Setup", icon: <SetupIcon />, href: `/dashboard/${id}/setup` },
    ];

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-[#020617] flex flex-col fixed inset-y-0 h-full z-50">
                <div className="p-6">
                    <Link href="/dashboard" className="flex items-center gap-3 mb-10 pl-2 hover:opacity-80 transition-opacity cursor-pointer">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="w-8 h-8 rounded object-contain" />
                        <span className="text-lg font-bold tracking-tight text-white">Ro-Link</span>
                    </Link>

                    <nav className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2">Main Menu</p>
                        {menuItems.map((item) => {
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

            {/* Main Content Area */}
            <main className="flex-1 ml-64 min-h-screen flex flex-col">
                <header className="h-16 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md flex items-center justify-between px-10 sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Server ID</span>
                        <div className="h-4 w-[1px] bg-slate-800 mx-2"></div>
                        <code className="text-xs font-mono text-sky-500 bg-sky-500/5 px-2 py-1 rounded border border-sky-500/10 uppercase tracking-tighter">
                            {id}
                        </code>
                    </div>

                    <div className="flex items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
                            Network Status: <span className="text-emerald-500">Nominal</span>
                        </div>
                        <div className="h-3 w-[1px] bg-slate-800"></div>
                        API Latency: <span className="text-sky-500">12ms</span>
                    </div>
                </header>

                <div className="p-10 flex-1 bg-gradient-to-tr from-[#020617] via-[#020617] to-sky-950/10">
                    {children}
                </div>
            </main>
        </div>
    );
}
