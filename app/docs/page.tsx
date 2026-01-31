'use client';

import { useState } from 'react';

const BookOpenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);

const IdIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M15 8h2" /><path d="M15 12h2" /><path d="M7 16c0-1 1-2 2-2s2 1 2 2" /><path d="M15 16h2" /></svg>
);

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
);

const KeyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2a5 5 0 0 0-7 7l-9 9v3h3l9-9a5 5 0 0 0 7-7l2-2Z" /><path d="m15 5 4 4" /></svg>
);

export default function DocsPage() {
    const [page, setPage] = useState(1);

    const pages = [
        {
            id: 1,
            title: "Getting your Place ID",
            icon: <IdIcon />,
            content: (
                <div className="space-y-6">
                    <p className="text-slate-400">The **Place ID** is a unique identifier for a specific place within your Roblox experience. This is required to identify where the Ro-Link kernel is running.</p>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 bg-sky-500/10 text-sky-500 rounded flex items-center justify-center text-xs">1</span>
                            Via Browser URL
                        </h4>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-slate-300 ml-2">
                            <li>Open your game on the <span className="text-sky-400">Roblox Website</span>.</li>
                            <li>Look at the URL in your browser's address bar.</li>
                            <li>The number following <code className="bg-slate-800 px-2 py-0.5 rounded text-sky-500">/games/</code> is your Place ID.</li>
                        </ol>
                        <div className="mt-6 bg-black/40 p-4 rounded-lg border border-slate-800/50 font-mono text-xs">
                            <span className="text-slate-600">https://www.roblox.com/games/</span>
                            <span className="text-sky-500 font-bold underline decoration-sky-500/50 underline-offset-4">1234567890</span>
                            <span className="text-slate-600">/Your-Game-Name</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 2,
            title: "Getting your Universe ID",
            icon: <GlobeIcon />,
            content: (
                <div className="space-y-6">
                    <p className="text-slate-400">The **Universe ID** (also called Experience ID) is the global ID for your entire game. Open Cloud requires this to target the correct experience.</p>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 bg-sky-500/10 text-sky-500 rounded flex items-center justify-center text-xs">1</span>
                            Via Creator Dashboard
                        </h4>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-slate-300 ml-2">
                            <li>Go to the <span className="text-sky-400">Roblox Creator Dashboard</span>.</li>
                            <li>Select your **Experience**.</li>
                            <li>While on the "Overview" or "Dashboard" page, look at the URL.</li>
                            <li>The number following <code className="bg-slate-800 px-2 py-0.5 rounded text-sky-500">/experiences/</code> is your Universe ID.</li>
                        </ol>
                        <div className="mt-6 bg-black/40 p-4 rounded-lg border border-slate-800/50 font-mono text-xs">
                            <span className="text-slate-600">create.roblox.com/dashboard/creations/experiences/</span>
                            <span className="text-sky-500 font-bold underline decoration-sky-500/50 underline-offset-4">9876543210</span>
                            <span className="text-slate-600">/overview</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 3,
            title: "Creating an API Key",
            icon: <KeyIcon />,
            content: (
                <div className="space-y-6">
                    <p className="text-slate-400">To allow Ro-Link to communicate with your game servers, you need to create an **Open Cloud API Key** with the correct permissions.</p>
                    <div className="space-y-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">Step 1: Create Key</h4>
                            <ul className="space-y-3 text-sm text-slate-300 list-disc list-inside">
                                <li>Navigate to **Creator Dashboard {'>'} Credentials {'>'} API Keys**.</li>
                                <li>Click **Create API Key**.</li>
                                <li>Set a name (e.g., "Ro-Link Admin").</li>
                            </ul>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">Step 2: Add Permissions</h4>
                            <p className="text-xs text-slate-500 mb-4">Under the "API Permissions" section, add the following:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-3 bg-black/40 rounded-lg border border-slate-800">
                                    <span className="text-sky-500 text-xs font-bold block mb-1">Messaging Service</span>
                                    <span className="text-[10px] text-slate-500">Enable "Publish" access for your Universe ID.</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-lg border border-slate-800">
                                    <span className="text-sky-500 text-xs font-bold block mb-1">User API</span>
                                    <span className="text-[10px] text-slate-500">Enable "Read" access to fetch player details.</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-sky-600/10 border border-sky-500/20 p-4 rounded-xl">
                            <p className="text-xs text-sky-400 font-medium">
                                💡 **Tip:** Make sure to copy the key immediately after creation! Roblox will only show it to you once for security reasons.
                            </p>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-16">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-sky-600 rounded-xl shadow-lg shadow-sky-900/20">
                            <BookOpenIcon />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Documentation</h1>
                            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Setup Guide & Knowledge Base</p>
                        </div>
                    </div>
                    <a href="/" className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">Back to Home</a>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* Navigation Sidebar */}
                    <div className="lg:col-span-3">
                        <nav className="space-y-1 sticky top-12">
                            {pages.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setPage(p.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left font-semibold text-sm ${page === p.id
                                        ? "bg-sky-600/10 text-sky-400 border border-sky-500/20 shadow-sm"
                                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                                        }`}
                                >
                                    <span className={page === p.id ? "text-sky-400" : "text-slate-600"}>{p.icon}</span>
                                    {p.title}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content Area */}
                    <div className="lg:col-span-9 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 md:p-16 backdrop-blur-xl relative overflow-hidden">
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 blur-[80px] rounded-full -mr-20 -mt-20"></div>

                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold text-white mb-8 tracking-tight flex items-center gap-4">
                                    <span className="text-sky-600">{pages[page - 1].icon}</span>
                                    {pages[page - 1].title}
                                </h2>

                                <div className="prose prose-invert max-w-none">
                                    {pages[page - 1].content}
                                </div>

                                <div className="mt-16 pt-8 border-t border-slate-800 flex justify-between items-center">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-white disabled:opacity-0 transition-all"
                                    >
                                        ← Previous Step
                                    </button>
                                    <button
                                        disabled={page === 3}
                                        onClick={() => setPage(p => p + 1)}
                                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-500 hover:text-sky-400 disabled:opacity-0 transition-all"
                                    >
                                        Next Step →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
