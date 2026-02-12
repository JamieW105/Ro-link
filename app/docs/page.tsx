'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';

// --- Icons (Lucide-style SVGs) ---
const Icons = {
    Book: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
    Rocket: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.5-1 1-4c2 0 3 .5 3 .5L12 11Z" /><path d="M15 9h5s1 .5 4 1c0 2-.5 3-.5 3L11 12Z" /></svg>,
    Key: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m21 2-2 2a5 5 0 0 0-7 7l-9 9v3h3l9-9a5 5 0 0 0 7-7l2-2Z" /><path d="m15 5 4 4" /></svg>,
    Globe: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    Box: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
    ExternalLink: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>,
    ChevronRight: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6" /></svg>,
    Copy: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>,
    Check: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 6 9 17 4 12" /></svg>,
    Menu: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>,
    X: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
};

// --- Reusable Content Components ---

const CodeBlock = ({ children, label }: { children: ReactNode, label?: string }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        if (!children) return;
        // simplistic text extraction
        const text = document.getElementById(`code-${label}`)?.innerText || String(children);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-6 rounded-xl overflow-hidden border border-slate-800 bg-[#0B1120] shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-800">
                <span className="text-xs font-mono text-slate-400 font-medium">{label || 'Code'}</span>
                <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                >
                    {copied ? <Icons.Check className="w-3.5 h-3.5 text-emerald-500" /> : <Icons.Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="p-4 font-mono text-sm text-slate-300 overflow-x-auto whitespace-pre leading-relaxed" id={`code-${label}`}>
                {children}
            </div>
        </div>
    );
};

const Highlight = ({ children, type = 'default' }: { children: ReactNode, type?: 'default' | 'variable' | 'path' }) => {
    const colors = {
        default: "text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded border border-sky-500/20",
        variable: "text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20",
        path: "text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded border border-orange-500/20"
    };

    return <span className={`${colors[type]} font-medium text-[0.9em]`}>{children}</span>;
}

const InfoBox = ({ children, title = "Note" }: { children: ReactNode, title?: string }) => (
    <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-5 my-6">
        <div className="flex gap-3">
            <div className="text-sky-500 mt-0.5 shrink-0">
                <Icons.Rocket className="w-5 h-5" />
            </div>
            <div>
                <h4 className="text-sm font-bold text-sky-400 mb-1">{title}</h4>
                <div className="text-sm text-sky-200/70 leading-relaxed">
                    {children}
                </div>
            </div>
        </div>
    </div>
);

const CardLink = ({ href, icon: Icon, title, description }: { href: string, icon: any, title: string, description: string }) => (
    <Link href={href} className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition-all group">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-sky-600 transition-colors">
            <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-white font-medium truncate group-hover:text-sky-400 transition-colors">{title}</h4>
            <p className="text-sm text-slate-500 truncate">{description}</p>
        </div>
        <Icons.ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white" />
    </Link>
);


// --- Page Content Data ---

const pages = [
    {
        id: 'intro',
        category: 'Platform',
        title: 'Getting Started',
        icon: Icons.Rocket,
        toc: [
            { id: 'overview', title: 'Overview' },
            { id: 'dashboard-link', title: 'Access Dashboard' },
            { id: 'support', title: 'Support & Community' },
        ],
        content: (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-lg text-slate-400 leading-relaxed">
                    Thank you for choosing Ro-Link as your Roblox-Discord integration system. This guide will walk you through setting up your environment, connecting your first game, and configuring the moderation tools.
                </p>

                <section id="overview" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/20">
                            <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Real-time Sync
                            </h3>
                            <p className="text-sm text-slate-500">Instant communication between your Roblox game servers and Discord.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/20">
                            <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                Secure API
                            </h3>
                            <p className="text-sm text-slate-500">Authenticated requests using Roblox Open Cloud standards.</p>
                        </div>
                    </div>
                </section>

                <section id="dashboard-link" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold text-white mb-4">Head over to the Dashboard</h2>
                    <p className="text-slate-400 mb-6">
                        First of all, go to the Ro-Link dashboard and sign in with your Discord account. This is your command center for managing servers and viewing logs.
                    </p>
                    <CardLink
                        href="/dashboard"
                        icon={Icons.Box}
                        title="Open Dashboard"
                        description="Access your server management console"
                    />
                </section>

                <section id="support" className="scroll-mt-24">
                    <InfoBox title="Need Help?">
                        Join our Discord community for 24/7 support and updates on the latest features.
                        <br />
                        <Link href="#" className="underline hover:text-white mt-2 inline-block">Join Support Server →</Link>
                    </InfoBox>
                </section>
            </div>
        )
    },
    {
        id: 'setup-roblox',
        category: 'configuration',
        title: 'Roblox Configuration',
        icon: Icons.Box,
        toc: [
            { id: 'place-id', title: 'Place ID' },
            { id: 'universe-id', title: 'Universe ID' },
            { id: 'api-key', title: 'API Key' },
        ],
        content: (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-lg text-slate-400">
                    To connect your game, we need three critical pieces of information from Roblox. These allow us to identify your game and securely send commands.
                </p>

                <section id="place-id" className="scroll-mt-24">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-px bg-slate-800 flex-1"></div>
                        <h2 className="text-xl font-bold text-white">1. Place ID</h2>
                        <div className="h-px bg-slate-800 flex-1"></div>
                    </div>
                    <p className="text-slate-400 mb-4">
                        The unique identifier for your specific starting place.
                    </p>
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800/50">
                        <ol className="list-decimal list-inside space-y-3 text-slate-300">
                            <li>Go to your game on the <a href="https://www.roblox.com/games" target="_blank" className="text-sky-400 hover:underline">Roblox Website</a>.</li>
                            <li>Copy the ID from the URL:</li>
                        </ol>
                        <CodeBlock label="URL Structure">
                            https://www.roblox.com/games/<Highlight type="variable">1234567890</Highlight>/Your-Game
                        </CodeBlock>
                    </div>
                </section>

                <section id="universe-id" className="scroll-mt-24">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-px bg-slate-800 flex-1"></div>
                        <h2 className="text-xl font-bold text-white">2. Universe ID</h2>
                        <div className="h-px bg-slate-800 flex-1"></div>
                    </div>
                    <p className="text-slate-400 mb-4">
                        Also known as the Experience ID. Required for Open Cloud access.
                    </p>
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800/50">
                        <ol className="list-decimal list-inside space-y-3 text-slate-300">
                            <li>Visit the <a href="https://create.roblox.com/dashboard/creations" target="_blank" className="text-sky-400 hover:underline">Creator Dashboard</a>.</li>
                            <li>Click on your experience.</li>
                            <li>Copy the ID from the URL:</li>
                        </ol>
                        <CodeBlock label="Creator Dashboard URL">
                            .../dashboard/creations/experiences/<Highlight type="variable">9876543210</Highlight>/overview
                        </CodeBlock>
                    </div>
                </section>

                <section id="api-key" className="scroll-mt-24">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-px bg-slate-800 flex-1"></div>
                        <h2 className="text-xl font-bold text-white">3. API Key</h2>
                        <div className="h-px bg-slate-800 flex-1"></div>
                    </div>
                    <InfoBox title="Security Warning">
                        Never share your API Key. It gives access to publish messages to your game servers.
                    </InfoBox>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-white font-medium mb-2">Required Permissions</h3>
                            <div className="grid sm:grid-cols-2 gap-3 mb-4">
                                <div className="p-3 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                                    <span className="block text-xs font-bold text-sky-500 uppercase">Messaging Service</span>
                                    Publish
                                </div>
                                <div className="p-3 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                                    <span className="block text-xs font-bold text-sky-500 uppercase">User API</span>
                                    Read
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )
    },
    {
        id: 'installation',
        category: 'developer',
        title: 'Script Installation',
        icon: Icons.Book,
        toc: [
            { id: 'module-loader', title: 'Module Loader' },
            { id: 'config', title: 'Configuration' },
        ],
        content: (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-lg text-slate-400">
                    The final step is to add the Ro-Link loader to your Roblox game. This script handles communication with our secure gateway.
                </p>

                <section id="module-loader" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold text-white mb-4">Module Loader</h2>
                    <p className="text-slate-400 mb-4">
                        Create a generic <Highlight>Script</Highlight> (Server-side) in <Highlight type="path">ServerScriptService</Highlight> and name it "RoLinkLoader". Paste the following code:
                    </p>
                    <CodeBlock label="ServerScriptService > RoLinkLoader.lua">
                        {`-- Ro-Link Loader v1.5
local RoLink = require(123456789) -- Official Ro-Link Module ID

RoLink.Initialize({
    APIKey = "YOUR_CONFIG_KEY_HERE", -- We will provide this in Dashboard
    Debug = false
})`}
                    </CodeBlock>
                </section>

                <section id="config" className="scroll-mt-24">
                    <InfoBox title="Configuration Key">
                        You will generate a unique configuration key in the Dashboard under "Server Setup". Do not use your Open Cloud API Key here.
                    </InfoBox>
                </section>
            </div>
        )
    }
];

export default function DocsPage() {
    const [activePageId, setActivePageId] = useState('intro');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const activePage = pages.find(p => p.id === activePageId) || pages[0];

    // Scroll handling for TOC
    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-sky-500/30">
            {/* Top Navigation Bar (Mobile Only) */}
            <div className="lg:hidden sticky top-0 z-50 bg-[#020617]/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white">
                    <span className="text-sky-500">Ro-Link</span> Docs
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                    {mobileMenuOpen ? <Icons.X /> : <Icons.Menu />}
                </button>
            </div>

            <div className="max-w-[1440px] mx-auto flex items-start">

                {/* Left Sidebar (Navigation) */}
                <aside className={`
                    fixed inset-0 z-40 bg-[#020617] lg:bg-transparent lg:static lg:w-72 lg:block border-r border-slate-800/50
                    ${mobileMenuOpen ? 'flex flex-col' : 'hidden'}
                `}>
                    <div className="h-screen sticky top-0 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
                        <div className="hidden lg:flex items-center gap-2 font-bold text-xl text-white mb-8">
                            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-900/30">
                                <Icons.Book className="w-4 h-4 text-white" />
                            </div>
                            <span>Documentation</span>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-4 pl-3 opacity-80">Platform</h3>
                                <div className="space-y-0.5">
                                    {pages.filter(p => p.category === 'Platform').map(page => (
                                        <NavButton
                                            key={page.id}
                                            active={activePageId === page.id}
                                            onClick={() => { setActivePageId(page.id); setMobileMenuOpen(false); }}
                                            icon={page.icon}
                                        >
                                            {page.title}
                                        </NavButton>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-4 pl-3 opacity-80">Configuration</h3>
                                <div className="space-y-0.5">
                                    {pages.filter(p => p.category === 'configuration').map(page => (
                                        <NavButton
                                            key={page.id}
                                            active={activePageId === page.id}
                                            onClick={() => { setActivePageId(page.id); setMobileMenuOpen(false); }}
                                            icon={page.icon}
                                        >
                                            {page.title}
                                        </NavButton>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-4 pl-3 opacity-80">Developer API</h3>
                                <div className="space-y-0.5">
                                    {pages.filter(p => p.category === 'developer').map(page => (
                                        <NavButton
                                            key={page.id}
                                            active={activePageId === page.id}
                                            onClick={() => { setActivePageId(page.id); setMobileMenuOpen(false); }}
                                            icon={page.icon}
                                        >
                                            {page.title}
                                        </NavButton>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 pt-8 border-t border-slate-800">
                            <Link href="/" className="text-slate-500 hover:text-white text-xs font-semibold uppercase tracking-widest flex items-center gap-2 transition-colors hover:translate-x-1 duration-200">
                                ← Back to Home
                            </Link>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0 px-6 lg:px-12 py-12 lg:py-16">
                    <div className="max-w-4xl mx-auto lg:mx-0">
                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-6 uppercase tracking-widest">
                            <span className="text-sky-500">{activePage.category}</span>
                            <Icons.ChevronRight className="w-3 h-3 text-slate-700" />
                            <span>{activePage.title}</span>
                        </div>

                        {/* Title Header */}
                        <div className="mb-8 pb-8 border-b border-slate-800/50">
                            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">{activePage.title}</h1>
                        </div>

                        {/* Page Content */}
                        <div className="prose prose-invert max-w-none prose-headings:scroll-mt-24 prose-a:text-sky-400 prose-a:no-underline hover:prose-a:text-sky-300">
                            {activePage.content}
                        </div>
                    </div>
                </main>

                {/* Right Sidebar (Table of Contents) */}
                <aside className={`
                    hidden xl:block w-72 sticky top-0 h-screen overflow-y-auto px-6 py-16 border-l border-slate-800/50 bg-[#020617]/50 backdrop-blur-sm
                    ${activePage.toc.length === 0 ? 'invisible' : ''}
                `}>
                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">On this page</h4>
                    </div>
                    <nav className="space-y-1 relative">
                        {/* Vertical line track */}
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-800"></div>

                        {activePage.toc.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => scrollToSection(item.id)}
                                className="block w-full text-left pl-4 py-2 text-xs font-medium text-slate-500 hover:text-sky-400 hover:border-l hover:border-sky-500 border-l border-transparent -ml-px transition-all duration-200 truncate"
                            >
                                {item.title}
                            </button>
                        ))}
                    </nav>
                </aside>

            </div>
        </div>
    );
}

function NavButton({ active, onClick, children, icon: Icon }: { active: boolean, onClick: () => void, children: ReactNode, icon: any }) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                ${active
                    ? "bg-sky-500/10 text-sky-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"}
            `}
        >
            <Icon className={`w-4 h-4 transition-colors ${active ? "text-sky-400" : "text-slate-600 group-hover:text-slate-400"}`} />
            {children}
        </button>
    )
}
