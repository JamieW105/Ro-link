'use client';

import { ArrowRight as LucideArrowRight } from 'lucide-react';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Job {
    id: string;
    title: string;
    description: string;
    requirements: string;
    tags: string[];
    status: 'OPEN' | 'CLOSED';
    created_at: string;
}

export default function CareersPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTag, setActiveTag] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/careers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setJobs(data);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filtered = Array.isArray(jobs) ? jobs.filter(j => {
        const title = j.title || "";
        const description = j.description || "";
        const query = (search || "").toLowerCase();

        const matchesSearch = title.toLowerCase().includes(query) ||
            description.toLowerCase().includes(query);
        const matchesTag = !activeTag || (j.tags && j.tags.includes(activeTag));
        return matchesSearch && matchesTag;
    }) : [];

    const tags = ['Developer', 'Support', 'Moderation', 'Marketing'];

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200">
            {/* Hero */}
            <header className="motion-page py-20 px-6 max-w-7xl mx-auto">
                <div className="max-w-3xl">
                    <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
                        Build the future of <span className="text-sky-500">Ro-Link.</span>
                    </h1>
                    <p className="text-slate-400 text-lg md:text-xl leading-relaxed">
                        Join our mission to bridge the gap between Discord and Roblox. We&apos;re looking for passionate individuals to help us build and moderate the ultimate management platform.
                    </p>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-6 pb-32">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Filters Sidebar */}
                    <aside className="w-full md:w-64 space-y-8 sticky top-28">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Search Positions</label>
                            <input
                                type="text"
                                placeholder="Search roles..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Filter by Tag</label>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setActiveTag(null)}
                                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all ${!activeTag ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    All Positions
                                </button>
                                {tags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setActiveTag(tag)}
                                        className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTag === tag ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Jobs List */}
                    <div className="motion-list flex-1 space-y-6">
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-500">
                                <div className="w-10 h-10 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                                <p className="font-medium">Loading opportunities...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="py-20 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
                                <p className="text-slate-500 font-medium">No open positions matching your criteria.</p>
                            </div>
                        ) : (
                            filtered.map(job => (
                                <Link
                                    key={job.id}
                                    href={`/careers/${job.id}`}
                                    className="interactive-lift subtle-glow block bg-slate-900/40 border border-slate-800 p-8 rounded-3xl group hover:border-sky-500/30 hover:bg-slate-900/60 transition-all relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-8">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-600 group-hover:bg-sky-600 group-hover:text-white transition-all">
                                            <LucideArrowRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {(job.tags || []).map(tag => (
                                            <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded border border-slate-700">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-sky-400 transition-colors">{job.title}</h2>
                                    <p className="text-slate-400 text-sm max-w-2xl line-clamp-2 leading-relaxed">{job.description}</p>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
