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

    useEffect(() => {
        if (session?.user) {
            const userId = (session.user as any).id;
            // Cherubdude check
            if (userId === '953414442060746854') {
                setPerms(['RO_LINK_DASHBOARD', 'MANAGE_SERVERS', 'POST_JOB_APPLICATION', 'BLOCK_SERVERS', 'MANAGE_RO_LINK']);
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
        { name: 'Blocking', href: '/management/blocking', icon: 'M18.36 6.64a9 9 0 11-12.73 0M12 2v10', perm: 'BLOCK_SERVERS' },
        { name: 'People', href: '/management/people', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m11-10a4 4 0 11-8 0 4 4 0 018 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zm-2 4v2', perm: 'MANAGE_RO_LINK' },
    ];

    const filteredNav = navItems.filter(item => perms.includes(item.perm) || perms.includes('MANAGE_RO_LINK'));

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-[#020617] border-r border-slate-800 flex flex-col">
                <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                    <img src="/Media/Ro-LinkIcon.png" alt="" className="w-8 h-8 rounded-lg" />
                    <span className="font-bold text-white tracking-tight">Management</span>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {filteredNav.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === item.href
                                    ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                            </svg>
                            {item.name}
                        </Link>
                    ))}
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
            <main className="flex-1 overflow-auto bg-[#020617] p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
