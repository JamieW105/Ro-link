'use client';

import { Pencil as LucidePencil, Plus as LucidePlus, Trash2 as LucideTrash2 } from 'lucide-react';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface JobApplication {
    id: string;
    title: string;
    description: string;
    requirements: string;
    tags: string[];
    status: 'OPEN' | 'CLOSED';
    created_at: string;
    _count?: {
        submissions: number;
    }
}

export default function ManageJobs() {
    const [jobs, setJobs] = useState<JobApplication[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/management/jobs')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setJobs(data);
                } else {
                    setJobs([]);
                }
                setLoading(false);
            })
            .catch(() => {
                setJobs([]);
                setLoading(false);
            });
    }, []);

    const toggleStatus = async (job: JobApplication) => {
        const newStatus = job.status === 'OPEN' ? 'CLOSED' : 'OPEN';
        try {
            const res = await fetch(`/api/management/jobs/${job.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
            }
        } catch (err) {
            alert("Error updating status");
        }
    };

    const deleteJob = async (id: string) => {
        if (!confirm("Are you sure? This will delete all submissions as well.")) return;
        try {
            const res = await fetch(`/api/management/jobs/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setJobs(prev => prev.filter(j => j.id !== id));
            }
        } catch (err) {
            alert("Error deleting job");
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Job Applications</h1>
                    <p className="text-slate-400 mt-1">Create and manage recruitment for Ro-Link.</p>
                </div>
                <Link
                    href="/management/jobs/new"
                    className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-sky-900/20 flex items-center gap-2 w-fit"
                >
                    <LucidePlus className="w-4 h-4" />
                    New Application
                </Link>
            </header>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {jobs.length === 0 ? (
                        <div className="col-span-full py-20 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500">
                            <p>No job applications created yet.</p>
                            <Link href="/management/jobs/new" className="text-sky-400 font-bold mt-2 hover:underline">Create your first one</Link>
                        </div>
                    ) : (
                        jobs.map(job => (
                            <div key={job.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col group hover:border-slate-700 transition-all">
                                <div className="flex items-start justify-between mb-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${job.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                                        }`}>
                                        {job.status}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Link href={`/management/jobs/${job.id}/edit`} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                            <LucidePencil className="w-4 h-4" />
                                        </Link>
                                        <button onClick={() => deleteJob(job.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                                            <LucideTrash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{job.title}</h3>
                                <p className="text-slate-400 text-sm line-clamp-2 mb-6 flex-1">{job.description}</p>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {(job.tags || []).map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-slate-800/50 text-slate-400 text-[10px] font-bold rounded border border-slate-800">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-auto">
                                    <Link href={`/management/jobs/${job.id}/submissions`} className="text-sky-400 hover:text-sky-300 text-xs font-bold flex items-center gap-1">
                                        View Submissions
                                        <span className="bg-sky-500/10 px-1.5 py-0.5 rounded text-[10px] ml-1">{job._count?.submissions || 0}</span>
                                    </Link>
                                    <button
                                        onClick={() => toggleStatus(job)}
                                        className={`text-xs font-bold ${job.status === 'OPEN' ? 'text-orange-400 hover:text-orange-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                                    >
                                        {job.status === 'OPEN' ? 'Close App' : 'Open App'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
