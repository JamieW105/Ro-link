'use client';
import { PublicLoading } from '@/components/public/PublicLoading';

import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Status } from "@/components/ui/status";
import {
    ArrowLeft,
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
import { LogIn as DiscordIcon } from 'lucide-react';

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

        const missing = job?.questions.find(question => question.required && question.type !== 'section' && (question.type === 'checkbox' ? answers[question.id] !== true : !String(answers[question.id] || '').trim()));
        if (missing) { setSubmitError(`Please answer: ${missing.label}`); return; }
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
                        <PublicLoading />
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
                        <Button asChild variant="outline"><Link href="/careers"><ArrowLeft aria-hidden="true" />Back to careers</Link></Button>
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
                        <Card className="rl-application-status rl-surface">
                            <span className="rl-application-status-icon"><CircleCheck aria-hidden="true" /></span>
                            <p className="rl-eyebrow">Submission complete</p>
                            <h2>{job.title}</h2>
                            <p>
                                Our team will review your answers and contact you through Discord if your application moves forward.
                            </p>
                            <div className="rl-application-status-actions">
                                <Button asChild variant="default"><Link href="/careers">
                                    <ArrowLeft aria-hidden="true" />Return to careers
                                </Link></Button>
                            </div>
                        </Card>
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
                        <Card className="rl-surface" aria-labelledby="application-form-title">
                            <CardHeader className="rl-surface-header">
                                <div>
                                    <CardTitle id="application-form-title">Application form</CardTitle>
                                    <CardDescription>Required questions are marked with an asterisk.</CardDescription>
                                </div>

                            </CardHeader>

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
                                                <Input
                                                    className="rl-field"
                                                    id={`application-${question.id}`}
                                                    type="text"
                                                    required={question.required}
                                                    value={String(answers[question.id] || '')}
                                                    onChange={(event) => handleAnswer(question.id, event.target.value)}
                                                />
                                            )}

                                            {question.type === 'long_answer' && (
                                                <Textarea
                                                    className="rl-textarea rl-application-textarea"
                                                    id={`application-${question.id}`}
                                                    required={question.required}
                                                    value={String(answers[question.id] || '')}
                                                    onChange={(event) => handleAnswer(question.id, event.target.value)}
                                                />
                                            )}

                                            {question.type === 'multi_choice' && (
                                                <Select id={`application-${question.id}`} aria-label={question.label} value={String(answers[question.id] || '')} onValueChange={value => handleAnswer(question.id, value)} options={(question.options || []).map(option => ({value:option,label:option}))} />
                                            )}

                                            {question.type === 'checkbox' && (
                                                <label className="rl-option" id={`application-${question.id}`}>
                                                    <Checkbox
                                                        required={question.required}
                                                        checked={Boolean(answers[question.id])}
                                                        onCheckedChange={checked => handleAnswer(question.id, checked === true)}
                                                    />
                                                    <span>I agree to the above terms.</span>
                                                </label>
                                            )}
                                        </div>
                                    )
                                ))}

                                {submitError && <Status variant="error" role="status" className="w-full whitespace-normal rounded-md">{submitError}</Status>}

                                <div className="rl-form-footer rl-application-footer">
                                    <p>
                                        {canSubmit
                                            ? `Submitting as ${session?.user?.name || 'Discord user'}`
                                            : 'Verify both accounts to submit.'}
                                    </p>

                                    {authLoading ? (
                                        <Button variant="outline" type="button" disabled>Checking verification…</Button>
                                    ) : !session?.user ? (
                                        <Button variant="default" type="button" onClick={handleDiscordSignIn}>
                                            <DiscordIcon aria-hidden="true" width="15" height="15" />Sign in with Discord
                                        </Button>
                                    ) : !linkedAccount?.roblox_id ? (
                                        <Button variant="default" type="button" onClick={handleRobloxLink} disabled={linkingRoblox}>
                                            <Image src="/Media/Roblox.png" alt="" width={15} height={15} />
                                            {linkingRoblox ? 'Opening Roblox…' : 'Link Roblox account'}
                                        </Button>
                                    ) : (
                                        <Button variant="default" type="submit" disabled={submitting}>
                                            <Send aria-hidden="true" />
                                            {submitting ? 'Submitting…' : 'Submit application'}
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </Card>

                        <aside className="rl-aside-stack">
                            <Card className="rl-surface rl-aside-panel">
                                <h2>Before submitting</h2>
                                <ul className="rl-aside-list">
                                    <li><Check aria-hidden="true" /><span>Answer every required question.</span></li>
                                    <li><Check aria-hidden="true" /><span>Use an account you can access on Discord.</span></li>
                                    <li><Check aria-hidden="true" /><span>Review your answers before sending.</span></li>
                                </ul>
                            </Card>
                            <Card className="rl-notice">
                                <LockKeyhole aria-hidden="true" />
                                <div><strong>Verified applications</strong>Applications require connected Discord and Roblox accounts.</div>
                            </Card>
                            <Card className="rl-notice">
                                <Clock3 aria-hidden="true" />
                                <div><strong>After you apply</strong>Watch your Discord DMs for confirmation and any follow-up from the team.</div>
                            </Card>
                        </aside>
                    </div>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
