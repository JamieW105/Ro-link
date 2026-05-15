'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { ChangeEvent, FormEvent, useState } from 'react';

interface ModuleForm {
    name: string;
    slug: string;
    description: string;
    version: string;
    category: string;
    sourceCode: string;
}

const emptyForm: ModuleForm = {
    name: '',
    slug: '',
    description: '',
    version: '1.0.0',
    category: 'General',
    sourceCode: '',
};

export default function CreateMarketplaceModulePage() {
    const router = useRouter();
    const { status } = useSession();
    const [form, setForm] = useState<ModuleForm>(emptyForm);
    const [acceptedCreatorTerms, setAcceptedCreatorTerms] = useState(false);
    const [acceptedUseTerms, setAcceptedUseTerms] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function updateForm<K extends keyof ModuleForm>(key: K, value: ModuleForm[K]) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        setForm((current) => ({
            ...current,
            name: current.name || file.name.replace(/\.(lua|luau|txt)$/i, ''),
            sourceCode: text,
        }));
    }

    async function submitModule(event: FormEvent) {
        event.preventDefault();
        if (!acceptedCreatorTerms || !acceptedUseTerms) {
            setError('You must accept both module terms before publishing a submission.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/dashboard/marketplace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to submit module.'));
            }

            router.push('/dashboard/marketplace');
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Failed to submit module.');
        } finally {
            setSaving(false);
        }
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-2xl font-bold mb-2 tracking-tight">Sign in required</h1>
                <p className="text-slate-400 mb-8 max-w-sm text-sm">Authenticate with Discord before submitting a marketplace module.</p>
                <button
                    onClick={() => signIn('discord')}
                    className="bg-sky-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-sky-500 transition-all text-sm"
                >
                    Sign In with Discord
                </button>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#020617] text-slate-200">
            <form onSubmit={submitModule} className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-8 md:py-10">
                <header className="mb-8 flex flex-col gap-5 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <Link href="/dashboard/marketplace" className="text-xs font-bold uppercase tracking-widest text-sky-300 hover:text-sky-200">
                            Back to Marketplace
                        </Link>
                        <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">Create Module</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                            Submit a Luau module for moderation. You can install and use your own module while it waits for review.
                        </p>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-sky-600 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                    >
                        {saving ? 'Submitting' : 'Submit for Moderation'}
                    </button>
                </header>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                        {error}
                    </div>
                )}

                <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Name</label>
                            <input
                                value={form.name}
                                onChange={(event) => updateForm('name', event.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</label>
                                <input
                                    value={form.slug}
                                    onChange={(event) => updateForm('slug', event.target.value)}
                                    placeholder="auto"
                                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Version</label>
                                <input
                                    value={form.version}
                                    onChange={(event) => updateForm('version', event.target.value)}
                                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</label>
                            <input
                                value={form.category}
                                onChange={(event) => updateForm('category', event.target.value)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(event) => updateForm('description', event.target.value)}
                                required
                                className="h-36 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-white outline-none transition-colors focus:border-sky-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Upload Source</label>
                            <input
                                type="file"
                                accept=".lua,.luau,.txt"
                                onChange={handleFileUpload}
                                className="w-full rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:border-sky-500"
                            />
                        </div>

                        <div className="space-y-3 border-t border-slate-800 pt-4">
                            <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={acceptedCreatorTerms}
                                    onChange={(event) => setAcceptedCreatorTerms(event.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                                />
                                <span>I agree to the <Link href="/terms/modules/create" className="text-sky-300 hover:text-sky-200">module creator terms</Link>.</span>
                            </label>
                            <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={acceptedUseTerms}
                                    onChange={(event) => setAcceptedUseTerms(event.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 accent-sky-500"
                                />
                                <span>I understand the <Link href="/terms/modules/use" className="text-sky-300 hover:text-sky-200">module use and UGC terms</Link>.</span>
                            </label>
                        </div>
                    </section>

                    <section className="flex min-h-[620px] flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Source Code</label>
                        <textarea
                            value={form.sourceCode}
                            onChange={(event) => updateForm('sourceCode', event.target.value)}
                            required
                            className="min-h-[540px] flex-1 resize-none rounded-xl border border-slate-800 bg-black/50 p-4 font-mono text-xs leading-relaxed text-slate-100 outline-none transition-colors focus:border-sky-500"
                            spellCheck={false}
                        />
                    </section>
                </div>
            </form>
        </main>
    );
}
