'use client';

import { Check, ExternalLink, Gavel, LockKeyhole, Send, ShieldAlert } from 'lucide-react';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { PublicFooter } from '@/components/public/PublicFooter';
import { DiscordIcon } from '@/components/ui/DiscordIcon';

type TargetKind = 'user' | 'server' | 'game';
type UserPlatform = 'roblox' | 'discord';
type Workflow = 'report' | 'appeal';

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

type AppealOption = {
    key: string;
    targetLabel: string;
    reason: string;
    moderatedAt: string | null;
    originalForumUrl: string | null;
};

type AppealContext = {
    linked: boolean;
    identity: {
        discordId: string;
        discordName: string | null;
        robloxId: string;
        robloxUsername: string | null;
    };
    options: AppealOption[];
    error?: string;
};

type AppealResult = {
    appealId?: string;
    threadUrl?: string;
    error?: string;
};

const targetOptions: Array<{ value: TargetKind; label: string; description: string }> = [
    { value: 'user', label: 'User', description: 'Roblox or Discord account' },
    { value: 'server', label: 'Server', description: 'Discord community server' },
    { value: 'game', label: 'Game', description: 'Roblox experience' },
];

export default function ReportPage() {
    const { data: session, status } = useSession();
    const [workflow, setWorkflow] = useState<Workflow>('report');
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
    const [appealContext, setAppealContext] = useState<AppealContext | null>(null);
    const [appealLoading, setAppealLoading] = useState(true);
    const [moderationKey, setModerationKey] = useState('');
    const [appealReason, setAppealReason] = useState('');
    const [appealEvidence, setAppealEvidence] = useState('');
    const [appealSubmitting, setAppealSubmitting] = useState(false);
    const [appealResult, setAppealResult] = useState<AppealResult | null>(null);

    useEffect(() => {
        function syncWorkflowFromHash() {
            setWorkflow(window.location.hash.toLowerCase() === '#appeal' ? 'appeal' : 'report');
        }

        syncWorkflowFromHash();
        window.addEventListener('hashchange', syncWorkflowFromHash);
        return () => window.removeEventListener('hashchange', syncWorkflowFromHash);
    }, []);

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

    useEffect(() => {
        let cancelled = false;

        async function loadAppeals() {
            setAppealLoading(true);
            setAppealContext(null);
            try {
                const response = await fetch('/api/moderation-appeals', { cache: 'no-store' });
                const data = await response.json().catch(() => ({})) as AppealContext;
                if (cancelled) return;
                if (response.ok) {
                    setAppealContext(data);
                    setModerationKey((current) => (
                        data.options.some((option) => option.key === current)
                            ? current
                            : data.options[0]?.key || ''
                    ));
                } else {
                    setAppealContext({ ...data, linked: false, options: [], identity: data.identity || {
                        discordId: '',
                        discordName: null,
                        robloxId: '',
                        robloxUsername: null,
                    } });
                }
            } finally {
                if (!cancelled) setAppealLoading(false);
            }
        }

        if (session?.user) {
            loadAppeals();
        } else if (status !== 'loading') {
            setAppealContext(null);
            setAppealLoading(false);
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

    function handleAppealSignIn() {
        signIn('discord', { callbackUrl: '/report#appeal' });
    }

    function handleAppealRobloxLink() {
        setLinkingRoblox(true);
        window.location.href = '/api/roblox/auth?returnTo=/report#appeal';
    }

    function selectWorkflow(nextWorkflow: Workflow) {
        setWorkflow(nextWorkflow);
        const nextUrl = nextWorkflow === 'appeal'
            ? `${window.location.pathname}${window.location.search}#appeal`
            : `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', nextUrl);
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

    async function handleAppealSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!session?.user) {
            handleAppealSignIn();
            return;
        }

        setAppealSubmitting(true);
        setAppealResult(null);
        try {
            const response = await fetch('/api/moderation-appeals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moderationKey,
                    reason: appealReason,
                    evidenceLinks: appealEvidence,
                }),
            });
            const data = await response.json().catch(() => ({})) as AppealResult;
            if (!response.ok) {
                setAppealResult({ error: data.error || `Appeal submission failed (${response.status}).` });
                return;
            }
            setAppealResult(data);
            setAppealReason('');
            setAppealEvidence('');
        } catch {
            setAppealResult({ error: 'Appeal submission failed.' });
        } finally {
            setAppealSubmitting(false);
        }
    }

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="report-title">
                    <div className="rl-utility-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">{workflow === 'report' ? 'Public reports' : 'Ro-Link appeals'}</p>
                            <h1 className="rl-utility-title" id="report-title">
                                {workflow === 'report' ? <>Send the right details <span>to the right team.</span></> : <>Ask for a fair <span>moderation review.</span></>}
                            </h1>
                        </div>
                        <p className="rl-utility-intro">
                            {workflow === 'report'
                                ? 'Report a Roblox user, Discord server, or Roblox game. A verified Discord and linked Roblox account are required before submission.'
                                : 'Appeal an exact Ro-Link moderation action associated with your verified user, server, or game.'}
                        </p>
                    </div>
                </section>

                <section className="rl-utility-main rl-shell">
                    <div className="rl-choice-row mb-8" role="group" aria-label="Choose reports or appeals">
                        <button
                            className="rl-choice"
                            type="button"
                            aria-pressed={workflow === 'report'}
                            onClick={() => selectWorkflow('report')}
                        >
                            <strong>Report</strong>
                            <span>Submit a new public report</span>
                        </button>
                        <button
                            className="rl-choice"
                            type="button"
                            aria-pressed={workflow === 'appeal'}
                            onClick={() => selectWorkflow('appeal')}
                        >
                            <strong>Appeal</strong>
                            <span>Appeal a Ro-Link moderation</span>
                        </button>
                    </div>

                    {workflow === 'report' ? (
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
                    ) : (
                    <div className="rl-utility-grid" id="appeal">
                        <section className="rl-surface" aria-labelledby="appeal-title">
                            <div className="rl-surface-header">
                                <div>
                                    <p className="rl-eyebrow">Ro-Link appeals</p>
                                    <h2 id="appeal-title">Appeal a moderation action</h2>
                                    <p>Select the exact user, server, or game moderation attached to your verified accounts.</p>
                                </div>
                                <span className="rl-surface-icon"><Gavel aria-hidden="true" /></span>
                            </div>

                            {appealLoading || status === 'loading' ? (
                                <div className="rl-surface-body">
                                    <div className="rl-notice">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                                        <div><strong>Loading moderation history</strong>Checking bans associated with your Discord, Roblox, servers, and games.</div>
                                    </div>
                                </div>
                            ) : !session?.user ? (
                                <div className="rl-surface-body">
                                    <div className="rl-notice">
                                        <DiscordIcon aria-hidden="true" width="16" height="16" />
                                        <div>
                                            <strong>Sign in to appeal</strong>
                                            Appeals require your Discord identity so Ro-Link can show only moderation associated with you.
                                            <button className="rl-button rl-button-primary mt-4" type="button" onClick={handleAppealSignIn}>Sign in with Discord</button>
                                        </div>
                                    </div>
                                </div>
                            ) : appealContext?.error ? (
                                <div className="rl-surface-body">
                                    <div className="rl-feedback rl-feedback-error">{appealContext.error}</div>
                                </div>
                            ) : !appealContext?.linked ? (
                                <div className="rl-surface-body">
                                    <div className="rl-notice">
                                        <Image src="/Media/Roblox.png" alt="" width={16} height={16} />
                                        <div>
                                            <strong>Link your Roblox account to continue</strong>
                                            A linked Roblox account is required to verify your identity and load appealable moderation.
                                            <button className="rl-button rl-button-primary mt-4" type="button" onClick={handleAppealRobloxLink} disabled={linkingRoblox}>
                                                {linkingRoblox ? 'Opening Roblox…' : 'Link Roblox account'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : appealContext.options.length === 0 ? (
                                <div className="rl-surface-body">
                                    <div className="rl-notice">
                                        <Check aria-hidden="true" />
                                        <div><strong>No appealable moderation found</strong>There are no active Ro-Link bans associated with your verified user, owned Discord servers, or connected Roblox games.</div>
                                    </div>
                                </div>
                            ) : (
                                <form className="rl-surface-body" onSubmit={handleAppealSubmit}>
                                    <div className="rl-form-section">
                                        <label className="rl-field-label" htmlFor="appeal-moderation">Moderation action</label>
                                        <select
                                            className="rl-select"
                                            id="appeal-moderation"
                                            value={moderationKey}
                                            onChange={(event) => setModerationKey(event.target.value)}
                                            required
                                        >
                                            {appealContext.options.map((option) => (
                                                <option value={option.key} key={option.key}>
                                                    {option.targetLabel}{option.moderatedAt ? ` · ${new Date(option.moderatedAt).toLocaleDateString()}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {appealContext.options.find((option) => option.key === moderationKey) && (
                                            <div className="rl-notice mt-4">
                                                <Gavel aria-hidden="true" />
                                                <div>
                                                    <strong>Original moderation reason</strong>
                                                    {appealContext.options.find((option) => option.key === moderationKey)?.reason}
                                                    {appealContext.options.find((option) => option.key === moderationKey)?.originalForumUrl && (
                                                        <a
                                                            className="mt-2 inline-flex items-center gap-1 text-sky-400"
                                                            href={appealContext.options.find((option) => option.key === moderationKey)?.originalForumUrl || '#'}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Open original forum post <ExternalLink aria-hidden="true" width={13} height={13} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rl-form-section">
                                        <label className="rl-field-label" htmlFor="appeal-reason">Why should this moderation be reviewed?</label>
                                        <textarea
                                            className="rl-textarea"
                                            id="appeal-reason"
                                            value={appealReason}
                                            onChange={(event) => setAppealReason(event.target.value)}
                                            placeholder="Explain clearly why the moderation should be changed, including any relevant context."
                                            minLength={20}
                                            required
                                        />
                                    </div>

                                    <div className="rl-form-section">
                                        <label className="rl-field-label" htmlFor="appeal-evidence">Additional evidence links <span className="text-slate-500">(optional)</span></label>
                                        <textarea
                                            className="rl-textarea"
                                            id="appeal-evidence"
                                            value={appealEvidence}
                                            onChange={(event) => setAppealEvidence(event.target.value)}
                                            placeholder="Add image, video, or message links. Separate multiple links with spaces or new lines."
                                        />
                                    </div>

                                    {appealResult?.error && <div className="rl-feedback rl-feedback-error">{appealResult.error}</div>}
                                    {appealResult?.appealId && !appealResult.error && (
                                        <div className="rl-feedback rl-feedback-success">
                                            <strong>Appeal submitted</strong>
                                            <div>{appealResult.appealId}</div>
                                            {appealResult.threadUrl && <a href={appealResult.threadUrl} target="_blank" rel="noreferrer">Open appeal forum post</a>}
                                        </div>
                                    )}

                                    <div className="rl-form-footer">
                                        <p>
                                            {appealContext.identity.robloxUsername || `Roblox ${appealContext.identity.robloxId}`} · {session.user.name || 'Discord user'}
                                        </p>
                                        <button
                                            className="rl-button rl-button-primary"
                                            type="submit"
                                            disabled={appealSubmitting || !moderationKey || appealReason.trim().length < 20}
                                        >
                                            <Send aria-hidden="true" width={14} height={14} />
                                            {appealSubmitting ? 'Submitting…' : 'Submit appeal'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </section>

                        <aside className="rl-aside-stack">
                            <div className="rl-surface rl-aside-panel">
                                <h2>Appeal requirements</h2>
                                <ul className="rl-aside-list">
                                    <li><Check aria-hidden="true" /><span>Use your signed-in Discord account.</span></li>
                                    <li><Check aria-hidden="true" /><span>Keep your Roblox account linked.</span></li>
                                    <li><Check aria-hidden="true" /><span>Select the exact moderation action.</span></li>
                                    <li><Check aria-hidden="true" /><span>Explain why staff should review it.</span></li>
                                </ul>
                            </div>
                            <div className="rl-notice">
                                <LockKeyhole aria-hidden="true" />
                                <div><strong>Identity protected</strong>The form only lists moderation tied to your verified identity, owned servers, and connected games.</div>
                            </div>
                        </aside>
                    </div>
                    )}
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
