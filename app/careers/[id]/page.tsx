'use client';

import {
    ArrowLeft,
    BriefcaseBusiness,
    Check,
    CircleCheck,
    Clock3,
    LockKeyhole,
    Send,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { use, useEffect, useState } from 'react';

import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
import { DiscordIcon } from '@/components/ui/DiscordIcon';

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

type LinkedAccount = {
    roblox_id: string | number;
};

export default function ApplicationForm({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = use(paramsPromise);
    const { data: session, status } = useSession();
    const [job, setJob] = useState<Job | null>(null);
    const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [linkingRoblox, setLinkingRoblox] = useState(false);
    const [error, setError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [submittedNow, setSubmittedNow] = useState(false);
    const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
    const [linkedAccountLoading, setLinkedAccountLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/careers/${params.id}`)
            .then((response) => response.json())
            .then((data) => {
                if (data.error) setError(data.error);
                else setJob(data);
            })
            .catch(() => setError('Unable to load this application.'))
            .finally(() => setLoading(false));
    }, [params.id]);

    useEffect(() => {
        let cancelled = false;

        async function loadLinkedAccount() {
            setLinkedAccountLoading(true);
            try {
                const response = await fetch('/api/verify/linked-account', { cache: 'no-store' });
                const data = response.ok ? await response.json() as LinkedAccount | null : null;
                if (!cancelled) setLinkedAccount(data?.roblox_id ? data : null);
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

    function handleAnswer(questionId: string, value: string | boolean) {
        setAnswers((current) => ({ ...current, [questionId]: value }));
    }

    function handleDiscordSignIn() {
        signIn('discord', { callbackUrl: `/careers/${params.id}` });
    }

    function handleRobloxLink() {
        setLinkingRoblox(true);
        window.location.href = `/api/roblox/auth?returnTo=${encodeURIComponent(`/careers/${params.id}`)}`;
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError('');

        if (!session) {
            handleDiscordSignIn();
            return;
        }
        if (!linkedAccount?.roblox_id) {
            setSubmitError('Link your Roblox account before submitting an application.');
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch(`/api/careers/${params.id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers }),
            });
            const data = await response.json().catch(() => ({})) as { error?: string };

            if (!response.ok) {
                setSubmitError(data.error || `Application submission failed (${response.status}).`);
                return;
            }

            setSubmittedNow(true);
            setJob((current) => current ? { ...current, hasSubmitted: true } : current);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            setSubmitError('Application submission failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <>
                <main className="rl-public-page">
                    <section className="rl-utility-main rl-shell" aria-label="Loading application">
                        <div className="rl-loading-line" />
                    </section>
                </main>
                <PublicFooter />
            </>
        );
    }

    if (error || !job) {
        return (
            <>
                <main className="rl-public-page">
                    <section className="rl-utility-hero" aria-labelledby="application-error-title">
                        <PublicHeroBackdrop />
                        <div className="rl-utility-hero-inner rl-shell">
                            <div>
                                <p className="rl-eyebrow">Careers</p>
                                <h1 className="rl-utility-title" id="application-error-title">
                                    This application is <span>not available.</span>
                                </h1>
                            </div>
                            <p className="rl-utility-intro">{error || 'The requested position could not be found.'}</p>
                        </div>
                    </section>
                    <section className="rl-utility-main rl-shell">
                        <Link className="rl-button" href="/careers"><ArrowLeft aria-hidden="true" />Back to careers</Link>
                    </section>
                </main>
                <PublicFooter />
            </>
        );
    }

    if (job.hasSubmitted) {
        return (
            <>
                <main className="rl-public-page" id="top">
                    <section className="rl-utility-hero" aria-labelledby="application-submitted-title">
                        <PublicHeroBackdrop />
                        <div className="rl-utility-hero-inner rl-shell">
                            <div>
                                <p className="rl-eyebrow">Application received</p>
                                <h1 className="rl-utility-title" id="application-submitted-title">
                                    Your application is <span>with our team.</span>
                                </h1>
                            </div>
                            <p className="rl-utility-intro">
                                {submittedNow
                                    ? 'Your application was submitted successfully. Check your Discord DMs for confirmation.'
                                    : 'You have already applied for this position. There is nothing else you need to submit.'}
                            </p>
                        </div>
                    </section>

                    <section className="rl-utility-main rl-shell">
                        <div className="rl-application-status rl-surface">
                            <span className="rl-application-status-icon"><CircleCheck aria-hidden="true" /></span>
                            <p className="rl-eyebrow">Submission complete</p>
                            <h2>{job.title}</h2>
                            <p>
                                Our team will review your answers and contact you through Discord if your application moves forward.
                            </p>
                            <div className="rl-application-status-actions">
                                <Link className="rl-button rl-button-primary" href="/careers">
                                    <ArrowLeft aria-hidden="true" />Return to careers
                                </Link>
                            </div>
                        </div>
                    </section>
                </main>
                <PublicFooter />
            </>
        );
    }

    const authLoading = status === 'loading' || (Boolean(session?.user) && linkedAccountLoading);
    const canSubmit = Boolean(session?.user && linkedAccount?.roblox_id);

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="application-title">
                    <PublicHeroBackdrop />
                    <div className="rl-utility-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">Careers application</p>
                            <h1 className="rl-utility-title" id="application-title">
                                Apply for <span>{job.title}.</span>
                            </h1>
                        </div>
                        <p className="rl-utility-intro">
                            Tell us about your experience and why you are interested in the role. A signed-in Discord account and linked Roblox account are required.
                        </p>
                    </div>
                </section>

                <section className="rl-utility-main rl-shell">
                    <Link className="rl-back-link" href="/careers"><ArrowLeft aria-hidden="true" />All positions</Link>

                    <div className="rl-utility-grid">
                        <section className="rl-surface" aria-labelledby="application-form-title">
                            <div className="rl-surface-header">
                                <div>
                                    <h2 id="application-form-title">Application form</h2>
                                    <p>Required questions are marked with an asterisk.</p>
                                </div>
                                <span className="rl-surface-icon"><BriefcaseBusiness aria-hidden="true" /></span>
                            </div>

                            <form className="rl-surface-body" onSubmit={handleSubmit}>
                                <div className="rl-application-summary">
                                    <span>Open position</span>
                                    <h2>{job.title}</h2>
                                    <p className="whitespace-pre-wrap">{job.description}</p>
                                    {job.requirements && (
                                        <div className="rl-application-requirements">
                                            <strong>Expectations and requirements</strong>
                                            <p className="whitespace-pre-wrap">{job.requirements}</p>
                                        </div>
                                    )}
                                </div>

                                {job.questions.map((question) => (
                                    question.type === 'section' ? (
                                        <div className="rl-application-section" key={question.id}>
                                            <h2>{question.label}</h2>
                                        </div>
                                    ) : (
                                        <div className="rl-form-section" key={question.id}>
                                            <label className="rl-field-label" htmlFor={`application-${question.id}`}>
                                                {question.label}{question.required && <span aria-hidden="true"> *</span>}
                                            </label>

                                            {question.type === 'short_answer' && (
                                                <input
                                                    className="rl-field"
                                                    id={`application-${question.id}`}
                                                    type="text"
                                                    required={question.required}
                                                    value={String(answers[question.id] || '')}
                                                    onChange={(event) => handleAnswer(question.id, event.target.value)}
                                                />
                                            )}

                                            {question.type === 'long_answer' && (
                                                <textarea
                                                    className="rl-textarea rl-application-textarea"
                                                    id={`application-${question.id}`}
                                                    required={question.required}
                                                    value={String(answers[question.id] || '')}
                                                    onChange={(event) => handleAnswer(question.id, event.target.value)}
                                                />
                                            )}

                                            {question.type === 'multi_choice' && (
                                                <div className="rl-option-list" id={`application-${question.id}`}>
                                                    {question.options?.map((option) => (
                                                        <label className="rl-option" key={option}>
                                                            <input
                                                                type="radio"
                                                                name={question.id}
                                                                required={question.required}
                                                                checked={answers[question.id] === option}
                                                                onChange={() => handleAnswer(question.id, option)}
                                                            />
                                                            <span>{option}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            {question.type === 'checkbox' && (
                                                <label className="rl-option" id={`application-${question.id}`}>
                                                    <input
                                                        type="checkbox"
                                                        required={question.required}
                                                        checked={Boolean(answers[question.id])}
                                                        onChange={(event) => handleAnswer(question.id, event.target.checked)}
                                                    />
                                                    <span>I agree to the above terms.</span>
                                                </label>
                                            )}
                                        </div>
                                    )
                                ))}

                                {submitError && <div className="rl-feedback rl-feedback-error">{submitError}</div>}

                                <div className="rl-form-footer rl-application-footer">
                                    <p>
                                        {canSubmit
                                            ? `Submitting as ${session?.user?.name || 'Discord user'}`
                                            : 'Verify both accounts to submit.'}
                                    </p>

                                    {authLoading ? (
                                        <button className="rl-button" type="button" disabled>Checking verification…</button>
                                    ) : !session?.user ? (
                                        <button className="rl-button rl-button-primary" type="button" onClick={handleDiscordSignIn}>
                                            <DiscordIcon aria-hidden="true" width="15" height="15" />Sign in with Discord
                                        </button>
                                    ) : !linkedAccount?.roblox_id ? (
                                        <button className="rl-button rl-button-primary" type="button" onClick={handleRobloxLink} disabled={linkingRoblox}>
                                            <Image src="/Media/Roblox.png" alt="" width={15} height={15} />
                                            {linkingRoblox ? 'Opening Roblox…' : 'Link Roblox account'}
                                        </button>
                                    ) : (
                                        <button className="rl-button rl-button-primary" type="submit" disabled={submitting}>
                                            <Send aria-hidden="true" />
                                            {submitting ? 'Submitting…' : 'Submit application'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </section>

                        <aside className="rl-aside-stack">
                            <div className="rl-surface rl-aside-panel">
                                <h2>Before submitting</h2>
                                <ul className="rl-aside-list">
                                    <li><Check aria-hidden="true" /><span>Answer every required question.</span></li>
                                    <li><Check aria-hidden="true" /><span>Use an account you can access on Discord.</span></li>
                                    <li><Check aria-hidden="true" /><span>Review your answers before sending.</span></li>
                                </ul>
                            </div>
                            <div className="rl-notice">
                                <LockKeyhole aria-hidden="true" />
                                <div><strong>Verified applications</strong>Applications require connected Discord and Roblox accounts.</div>
                            </div>
                            <div className="rl-notice">
                                <Clock3 aria-hidden="true" />
                                <div><strong>After you apply</strong>Watch your Discord DMs for confirmation and any follow-up from the team.</div>
                            </div>
                        </aside>
                    </div>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
