'use client';

import { Check, LockKeyhole, Send, ShieldAlert } from 'lucide-react';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { PublicFooter } from '@/components/public/PublicFooter';
import { DiscordIcon } from '@/components/ui/DiscordIcon';

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
    { value: 'server', label: 'Server', description: 'Discord community server' },
    { value: 'game', label: 'Game', description: 'Roblox experience' },
];

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
                if (!cancelled) setLinkedAccountLoading(false);
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

    const evidenceCount = useMemo(() => (
        evidenceLinks.split(/[\s,]+/g).map((link) => link.trim()).filter(Boolean).length
    ), [evidenceLinks]);

    const formVisible = Boolean(session?.user && linkedAccount?.roblox_id);
    const authLoading = status === 'loading' || (Boolean(session?.user) && linkedAccountLoading);
    const disabled = submitting || authLoading || !formVisible;

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
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="report-title">
                    <div className="rl-utility-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">Public reports</p>
                            <h1 className="rl-utility-title" id="report-title">Send the right details <span>to the right team.</span></h1>
                        </div>
                        <p className="rl-utility-intro">
                            Report a Roblox user, Discord server, or Roblox game. A verified Discord and linked Roblox account are required before submission.
                        </p>
                    </div>
                </section>

                <section className="rl-utility-main rl-shell">
                    <div className="rl-utility-grid">
                        <section className="rl-surface" aria-labelledby="new-report-title">
                            <div className="rl-surface-header">
                                <div>
                                    <h2 id="new-report-title">New report</h2>
                                    <p>Include enough context and direct evidence for staff review.</p>
                                </div>
                                <span className="rl-surface-icon"><ShieldAlert aria-hidden="true" /></span>
                            </div>

                            {!formVisible ? (
                                <div className="rl-surface-body">
                                    {authLoading ? (
                                        <div className="rl-notice">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                                            <div><strong>Checking verification</strong>Confirming your Discord and Roblox account connection.</div>
                                        </div>
                                    ) : !session ? (
                                        <div className="rl-notice">
                                            <DiscordIcon aria-hidden="true" width="16" height="16" />
                                            <div>
                                                <strong>Sign in to submit a report</strong>
                                                Public reports require a Discord sign-in before you can link and verify your Roblox account.
                                                <button className="rl-button rl-button-primary mt-4" type="button" onClick={handleDiscordSignIn}>Sign in with Discord</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rl-notice">
                                            <Image src="/Media/Roblox.png" alt="" width={16} height={16} />
                                            <div>
                                                <strong>Link your Roblox account</strong>
                                                Reports can only be submitted by verified Ro-Link users.
                                                <button className="rl-button rl-button-primary mt-4" type="button" onClick={handleRobloxLink} disabled={linkingRoblox}>
                                                    {linkingRoblox ? 'Opening Roblox…' : 'Link Roblox account'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <form className="rl-surface-body" onSubmit={handleSubmit}>
                                    <div className="rl-form-section">
                                        <span className="rl-field-label">Target type</span>
                                        <div className="rl-choice-row" role="group" aria-label="Report target type">
                                            {targetOptions.map((option) => (
                                                <button
                                                    className="rl-choice"
                                                    key={option.value}
                                                    type="button"
                                                    aria-pressed={targetKind === option.value}
                                                    onClick={() => setTargetKind(option.value)}
                                                >
                                                    <strong>{option.label}</strong>
                                                    <span>{option.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rl-form-section rl-field-row">
                                        <div>
                                            <label className="rl-field-label" htmlFor="report-platform">Platform</label>
                                            <select
                                                className="rl-select"
                                                id="report-platform"
                                                value={userPlatform}
                                                disabled={targetKind !== 'user'}
                                                onChange={(event) => setUserPlatform(event.target.value as UserPlatform)}
                                            >
                                                <option value="roblox">Roblox</option>
                                                <option value="discord">Discord</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="rl-field-label" htmlFor="report-target-id">{targetLabel}</label>
                                            <input
                                                className="rl-field"
                                                id="report-target-id"
                                                type="text"
                                                inputMode="numeric"
                                                value={targetId}
                                                onChange={(event) => setTargetId(event.target.value)}
                                                placeholder={targetPlaceholder}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="rl-form-section">
                                        <label className="rl-field-label" htmlFor="report-reason">What happened?</label>
                                        <textarea
                                            className="rl-textarea"
                                            id="report-reason"
                                            value={reason}
                                            onChange={(event) => setReason(event.target.value)}
                                            placeholder="Explain what happened, where it happened, and why staff should review it."
                                            required
                                        />
                                    </div>

                                    <div className="rl-form-section">
                                        <label className="rl-field-label" htmlFor="report-evidence">Evidence links</label>
                                        <textarea
                                            className="rl-textarea"
                                            id="report-evidence"
                                            value={evidenceLinks}
                                            onChange={(event) => setEvidenceLinks(event.target.value)}
                                            placeholder="Add direct image, video, or message links. Separate multiple links with spaces or new lines."
                                            required
                                        />
                                        <p className="rl-field-hint">Only include material relevant to this report.</p>
                                    </div>

                                    {result?.error && <div className="rl-feedback rl-feedback-error">{result.error}</div>}
                                    {result?.reportId && !result.error && (
                                        <div className="rl-feedback rl-feedback-success">
                                            <strong>Report submitted</strong>
                                            <div>{result.reportId}</div>
                                            {result.threadUrl && <a href={result.threadUrl} target="_blank" rel="noreferrer">Open forum thread</a>}
                                        </div>
                                    )}

                                    <div className="rl-form-footer">
                                        <p>
                                            Signed in as {session?.user?.name || 'Discord user'} · {evidenceCount} evidence link{evidenceCount === 1 ? '' : 's'}
                                        </p>
                                        <button
                                            className="rl-button rl-button-primary"
                                            type="submit"
                                            disabled={disabled || !targetId.trim() || !reason.trim() || !evidenceLinks.trim()}
                                        >
                                            <Send aria-hidden="true" width={14} height={14} />
                                            {submitting ? 'Submitting…' : 'Submit report'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </section>

                        <aside className="rl-aside-stack">
                            <div className="rl-surface rl-aside-panel">
                                <h2>Before submitting</h2>
                                <ul className="rl-aside-list">
                                    <li><Check aria-hidden="true" /><span>Sign in with Discord.</span></li>
                                    <li><Check aria-hidden="true" /><span>Link your Roblox account.</span></li>
                                    <li><Check aria-hidden="true" /><span>Use direct evidence links.</span></li>
                                </ul>
                            </div>
                            <div className="rl-notice">
                                <LockKeyhole aria-hidden="true" />
                                <div><strong>Verified submissions</strong>Reports are accepted only from users with both accounts connected.</div>
                            </div>
                        </aside>
                    </div>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
