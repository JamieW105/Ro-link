'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Question {
    id: string;
    type: 'short_answer' | 'long_answer' | 'multi_choice' | 'checkbox' | 'section';
    label: string;
    description?: string;
    required: boolean;
    options?: string[]; // for multi_choice
}

export default function NewJobApplication() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [requirements, setRequirements] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [processing, setProcessing] = useState(false);

    const addQuestion = (type: Question['type']) => {
        const newQ: Question = {
            id: Math.random().toString(36).substring(7),
            type,
            label: "",
            required: true,
            options: type === 'multi_choice' ? ["Option 1"] : undefined
        };
        setQuestions([...questions, newQ]);
    };

    const updateQuestion = (id: string, updates: Partial<Question>) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const addOption = (qId: string) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] };
            }
            return q;
        }));
    };

    const updateOption = (qId: string, index: number, val: string) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                const nextOptions = [...(q.options || [])];
                nextOptions[index] = val;
                return { ...q, options: nextOptions };
            }
            return q;
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;
        setProcessing(true);
        try {
            const res = await fetch('/api/management/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, requirements, tags, questions })
            });
            if (res.ok) {
                router.push('/management/jobs');
            }
        } catch (err) {
            alert("Error creating job");
        } finally {
            setProcessing(false);
        }
    };

    const toggleTag = (tag: string) => {
        setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <header className="mb-12">
                <Link href="/management/jobs" className="text-slate-500 hover:text-white text-sm font-medium flex items-center gap-2 mb-4 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Jobs
                </Link>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Create Job Application</h1>
                <p className="text-slate-400 mt-2 text-lg">Design the perfect recruitment form for your next team member.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-10">
                {/* Basic Info */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-white">Application Details</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Position Title</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-sky-500"
                                placeholder="e.g. Senior Developer"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Description</label>
                                <textarea
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-sky-500 h-32 resize-none"
                                    placeholder="Describe the role..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Requirements</label>
                                <textarea
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-sky-500 h-32 resize-none"
                                    placeholder="What are you looking for?"
                                    value={requirements}
                                    onChange={(e) => setRequirements(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Tags</label>
                            <div className="flex flex-wrap gap-2">
                                {['Developer', 'Support', 'Moderation', 'Marketing'].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${tags.includes(tag)
                                                ? 'bg-sky-600 border-sky-500 text-white'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Questions Builder */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            Form Questions
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {questions.map((q, idx) => (
                            <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative group transition-all hover:border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => removeQuestion(q.id)}
                                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>

                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Q{idx + 1} - {q.type.replace(/_/g, ' ')}</span>
                                </div>

                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-semibold focus:outline-none focus:border-sky-500"
                                        placeholder={q.type === 'section' ? "Section Title" : "Question Label"}
                                        value={q.label}
                                        onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                                        required
                                    />

                                    {q.type !== 'section' && (
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-sky-600 focus:ring-sky-600"
                                                    checked={q.required}
                                                    onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                                                />
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Required</span>
                                            </label>
                                        </div>
                                    )}

                                    {q.type === 'multi_choice' && (
                                        <div className="space-y-2 mt-4 pl-4 border-l-2 border-slate-800">
                                            {q.options?.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full border border-slate-700"></div>
                                                    <input
                                                        type="text"
                                                        className="flex-1 bg-transparent border-b border-transparent hover:border-slate-800 focus:border-sky-500 text-sm text-slate-300 py-1 transition-all outline-none"
                                                        value={opt}
                                                        onChange={(e) => updateOption(q.id, oIdx, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => addOption(q.id)}
                                                className="text-sky-400 text-xs font-bold hover:underline py-2"
                                            >
                                                + Add Option
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-8">
                            {[
                                { id: 'short_answer', label: 'Short Text', icon: 'M4 6h16M4 12h10M4 18h7' },
                                { id: 'long_answer', label: 'Long Text', icon: 'M4 12h16M4 6h16M4 18h16' },
                                { id: 'multi_choice', label: 'Multiple Choice', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                                { id: 'checkbox', label: 'Checkbox', icon: 'M5 13l4 4L19 7' },
                                { id: 'section', label: 'Section Header', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                            ].map(type => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => addQuestion(type.id as any)}
                                    className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group"
                                >
                                    <svg className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={type.icon} /></svg>
                                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-white uppercase tracking-widest text-center">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="pt-8 border-t border-slate-800 flex items-center justify-end gap-4">
                    <Link href="/management/jobs" className="px-6 py-3 text-slate-400 font-bold hover:text-white transition-colors">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={processing || !title}
                        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-10 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-sky-900/40"
                    >
                        {processing ? "Saving..." : "Create Application"}
                    </button>
                </div>
            </form>
        </div>
    );
}
