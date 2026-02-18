'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';

interface Question {
    id: string;
    type: 'short_answer' | 'long_answer' | 'multi_choice' | 'checkbox' | 'section';
    label: string;
    required: boolean;
    options?: string[];
}

interface Job {
    id: string;
    title: string;
    description: string;
    requirements: string;
    questions: Question[];
    hasSubmitted?: boolean;
}

export default function ApplicationForm({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = use(paramsPromise);
    const { data: session, status } = useSession();
    const router = useRouter();
    const [job, setJob] = useState<Job | null>(null);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch(`/api/careers/${params.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) setError(data.error);
                else setJob(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [params.id]);

    const handleAnswer = (qId: string, val: any) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session) return signIn('discord');

        setSubmitting(true);
        try {
            const res = await fetch(`/api/careers/${params.id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Application submitted successfully! Check your Discord DMs for confirmation.");
                router.push('/careers');
            } else {
                alert(data.error || "Failed to submit application.");
            }
        } catch (err) {
            alert("Error submitting application.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (error || !job) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white">
            <h1 className="text-2xl font-bold mb-4">{error || "Application not found"}</h1>
            <Link href="/careers" className="text-sky-400 hover:underline">Back to Careers</Link>
        </div>
    );

    if (job.hasSubmitted) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white px-6">
            <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl max-w-lg text-center shadow-2xl">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h1 className="text-3xl font-bold mb-2">Already Submitted</h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
                    You have already submitted an application for the <span className="text-white font-bold">{job.title}</span> position.
                    Please wait for our team to review your request.
                </p>
                <Link href="/careers" className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-3 rounded-xl font-bold transition-all inline-block">
                    Return to Careers
                </Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 pb-32">
            <nav className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/careers" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back
                    </Link>
                    <div className="flex flex-col items-end">
                        <span className="font-bold text-white truncate max-w-[200px]">{job.title}</span>
                        {session?.user && (
                            <span className="text-[10px] text-slate-500 font-medium">Submitting an application for {session.user.name}</span>
                        )}
                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-6 mt-12">
                <header className="mb-12 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-10 rounded-3xl shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-4xl font-extrabold text-white tracking-tight">{job.title}</h1>
                        <div className="bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-sky-500/20">Now Hiring</div>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Position Description</h3>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                        </div>
                        {job.requirements && (
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Expectations & Requirements</h3>
                                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{job.requirements}</p>
                            </div>
                        )}
                    </div>
                </header>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {job.questions.map((q, idx) => (
                        <div key={q.id} className={q.type === 'section' ? "pt-8 mb-4 border-t border-slate-800" : "bg-slate-900/40 border border-slate-800 rounded-2xl p-8"}>
                            {q.type === 'section' ? (
                                <h2 className="text-xl font-bold text-white">{q.label}</h2>
                            ) : (
                                <>
                                    <label className="block text-lg font-bold text-white mb-2">
                                        {q.label}
                                        {q.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>

                                    {q.type === 'short_answer' && (
                                        <input
                                            type="text"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-all"
                                            required={q.required}
                                            value={answers[q.id] || ""}
                                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                                        />
                                    )}

                                    {q.type === 'long_answer' && (
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:border-sky-500 h-40 resize-none transition-all"
                                            required={q.required}
                                            value={answers[q.id] || ""}
                                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                                        />
                                    )}

                                    {q.type === 'multi_choice' && (
                                        <div className="space-y-3 mt-4">
                                            {q.options?.map(opt => (
                                                <label key={opt} className="flex items-center gap-3 p-4 bg-slate-950/50 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-600 transition-all">
                                                    <input
                                                        type="radio"
                                                        name={q.id}
                                                        className="w-4 h-4 text-sky-600 bg-slate-900 border-slate-800 focus:ring-sky-600"
                                                        required={q.required}
                                                        checked={answers[q.id] === opt}
                                                        onChange={() => handleAnswer(q.id, opt)}
                                                    />
                                                    <span className="text-slate-300 font-medium">{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {q.type === 'checkbox' && (
                                        <label className="flex items-center gap-3 p-4 bg-slate-950/50 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-600 transition-all mt-4">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-slate-800 bg-slate-900 text-sky-600 focus:ring-sky-600"
                                                required={q.required}
                                                checked={!!answers[q.id]}
                                                onChange={(e) => handleAnswer(q.id, e.target.checked)}
                                            />
                                            <span className="text-slate-300 font-medium">I agree to the above terms.</span>
                                        </label>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    <div className="pt-12 flex flex-col items-center gap-6">
                        {status === 'unauthenticated' ? (
                            <button
                                type="button"
                                onClick={() => signIn('discord')}
                                className="bg-sky-600 hover:bg-sky-500 text-white px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-sky-900/40 w-full"
                            >
                                Sign in with Discord to Submit
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-emerald-900/40 w-full"
                            >
                                {submitting ? "Submitting Application..." : "Submit Application"}
                            </button>
                        )}
                        <p className="text-slate-500 text-[10px] text-center max-w-md uppercase tracking-widest font-bold">
                            Submission logged for {session?.user?.name || "Guest"}
                        </p>
                    </div>
                </form>
            </main>
        </div>
    );
}
