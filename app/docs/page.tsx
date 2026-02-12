'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';

// --- Icons ---
const BookOpenIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);

const IdIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M15 8h2" /><path d="M15 12h2" /><path d="M7 16c0-1 1-2 2-2s2 1 2 2" /><path d="M15 16h2" /></svg>
);

const GlobeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
);

const KeyIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2a5 5 0 0 0-7 7l-9 9v3h3l9-9a5 5 0 0 0 7-7l2-2Z" /><path d="m15 5 4 4" /></svg>
);

const ExternalLinkIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
);

const ChevronRightIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);

const MenuIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
);


// --- Components ---

const CodeBlock = ({ children, label }: { children: ReactNode, label?: string }) => (
    <div className="my-4 rounded-lg overflow-hidden border border-slate-800 bg-[#0B1120]">
        {label && (
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
                <span>{label}</span>
            </div>
        )}
        <div className="p-4 font-mono text-sm text-slate-300 overflow-x-auto">
            {children}
        </div>
    </div>
);

const Highlight = ({ children, type = 'default' }: { children: ReactNode, type?: 'default' | 'variable' | 'path' }) => {
    const colors = {
        default: "text-sky-400",
        variable: "text-emerald-400",
        path: "text-orange-400"
    };

    return <span className={`${colors[type]} font-semibold`}>{children}</span>;
}

const StepItem = ({ number, title, children }: { number: number, title: string, children: ReactNode }) => (
    <div className="relative pl-10 pb-8 last:pb-0">
        <div className="absolute left-0 top-0 flex flex-col items-center h-full">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-sky-500 z-10 shrink-0">
                {number}
            </div>
            <div className="w-px h-full bg-slate-800 -mt-2 mb-2 last:hidden"></div>
        </div>
        <div>
            <h4 className="text-white font-medium mb-2">{title}</h4>
            <div className="text-slate-400 text-sm space-y-2">
                {children}
            </div>
        </div>
    </div>
);

const InfoBox = ({ children }: { children: ReactNode }) => (
    <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-4 my-6 flex gap-3">
        <div className="text-sky-500 mt-0.5 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        </div>
        <div className="text-sm text-sky-200/80">
            {children}
        </div>
    </div>
);

// --- Data ---

const sections = [
    {
        id: 'place-id',
        title: "Getting your Place ID",
        icon: <IdIcon className="w-4 h-4" />,
        content: (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Getting your Place ID</h2>
                    <p className="text-slate-400 leading-relaxed text-lg">
                        The <Highlight>Place ID</Highlight> is a unique identifier for a specific place within your Roblox experience. This is required to identify where the Ro-Link kernel is running.
                    </p>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 backdrop-blur-sm">
                    <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                        How to find it
                    </h3>
                    <div className="space-y-2">
                        <StepItem number={1} title="Open your game on Roblox">
                            Navigate to your game's page on the <a href="https://www.roblox.com/games" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1 font-medium transition-colors">Roblox Website <ExternalLinkIcon className="w-3 h-3" /></a>.
                        </StepItem>
                        <StepItem number={2} title="Check the URL">
                            Look at the URL in your browser's address bar. It will follow this structure:
                            <CodeBlock label="Browser URL">
                                https://www.roblox.com/games/<Highlight type="variable">1234567890</Highlight>/Your-Game
                            </CodeBlock>
                        </StepItem>
                        <StepItem number={3} title="Copy the ID">
                            The number labeled above in <Highlight type="variable">green</Highlight> is your Place ID. Copy this number.
                        </StepItem>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'universe-id',
        title: "Getting your Universe ID",
        icon: <GlobeIcon className="w-4 h-4" />,
        content: (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Getting your Universe ID</h2>
                    <p className="text-slate-400 leading-relaxed text-lg">
                        The <Highlight>Universe ID</Highlight> (also called Experience ID) acts as the global identifier for your entire game. Open Cloud functionality requires this to target the correct experience.
                    </p>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 backdrop-blur-sm">
                    <h3 className="text-xl font-semibold text-white mb-6">
                        Via Creator Dashboard
                    </h3>
                    <div className="space-y-2">
                        <StepItem number={1} title="Go to Creator Dashboard">
                            Visit the <a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1 font-medium transition-colors">Creator Dashboard <ExternalLinkIcon className="w-3 h-3" /></a>.
                        </StepItem>
                        <StepItem number={2} title="Select your Experience">
                            Click on your experience to open its management page.
                        </StepItem>
                        <StepItem number={3} title="Locate the ID">
                            While on the "Overview" page, check the URL:
                            <CodeBlock label="Creator Dashboard URL">
                                .../dashboard/creations/experiences/<Highlight type="variable">9876543210</Highlight>/overview
                            </CodeBlock>
                            The number formatted in <Highlight type="variable">green</Highlight> is your Universe ID.
                        </StepItem>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'api-key',
        title: "Creating an API Key",
        icon: <KeyIcon className="w-4 h-4" />,
        content: (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Creating an API Key</h2>
                    <p className="text-slate-400 leading-relaxed text-lg">
                        To allow Ro-Link to communicate with your game servers securely, you need to provision an <Highlight>Open Cloud API Key</Highlight> with specific permissions.
                    </p>
                </div>

                <div className="grid gap-6">
                    {/* Step 1 */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 transition-all hover:bg-slate-900/80 hover:border-slate-700">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20 text-sky-400 font-bold text-sm">1</div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white mb-2">Create New Key</h3>
                                <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                                    Navigate to the <a href="https://create.roblox.com/dashboard/credentials?activeTab=ApiKeys" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-medium inline-flex items-center gap-1">API Keys Page <ExternalLinkIcon className="w-3 h-3" /></a> and click <span className="text-white font-medium">"Create API Key"</span>.
                                </p>
                                <div className="bg-black/30 w-full p-3 rounded border border-white/5 text-xs text-slate-500 font-mono">
                                    Name: "Ro-Link Integration"
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 transition-all hover:bg-slate-900/80 hover:border-slate-700">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20 text-sky-400 font-bold text-sm">2</div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white mb-2">Configure Permissions</h3>
                                <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                                    Under "Access Permissions", add the following operations for your experience:
                                </p>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/60 transition-colors hover:border-sky-500/30">
                                        <div className="text-sky-400 font-bold text-[10px] uppercase tracking-wider mb-1">Messaging Service</div>
                                        <div className="text-white text-sm font-medium">Publish</div>
                                        <div className="text-slate-500 text-xs mt-1">Allows sending commands to servers.</div>
                                    </div>
                                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/60 transition-colors hover:border-sky-500/30">
                                        <div className="text-sky-400 font-bold text-[10px] uppercase tracking-wider mb-1">User API</div>
                                        <div className="text-white text-sm font-medium">Read</div>
                                        <div className="text-slate-500 text-xs mt-1">Allows verifying player identities.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 transition-all hover:bg-slate-900/80 hover:border-slate-700">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20 text-sky-400 font-bold text-sm">3</div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white mb-2">Save & Copy</h3>
                                <InfoBox>
                                    <strong>Important:</strong> Copy the API Key immediately. Roblox will hide it forever once you leave the page.
                                </InfoBox>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
];

export default function DocsPage() {
    const [activeSection, setActiveSection] = useState(sections[0].id);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const activeContent = sections.find(s => s.id === activeSection);
    const activeIndex = sections.findIndex(s => s.id === activeSection);

    const handleNav = (id: string) => {
        setActiveSection(id);
        setMobileMenuOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-sky-500/30 selection:text-sky-200">
            {/* Navbar for Mobile */}
            <div className="lg:hidden sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between shadow-lg shadow-black/20">
                <div className="flex items-center gap-2 font-bold text-white">
                    <BookOpenIcon className="text-sky-500" />
                    <span>Documentation</span>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                    aria-label="Toggle Menu"
                >
                    {mobileMenuOpen ? "✕" : <MenuIcon />}
                </button>
            </div>

            {/* Main Layout */}
            <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12 relative">

                {/* Fixed Sidebar for Desktop */}
                <aside className={`
                    fixed inset-0 z-40 bg-[#020617] lg:bg-transparent lg:static lg:w-72 lg:block
                    ${mobileMenuOpen ? 'flex flex-col' : 'hidden'}
                `}>
                    <div className="lg:sticky lg:top-12 h-screen lg:h-[calc(100vh-6rem)] overflow-y-auto px-6 py-8 lg:p-0">
                        <div className="lg:hidden flex justify-end mb-6">
                            {/* Close button handled by outer logic/layout, but redundant here if menu is full screen */}
                        </div>

                        <div className="mb-8 hidden lg:block">
                            <h1 className="flex items-center gap-3 text-xl font-bold text-white tracking-tight">
                                <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-500">
                                    <BookOpenIcon />
                                </div>
                                Docs
                            </h1>
                            <p className="mt-2 text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Configuration Guide</p>
                        </div>

                        <nav className="space-y-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => handleNav(section.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                                        ${activeSection === section.id
                                            ? "bg-slate-800/80 text-sky-400 shadow-sm border border-slate-700/50 translate-x-1"
                                            : "text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent"}
                                    `}
                                >
                                    <span className={`transition-colors ${activeSection === section.id ? "text-sky-400" : "text-slate-600 group-hover:text-slate-400"}`}>
                                        {section.icon}
                                    </span>
                                    {section.title}
                                    {activeSection === section.id && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>
                                    )}
                                </button>
                            ))}
                        </nav>

                        <div className="mt-12 pt-8 border-t border-slate-800/60 hidden lg:block">
                            <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest pl-4 hover:translate-x-1 duration-200">
                                ← Back to Dashboard
                            </Link>
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <main className="flex-1 min-w-0 pb-20">
                    <div className="max-w-3xl mx-auto">
                        <div key={activeSection} className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Breadcrumb-ish indicator */}
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-8 uppercase tracking-widest">
                                <span>Setup</span>
                                <ChevronRightIcon className="w-3 h-3 text-slate-700" />
                                <span className="text-sky-500">{activeContent?.title}</span>
                            </div>

                            {activeContent?.content}

                            {/* Navigation Footer */}
                            <div className="mt-20 pt-10 border-t border-slate-800 flex justify-between items-center gap-6">
                                <div className="flex-1">
                                    {activeIndex > 0 ? (
                                        <button
                                            onClick={() => handleNav(sections[activeIndex - 1].id)}
                                            className="group flex flex-col items-start gap-1 p-4 -ml-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all w-full"
                                        >
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-400">Previous</span>
                                            <span className="text-sm font-semibold text-slate-300 group-hover:text-white flex items-center gap-2">
                                                ← {sections[activeIndex - 1].title}
                                            </span>
                                        </button>
                                    ) : <div />}
                                </div>
                                <div className="flex-1">
                                    {activeIndex < sections.length - 1 ? (
                                        <button
                                            onClick={() => handleNav(sections[activeIndex + 1].id)}
                                            className="group flex flex-col items-end gap-1 p-4 -mr-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all w-full"
                                        >
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-400">Next Step</span>
                                            <span className="text-sm font-semibold text-slate-300 group-hover:text-sky-400 flex items-center gap-2">
                                                {sections[activeIndex + 1].title} →
                                            </span>
                                        </button>
                                    ) : <div />}
                                </div>
                            </div>

                        </div>
                    </div>
                </main>

            </div>
        </div>
    );
}
