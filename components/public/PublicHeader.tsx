'use client';

import {
    BookOpen,
    BriefcaseBusiness,
    ChevronDown,
    Flag,
    Menu,
    MessageCircle,
    Newspaper,
    X,
} from 'lucide-react';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getDiscordBotInviteUrl } from '@/lib/discordInvite';

const SUPPORT_DISCORD_URL = 'https://discord.gg/C3n4nAwYMw';

const helpLinks = [
    { href: SUPPORT_DISCORD_URL, label: 'Support server', icon: MessageCircle, external: true },
    { href: '/report', label: 'Reports', icon: Flag },
    { href: '/careers', label: 'Careers', icon: BriefcaseBusiness },
    { href: '/docs', label: 'Documentation', icon: BookOpen },
    { href: '/posts', label: 'Posts', icon: Newspaper },
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

    return (
        <header className="rl-public-header">
            <nav className="rl-public-nav rl-shell" aria-label="Primary navigation">
                <Link href="/" className="rl-brand" aria-label="Ro-Link home">
                    <span className="rl-brand-mark">
                        <Image src="/Media/Ro-LinkIcon.png" alt="" width={25} height={25} />
                    </span>
                    <span>Ro-Link</span>
                </Link>

                <ul className="rl-nav-links" id="public-navigation" data-open={isMenuOpen}>
                    <li>
                        <Link className="rl-nav-link" href="/" aria-current={pathname === '/' ? 'page' : undefined}>Overview</Link>
                    </li>
                    <li>
                        <Link className="rl-nav-link" href="/features" aria-current={isActivePath(pathname, '/features') ? 'page' : undefined}>Features</Link>
                    </li>
                    <li>
                        <Link className="rl-nav-link" href="/#setup">Setup</Link>
                    </li>
                    <li>
                        <details className="rl-help-menu">
                            <summary>
                                Help
                                <ChevronDown aria-hidden="true" />
                            </summary>
                            <div className="rl-help-popover">
                                {helpLinks.map(({ href, label, icon: Icon, external }) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        aria-current={!external && isActivePath(pathname, href) ? 'page' : undefined}
                                        target={external ? '_blank' : undefined}
                                        rel={external ? 'noopener noreferrer' : undefined}
                                    >
                                        <Icon aria-hidden="true" />
                                        {label}
                                    </Link>
                                ))}
                            </div>
                        </details>
                    </li>
                    <li className="rl-mobile-actions">
                        <button className="rl-button" type="button" onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}>Sign in</button>
                        <a className="rl-button rl-button-primary" href={getDiscordBotInviteUrl()} target="_blank" rel="noopener noreferrer">Install</a>
                    </li>
                </ul>

                <div className="rl-nav-actions">
                    <button className="rl-sign-in" type="button" onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}>Sign in</button>
                    <a className="rl-button rl-button-primary" href={getDiscordBotInviteUrl()} target="_blank" rel="noopener noreferrer">Install Ro-Link</a>
                    <button
                        className="rl-menu-toggle"
                        type="button"
                        aria-expanded={isMenuOpen}
                        aria-controls="public-navigation"
                        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        onClick={() => setIsMenuOpen((current) => !current)}
                    >
                        {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                    </button>
                </div>
            </nav>
        </header>
    );
}
