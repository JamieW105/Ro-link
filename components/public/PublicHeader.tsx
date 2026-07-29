'use client';

import { Menu, X } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DiscordIcon } from '@/components/ui/DiscordIcon';

const SUPPORT_DISCORD_URL = 'https://discord.gg/C3n4nAwYMw';

const navigation = [
    { href: '/posts', label: 'Updates' },
    { href: '/docs', label: 'Documentation' },
    { href: '/careers', label: 'Careers' },
    { href: '/report', label: 'Report' },
];

function isActivePath(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeader() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    function handleSignIn() {
        signIn('discord', { callbackUrl: '/dashboard' });
    }

    return (
        <header className="relative z-50 border-b border-slate-800/70 bg-[#020617]/95 text-slate-200 backdrop-blur-md">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 sm:px-8" aria-label="Primary navigation">
                <Link href="/" className="flex items-center gap-3" aria-label="Ro-Link home">
                    <Image src="/Media/Ro-LinkIcon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-contain" />
                    <span className="pl-1 text-xl font-semibold tracking-tight text-white">Ro-Link</span>
                </Link>

                <div className="hidden items-center gap-8 md:flex">
                    {navigation.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                            className={`text-sm font-semibold transition-colors ${isActivePath(pathname, item.href) ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <a
                        href={SUPPORT_DISCORD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                    >
                        <DiscordIcon width="18" height="18" aria-hidden="true" />
                        Support Server
                    </a>
                    <button
                        type="button"
                        onClick={handleSignIn}
                        className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-sky-900/20 transition-all hover:bg-sky-500"
                    >
                        Sign In
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => setIsMenuOpen((current) => !current)}
                    className="p-2 text-slate-400 transition-colors hover:text-white md:hidden"
                    aria-expanded={isMenuOpen}
                    aria-controls="public-mobile-navigation"
                    aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
                >
                    {isMenuOpen ? <X width="24" height="24" strokeWidth="2" /> : <Menu width="24" height="24" strokeWidth="2" />}
                </button>
            </nav>

            <div
                id="public-mobile-navigation"
                className={`mx-auto max-w-7xl overflow-hidden px-6 transition-all duration-300 ease-in-out sm:px-8 md:hidden ${isMenuOpen ? 'max-h-96 pb-8 opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                    {navigation.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                            className={`text-base font-semibold transition-colors ${isActivePath(pathname, item.href) ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <a
                        href={SUPPORT_DISCORD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-base font-semibold text-slate-300 transition-colors hover:text-white"
                    >
                        <DiscordIcon width="18" height="18" aria-hidden="true" />
                        Support Server
                    </a>
                    <button
                        type="button"
                        onClick={handleSignIn}
                        className="w-full rounded-xl bg-sky-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-md shadow-sky-900/10 transition-all hover:bg-sky-500"
                    >
                        Sign In to Dashboard
                    </button>
                </div>
            </div>
        </header>
    );
}
