'use client';

import Link from 'next/link';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { FormEvent, useMemo, useState } from 'react';

type TargetKind = 'user' | 'server' | 'game';
type UserPlatform = 'roblox' | 'discord';

type SubmitResult = {
    reportId?: string;
    threadId?: string;
    threadUrl?: string;
    error?: string;
};

const targetOptions: Array<{ value: TargetKind; label: string; description: string }> = [
    { value: 'user', label: 'User', description: 'Roblox or Discord account' },
    { value: 'server', label: 'Server', description: 'Discord server' },
    { value: 'game', label: 'Game', description: 'Roblox experience' },
];

function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

function ShieldIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}

function SendIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m20 6-11 11-5-5" />
        </svg>
    );
}

function DiscordIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.076.076 0 0 0-.041.107a14.314 14.314 0 0 0 1.226 1.994a.075.075 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.175 1.086 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z" />
        </svg>
    );
}

export default function ReportPage() {
    const { data: session, status } = useSession();
    const [targetKind, setTargetKind] = useState<TargetKind>('user');
    const [userPlatform, setUserPlatform] = useState<UserPlatform>('roblox');
    const [targetId, setTargetId] = useState('');
    const [reason, setReason] = useState('');
    const [evidenceLinks, setEvidenceLinks] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);

    const targetLabel = useMemo(() => {
        if (targetKind === 'game') return 'Roblox game ID';
        if (targetKind === 'server') return 'Discord server ID';
        return userPlatform === 'roblox' ? 'Roblox user ID' : 'Discord user ID';
    }, [targetKind, userPlatform]);

    const targetPlaceholder = useMemo(() => {
        if (targetKind === 'game') return '1234567890';
        if (targetKind === 'server') return '123456789012345678';
        return userPlatform === 'roblox' ? '123456789' : '123456789012345678';
    }, [targetKind, userPlatform]);
    const selectedTargetName = useMemo(() => {
        if (targetKind === 'game') return 'Roblox Game';
        if (targetKind === 'server') return 'Discord Server';
        return userPlatform === 'roblox' ? 'Roblox User' : 'Discord User';
    }, [targetKind, userPlatform]);
    const evidenceCount = useMemo(() => (
        evidenceLinks
            .split(/[\s,]+/g)
            .map((link) => link.trim())
            .filter(Boolean)
            .length
    ), [evidenceLinks]);

    const disabled = submitting || status === 'loading' || !session;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!session) {
            signIn('discord', { callbackUrl: '/report' });
            return;
        }

        setSubmitting(true);
        setResult(null);

        try {
            const response = await fetch('/api/public-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetKind,
                    userPlatform: targetKind === 'user' ? userPlatform : undefined,
                    targetId,
                    reason,
                    evidenceLinks,
                }),
            });
            const data = await response.json().catch(() => ({})) as SubmitResult;

            if (!response.ok) {
                setResult({ error: data.error || `Report submission failed (${response.status}).` });
                return;
            }

            setResult(data);
            setTargetId('');
            setReason('');
            setEvidenceLinks('');
        } catch {
            setResult({ error: 'Report submission failed.' });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-sky-500/30">
            <header className="border-b border-slate-800 bg-[#020617]/90 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-3">
                        <Image src="/Media/Ro-LinkIcon.png" alt="Ro-Link" width={32} height={32} className="rounded-lg object-contain" />
                        <span className="text-lg font-bold text-white">Ro-Link</span>
                    </Link>
                    <nav className="hidden items-center gap-5 md:flex">
                        <Link href="/posts" className="text-sm font-semibold text-slate-400 transition-colors hover:text-white">Updates</Link>
                        <Link href="/docs" className="text-sm font-semibold text-slate-400 transition-colors hover:text-white">Docs</Link>
                        <Link href="/careers" className="text-sm font-semibold text-slate-400 transition-colors hover:text-white">Careers</Link>
                        <Link href="/report" className="text-sm font-semibold text-sky-300">Report</Link>
                        {session ? (
                            <Link href="/dashboard" className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-500">Dashboard</Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => signIn('discord', { callbackUrl: '/report' })}
                                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-500"
                            >
                                Sign In
                            </button>
                        )}
                    </nav>
                </div>
            </header>

            <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section className="rounded-lg border border-slate-800 bg-slate-950/70">
                    <div className="border-b border-slate-800 px-5 py-5 sm:px-7">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
                                <ShieldIcon />
                            </span>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Public Report</p>
                                <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Report a risky user, server, or game</h1>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-7">
                        <div>
                            <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Target</label>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {targetOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setTargetKind(option.value)}
                                        className={cn(
                                            'rounded-lg border px-4 py-3 text-left transition',
                                            targetKind === option.value
                                                ? 'border-sky-400/40 bg-sky-500/10 text-white'
                                                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white',
                                        )}
                                    >
                                        <span className="block text-sm font-bold">{option.label}</span>
                                        <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {targetKind === 'user' && (
                            <div>
                                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">User Platform</label>
                                <div className="grid max-w-md grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950 p-1">
                                    {(['roblox', 'discord'] as UserPlatform[]).map((platform) => (
                                        <button
                                            key={platform}
                                            type="button"
                                            onClick={() => setUserPlatform(platform)}
                                            className={cn(
                                                'rounded-md px-4 py-2 text-sm font-bold capitalize transition',
                                                userPlatform === platform
                                                    ? 'bg-sky-600 text-white'
                                                    : 'text-slate-500 hover:text-slate-200',
                                            )}
                                        >
                                            {platform}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="target-id" className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                {targetLabel}
                            </label>
                            <input
                                id="target-id"
                                type="text"
                                inputMode="numeric"
                                value={targetId}
                                onChange={(event) => setTargetId(event.target.value)}
                                placeholder={targetPlaceholder}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-sky-500"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="reason" className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Reason</label>
                            <textarea
                                id="reason"
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="What happened, where it happened, and why staff should review it."
                                className="min-h-36 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="evidence" className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Evidence Links</label>
                            <textarea
                                id="evidence"
                                value={evidenceLinks}
                                onChange={(event) => setEvidenceLinks(event.target.value)}
                                placeholder="https://cdn.discordapp.com/attachments/..."
                                className="min-h-28 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500"
                                required
                            />
                        </div>

                        {result?.error && (
                            <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
                                {result.error}
                            </div>
                        )}

                        {result?.reportId && !result.error && (
                            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                <div className="flex items-start gap-2">
                                    <CheckIcon />
                                    <div className="min-w-0">
                                        <p className="font-bold">Report submitted</p>
                                        <p className="mt-1 break-all font-mono text-xs text-emerald-200">{result.reportId}</p>
                                        {result.threadUrl && (
                                            <a href={result.threadUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold uppercase tracking-wider text-emerald-200 hover:text-white">
                                                Open Forum Thread
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-500">
                                {session ? `Signed in as ${session.user?.name || 'Discord user'}` : 'Discord sign-in is required.'}
                            </p>
                            {session ? (
                                <button
                                    type="submit"
                                    disabled={disabled || !targetId.trim() || !reason.trim() || !evidenceLinks.trim()}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <SendIcon />
                                    {submitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => signIn('discord', { callbackUrl: '/report' })}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-5 text-sm font-bold text-white transition hover:bg-[#4752C4]"
                                >
                                    <DiscordIcon />
                                    Sign In With Discord
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                <aside className="space-y-4">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Submission</p>
                        <div className="mt-4 space-y-4 text-sm">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Type</p>
                                <p className="mt-1 font-semibold text-white">{selectedTargetName}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Target ID</p>
                                <p className="mt-1 break-all font-mono text-slate-300">{targetId || 'Pending'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Evidence</p>
                                <p className="mt-1 font-semibold text-slate-300">{evidenceCount} link{evidenceCount === 1 ? '' : 's'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Reporter</p>
                                <p className="mt-1 break-words font-semibold text-slate-300">{session?.user?.name || 'Not signed in'}</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
