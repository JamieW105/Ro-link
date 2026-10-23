'use client';

import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

import { Checkbox } from '@/components/ui/checkbox';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { ChangeEvent, FormEvent, useState } from 'react';

import { LuauCodeEditor } from '@/components/dashboard/LuauSyntax';

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

            router.push('/dashboard/creator/modules');
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Failed to submit module.');
        } finally {
            setSaving(false);
        }
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-2xl font-medium mb-2 tracking-tight">Sign in required</h1>
                <p className="text-muted-foreground mb-8 max-w-sm text-sm">Authenticate with Discord before submitting a marketplace module.</p>
                <Button variant="default" size="default"
                    onClick={() => signIn('discord')}
                    className="transition-all"
                >
                    Sign In with Discord
                </Button>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background text-foreground">
            <form onSubmit={submitModule} className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-8 md:py-10">
                <header className="mb-8 space-y-5 border-b border-border pb-6">
                    <div className="flex items-start justify-between gap-4">
                        <nav aria-label="Module navigation" className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <Link href="/dashboard/marketplace" className="text-xs font-medium text-foreground hover:text-foreground">
                                Back to Marketplace
                            </Link>
                            <Link href="/dashboard/creator/modules" className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-700">
                                Creator Dashboard
                            </Link>
                        </nav>
                        <ThemeToggle />
                    </div>
                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">Create Module</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                                Submit a Luau module for moderation. You can install and use your own module while it waits for review.
                            </p>
                        </div>
                        <Button variant="default" size="default"
                            type="submit"
                            disabled={saving}
                            className="shrink-0 self-start transition-colors disabled:opacity-50 md:self-auto"
                        >
                            {saving ? 'Submitting' : 'Submit for Moderation'}
                        </Button>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted-foreground">Name</label>
                            <Input
                                value={form.name}
                                onChange={(event) => updateForm('name', event.target.value)}
                                required
                                className="w-full transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-xs font-medium text-muted-foreground">Slug</label>
                                <Input
                                    value={form.slug}
                                    onChange={(event) => updateForm('slug', event.target.value)}
                                    placeholder="auto"
                                    className="w-full transition-colors"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-muted-foreground">Version</label>
                                <Input
                                    value={form.version}
                                    onChange={(event) => updateForm('version', event.target.value)}
                                    className="w-full transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted-foreground">Category</label>
                            <Input
                                value={form.category}
                                onChange={(event) => updateForm('category', event.target.value)}
                                className="w-full transition-colors"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted-foreground">Description</label>
                            <Textarea
                                value={form.description}
                                onChange={(event) => updateForm('description', event.target.value)}
                                required
                                className="w-full resize-none transition-colors"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted-foreground">Upload Source</label>
                            <Input
                                type="file"
                                accept=".lua,.luau,.txt"
                                onChange={handleFileUpload}
                                className="w-full file:mr-4"
                            />
                        </div>

                        <div className="space-y-3 border-t border-border pt-4">
                            <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground">
                                <Checkbox
                                    checked={acceptedCreatorTerms}
                                    onCheckedChange={(checked) => setAcceptedCreatorTerms(checked === true)}
                                    className="mt-1 w-4 accent-muted-foreground"
                                />
                                <span>I agree to the <Link href="/terms/modules/create" className="text-foreground hover:text-foreground">module creator terms</Link>.</span>
                            </label>
                            <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground">
                                <Checkbox
                                    checked={acceptedUseTerms}
                                    onCheckedChange={(checked) => setAcceptedUseTerms(checked === true)}
                                    className="mt-1 w-4 accent-muted-foreground"
                                />
                                <span>I understand the <Link href="/terms/modules/use" className="text-foreground hover:text-foreground">module use and UGC terms</Link>.</span>
                            </label>
                        </div>
                    </section>

                    <section className="flex min-h-[620px] flex-col rounded-xl border border-border bg-card p-6">
                        <label className="mb-2 block text-xs font-medium text-muted-foreground">Source Code</label>
                        <LuauCodeEditor
                            value={form.sourceCode}
                            onChange={(event) => updateForm('sourceCode', event.target.value)}
                            required
                            minHeightClassName="min-h-[540px]"
                        />
                    </section>
                </div>
            </form>
        </main>
    );
}
