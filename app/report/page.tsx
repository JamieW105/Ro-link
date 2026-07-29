'use client';

import { Check as LucideCheck, Send as LucideSend, Shield as LucideShield } from 'lucide-react';

import Link from 'next/link';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DiscordIcon as DiscordBrandIcon } from '@/components/ui/DiscordIcon';

type TargetKind = 'user' | 'server' | 'game';
type UserPlatform = 'roblox' | 'discord';

type SubmitResult = {
    reportId?: string;
    threadId?: string;
    threadUrl?: string;
    error?: string;
};

type LinkedAccount = {
    roblox_id: string | number;
    roblox_username: string | null;
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
        <LucideShield aria-hidden="true" className="h-5 w-5" strokeWidth="2" />
    );
}

function SendIcon() {
    return (
        <LucideSend aria-hidden="true" className="h-4 w-4" strokeWidth="2" />
    );
}

function CheckIcon() {
    return (
        <LucideCheck aria-hidden="true" className="h-4 w-4" strokeWidth="2.3" />
    );
}

function DiscordIcon() {
    return (
        <DiscordBrandIcon aria-hidden="true" className="h-4 w-4" />
    );
}

function RobloxIcon() {
    return (
        <Image src="/Media/Roblox.png" alt="" width={18} height={18} className="h-4 w-4 object-contain" />
    );
}

export default function ReportPage() {
    const { data: session, status } = useSession();
    const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
    const [linkedAccountLoading, setLinkedAccountLoading] = useState(true);
    const [linkingRoblox, setLinkingRoblox] = useState(false);
    const [targetKind, setTargetKind] = useState<TargetKind>('user');
    const [userPlatform, setUserPlatform] = useState<UserPlatform>('roblox');
    const [targetId, setTargetId] = useState('');
    const [reason, setReason] = useState('');
    const [evidenceLinks, setEvidenceLinks] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadLinkedAccount() {
            setLinkedAccountLoading(true);
            setLinkedAccount(null);

            try {
                const response = await fetch('/api/verify/linked-account', { cache: 'no-store' });
                if (cancelled) return;

                if (response.ok) {
                    const data = await response.json() as LinkedAccount | null;
                    setLinkedAccount(data?.roblox_id ? data : null);
                }
            } finally {
                if (!cancelled) {
                    setLinkedAccountLoading(false);
                }
            }
        }

        if (session?.user) {
            loadLinkedAccount();
        } else if (status !== 'loading') {
            setLinkedAccount(null);
            setLinkedAccountLoading(false);
        }

        return () => {
            cancelled = true;
        };
    }, [session?.user, status]);

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

    const formVisible = Boolean(session?.user && linkedAccount?.roblox_id);
    const authLoading = status === 'loading' || (Boolean(session?.user) && linkedAccountLoading);
    const disabled = submitting || authLoading || !formVisible;
    const linkedRobloxUsername = formVisible ? linkedAccount?.roblox_username : null;

    function handleDiscordSignIn() {
        signIn('discord', { callbackUrl: '/report' });
    }

    function handleRobloxLink() {
        setLinkingRoblox(true);
        window.location.href = '/api/roblox/auth?returnTo=/report';
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!session) {
            handleDiscordSignIn();
            return;
        }

        if (!linkedAccount?.roblox_id) {
            setResult({ error: 'Link your Roblox account before submitting a report.' });
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
                                onClick={handleDiscordSignIn}
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

                    {!formVisible ? (
                        <div className="space-y-5 p-5 sm:p-7">
                            {authLoading ? (
                                <div className="rounded-lg border border-slate-800 bg-slate-950 px-5 py-8 text-center">
                                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                                    <p className="mt-4 text-sm font-semibold text-slate-300">Checking your account verification...</p>
                                </div>
                            ) : !session ? (
                                <div className="rounded-lg border border-slate-800 bg-slate-950 px-5 py-6">
                                    <div className="flex items-start gap-4">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#5865F2]/25 bg-[#5865F2]/10 text-[#AAB2FF]">
                                            <DiscordIcon />
                                        </span>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold text-white">Sign in to submit a report</h2>
                                            <p className="mt-2 text-sm leading-6 text-slate-400">
                                                Public reports require a Discord sign-in before you can link and verify your Roblox account.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDiscordSignIn}
                                        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-5 text-sm font-bold text-white transition hover:bg-[#4752C4] sm:w-auto"
                                    >
                                        <DiscordIcon />
                                        Sign In With Discord
                                    </button>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-slate-800 bg-slate-950 px-5 py-6">
                                    <div className="flex items-start gap-4">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white text-black">
                                            <RobloxIcon />
                                        </span>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold text-white">Link your Roblox account</h2>
                                            <p className="mt-2 text-sm leading-6 text-slate-400">
                                                Reports can only be submitted from verified Ro-Link users. Link your Roblox account here, then the report form will unlock automatically.
                                            </p>
                                            <p className="mt-3 text-xs font-semibold text-slate-500">
                                                Signed in as {session.user?.name || 'Discord user'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRobloxLink}
                                        disabled={linkingRoblox}
                                        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-black uppercase tracking-wider text-black transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                                    >
                                        {linkingRoblox ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                                        ) : (
                                            <RobloxIcon />
                                        )}
                                        {linkingRoblox ? 'Opening Roblox...' : 'Link Roblox Account'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
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
                                {`Signed in as ${session?.user?.name || 'Discord user'} · Roblox linked${linkedRobloxUsername ? ` as ${linkedRobloxUsername}` : ''}`}
                            </p>
                            <button
                                type="submit"
                                disabled={disabled || !targetId.trim() || !reason.trim() || !evidenceLinks.trim()}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <SendIcon />
                                {submitting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                    )}
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
