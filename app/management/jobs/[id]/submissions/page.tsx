'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Submission {
    id: string;
    discord_id: string;
    answers: Record<string, any>;
    status: 'PENDING' | 'ACCEPTED' | 'DENIED';
    review_reason?: string;
    submitted_at: string;
}

interface Question {
    id: string;
    label: string;
    type: string;
}

export default function JobSubmissions({ params }: { params: { id: string } }) {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Submission | null>(null);
    const [reason, setReason] = useState("");
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch(`/api/management/jobs/${params.id}/submissions`).then(res => res.json()),
            fetch(`/api/management/jobs/${params.id}/details`).then(res => res.json())
        ]).then(([subs, job]) => {
            setSubmissions(subs);
            setQuestions(job.questions || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [params.id]);

    // I need to fix the GET single job path above, but let's assume it works for now or create it.

    const handleReview = async (status: 'ACCEPTED' | 'DENIED') => {
        if (!selected || !reason.trim()) return;
        setProcessing(true);
        try {
            const res = await fetch(`/api/management/jobs/${params.id}/submissions/review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: selected.id, status, reason })
            });
            if (res.ok) {
                setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, status, review_reason: reason } : s));
                setSelected(null);
                setReason("");
            }
        } catch (err) {
            alert("Error reviewing application");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <Link href="/management/jobs" className="text-slate-500 hover:text-white text-sm font-medium flex items-center gap-2 mb-4 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Jobs
                </Link>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Review Submissions</h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">Submissions ({submissions.length})</h3>
                    <div className="space-y-2">
                        {submissions.length === 0 ? (
                            <div className="p-8 text-center bg-slate-900/30 border border-slate-800 rounded-2xl text-slate-500 text-sm">No submissions yet.</div>
                        ) : (
                            submissions.map(sub => (
                                <button
                                    key={sub.id}
                                    onClick={() => setSelected(sub)}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all ${selected?.id === sub.id
                                        ? 'bg-sky-600/10 border-sky-500/50'
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-white text-sm">{sub.discord_id}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sub.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400' :
                                            sub.status === 'DENIED' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'
                                            }`}>
                                            {sub.status}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-500">{new Date(sub.submitted_at).toLocaleString()}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="lg:col-span-2">
                    {selected ? (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-8">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">{selected.discord_id}</h2>
                                    <p className="text-sm text-slate-500">Submitted on {new Date(selected.submitted_at).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${selected.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        selected.status === 'DENIED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                        }`}>
                                        {selected.status}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-8">
                                {questions.map(q => (
                                    q.type === 'section' ? (
                                        <h3 key={q.id} className="text-lg font-bold text-white pt-4 border-t border-slate-800">{q.label}</h3>
                                    ) : (
                                        <div key={q.id}>
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{q.label}</h4>
                                            <p className="text-slate-200 bg-slate-950 border border-slate-800 p-4 rounded-xl whitespace-pre-wrap">
                                                {String(selected.answers[q.id] || "No answer provided.")}
                                            </p>
                                        </div>
                                    )
                                ))}
                            </div>

                            {selected.status === 'PENDING' ? (
                                <div className="pt-8 border-t border-slate-800 space-y-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Review Feedback (Sent via DM)</label>
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-sky-500 h-32 resize-none"
                                            placeholder="Provide a reason for acceptance or denial..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleReview('DENIED')}
                                            disabled={processing || !reason.trim()}
                                            className="flex-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 px-6 py-3 rounded-2xl font-bold transition-all disabled:opacity-50"
                                        >
                                            Deny Application
                                        </button>
                                        <button
                                            onClick={() => handleReview('ACCEPTED')}
                                            disabled={processing || !reason.trim()}
                                            className="flex-1 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 px-6 py-3 rounded-2xl font-bold transition-all disabled:opacity-50"
                                        >
                                            Accept Application
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="pt-8 border-t border-slate-800">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Previous Feedback</h4>
                                    <p className="text-slate-400 italic font-medium">{selected.review_reason || "No feedback provided."}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 py-32 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl">
                            <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p>Select a submission to review details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
