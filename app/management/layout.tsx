'use client';

import { useSession } from "next-auth/react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from "react";

export default function ManagementLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const [perms, setPerms] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isNavOpen, setIsNavOpen] = useState(false);

    useEffect(() => {
        if (session?.user) {
            const userId = (session.user as any).id;
            // Cherubdude check
            if (userId === '953414442060746854') {
                setPerms(['RO_LINK_DASHBOARD', 'MANAGE_SERVERS', 'POST_JOB_APPLICATION', 'POST_UPDATES', 'BLOCK_SERVERS', 'MANAGE_RO_LINK']);
                setLoading(false);
                return;
            }

            // Fetch from API
            fetch('/api/management/check')
                .then(res => res.json())
                .then(data => {
                    setPerms(data.permissions || []);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
    }, [session, status]);

    useEffect(() => {
        setIsNavOpen(false);
    }, [pathname]);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!perms.includes('RO_LINK_DASHBOARD') && (session?.user as any)?.id !== '953414442060746854') {
        return (
            <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-slate-400 mb-8">You do not have permission to access the Ro-Link Management Dashboard.</p>
                <Link href="/dashboard" className="bg-sky-600 px-6 py-2 rounded-lg font-semibold hover:bg-sky-500 transition-all">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const navItems = [
        { name: 'Overview', href: '/management', icon: 'M3 9h18M9 3v18', perm: 'RO_LINK_DASHBOARD' },
        { name: 'Servers', href: '/management/servers', icon: 'M5 12h14M12 5l7 7-7 7', perm: 'MANAGE_SERVERS' },
        { name: 'Job Apps', href: '/management/jobs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', perm: 'POST_JOB_APPLICATION' },
        { name: 'Updates', href: '/management/posts', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', perm: 'POST_UPDATES' },
        { name: 'Blocking', href: '/management/blocking', icon: 'M18.36 6.64a9 9 0 11-12.73 0M12 2v10', perm: 'BLOCK_SERVERS' },
        { name: 'People', href: '/management/people', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m11-10a4 4 0 11-8 0 4 4 0 018 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zm-2 4v2', perm: 'MANAGE_RO_LINK' },
    ];

    const filteredNav = navItems.filter(item => perms.includes(item.perm) || perms.includes('MANAGE_RO_LINK'));

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex">
            {isNavOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setIsNavOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-72 bg-[#020617] border-r border-slate-800 flex flex-col transform transition-transform duration-300 ease-in-out md:static md:w-64 md:max-w-none md:translate-x-0 ${isNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                    <img src="/Media/Ro-LinkIcon.png" alt="" className="w-8 h-8 rounded-lg" />
                    <span className="font-bold text-white tracking-tight">Management</span>
                    <button
                        onClick={() => setIsNavOpen(false)}
                        className="ml-auto rounded-lg border border-slate-800 p-2 text-slate-400 hover:text-white md:hidden"
                        aria-label="Close navigation"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6 6 18" />
                        </svg>
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    {filteredNav.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/management' && pathname.startsWith(`${item.href}/`));

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                    ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                </svg>
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Exit Management
                    </Link>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 min-w-0 bg-[#020617] md:ml-0">
                <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-[#020617]/90 px-4 py-4 backdrop-blur-md md:hidden">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Ro-Link</p>
                        <h1 className="text-sm font-bold text-white">Management</h1>
                    </div>
                    <button
                        onClick={() => setIsNavOpen(true)}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-slate-300 hover:text-white"
                        aria-label="Open navigation"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M3 12h18M3 18h18" />
                        </svg>
                    </button>
                </header>
                <div className="min-w-0 p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
