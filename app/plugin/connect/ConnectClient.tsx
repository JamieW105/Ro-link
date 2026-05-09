'use client';

import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import type { StudioPluginConnectOutcome } from '@/lib/studioPluginBrowserAuth';

function buildCallbackUrl(sessionId: string, code: string) {
    const params = new URLSearchParams();
    if (sessionId) {
        params.set('sessionId', sessionId);
    }
    if (code) {
        params.set('code', code);
    }
    const query = params.toString();
    return query ? `/plugin/connect?${query}` : '/plugin/connect';
}

type Props = {
    sessionId: string;
    code: string;
    outcome: StudioPluginConnectOutcome;
    signedInName: string | null;
};

export function ConnectClient({ sessionId, code, outcome, signedInName }: Props) {
    const { data: session, status } = useSession();
    const [clientOutcome, setClientOutcome] = useState(outcome);
    const [clientAuthorizeStarted, setClientAuthorizeStarted] = useState(false);
    const callbackUrl = buildCallbackUrl(sessionId, code);
    const missingSessionParams = !sessionId || !code;

    const needsDiscordReauth =
        clientOutcome.kind === 'need_discord'
        && status === 'authenticated'
        && (!session?.accessToken || Boolean(session.error));

    const serverNeedsDiscordButClientLooksReady =
        clientOutcome.kind === 'need_discord'
        && status === 'authenticated'
        && Boolean(session?.accessToken)
        && !session?.error;

    useEffect(() => {
        setClientOutcome(outcome);
        setClientAuthorizeStarted(false);
    }, [sessionId, code, outcome]);

    useEffect(() => {
        if (
            missingSessionParams
            || clientAuthorizeStarted
            || clientOutcome.kind !== 'need_discord'
            || status !== 'authenticated'
            || !session?.accessToken
            || session.error
        ) {
            return;
        }

        let cancelled = false;
        setClientAuthorizeStarted(true);

        async function authorizeFromHydratedSession() {
            try {
                const response = await fetch('/api/plugin/session/authorize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId, code }),
                });
                const payload = await response.json().catch(() => ({}));

                if (cancelled) {
                    return;
                }

                if (response.ok && payload?.pluginToken && payload?.tokenExpiresAt) {
                    setClientOutcome({
                        kind: 'success',
                        pluginToken: String(payload.pluginToken),
                        tokenExpiresAt: String(payload.tokenExpiresAt),
                    });
                    return;
                }

                setClientOutcome({
                    kind: 'error',
                    message: typeof payload?.error === 'string'
                        ? payload.error
                        : `Studio authorization failed (${response.status}).`,
                    status: response.status,
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setClientOutcome({
                    kind: 'error',
                    message: error instanceof Error ? error.message : 'Studio authorization failed.',
                    status: 500,
                });
            }
        }

        authorizeFromHydratedSession();

        return () => {
            cancelled = true;
        };
    }, [
        clientAuthorizeStarted,
        clientOutcome.kind,
        code,
        missingSessionParams,
        session?.accessToken,
        session?.error,
        sessionId,
        status,
    ]);

    return (
        <main className="min-h-screen bg-[#07111f] text-white flex items-center justify-center px-6 py-12">
            <section className="w-full max-w-xl rounded-[28px] border border-sky-900/40 bg-slate-950/80 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl p-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center">
                        <Image src="/Media/Ro-LinkIcon.png" alt="Ro-Link" width={32} height={32} className="h-8 w-8 object-contain" />
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-sky-300/70 font-bold">Ro-Link Studio Plugin</p>
                        <h1 className="text-3xl font-black tracking-tight">Connect Roblox Studio</h1>
                    </div>
                </div>

                {missingSessionParams ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
                        This link is missing the Studio session details. Re-open the link from the Roblox Studio plugin.
                    </div>
                ) : null}

                {clientOutcome.kind === 'success' ? (
                    <div className="space-y-5">
                        {signedInName ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4">
                                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-bold mb-2">Discord Account</p>
                                <p className="text-lg font-bold">{signedInName}</p>
                            </div>
                        ) : null}
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm leading-7 text-emerald-50">
                            Roblox Studio is connected. Return to the Ro-Link plugin window to continue setup.
                        </div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 font-bold">
                            Studio Session: {sessionId} / Code: {code}
                        </p>
                    </div>
                ) : null}

                {clientOutcome.kind === 'error' ? (
                    <div className="space-y-5">
                        {signedInName ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4">
                                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-bold mb-2">Discord Account</p>
                                <p className="text-lg font-bold">{signedInName}</p>
                            </div>
                        ) : null}
                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm leading-7 text-rose-100">
                            {clientOutcome.message}
                        </div>
                        <p className="text-xs text-slate-400">
                            Refresh this page after fixing the issue, or start a new connection from the Studio plugin.
                        </p>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 font-bold">
                            Studio Session: {sessionId} / Code: {code}
                        </p>
                    </div>
                ) : null}

                {!missingSessionParams && clientOutcome.kind === 'need_discord' && status === 'loading' ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm text-slate-300">
                        Checking your Ro-Link session...
                    </div>
                ) : null}

                {!missingSessionParams && clientOutcome.kind === 'need_discord' && status === 'unauthenticated' ? (
                    <div className="space-y-5">
                        <p className="text-sm leading-7 text-slate-300">
                            Sign in with Discord so Ro-Link can link this Studio session to your account.
                        </p>
                        <button
                            type="button"
                            onClick={() => signIn('discord', { callbackUrl })}
                            className="inline-flex items-center justify-center rounded-2xl bg-[#5865F2] px-5 py-3 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-[#4752C4]"
                        >
                            Sign In With Discord
                        </button>
                    </div>
                ) : null}

                {!missingSessionParams && clientOutcome.kind === 'need_discord' && needsDiscordReauth ? (
                    <div className="space-y-5">
                        <p className="text-sm leading-7 text-slate-300">
                            Your Discord session is missing a fresh token. Sign in again to finish connecting Studio.
                        </p>
                        <button
                            type="button"
                            onClick={() => signIn('discord', { callbackUrl })}
                            className="inline-flex items-center justify-center rounded-2xl bg-[#5865F2] px-5 py-3 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-[#4752C4]"
                        >
                            Sign In With Discord Again
                        </button>
                    </div>
                ) : null}

                {!missingSessionParams && serverNeedsDiscordButClientLooksReady ? (
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-5 py-4 text-sm text-slate-100">
                        Finishing Studio authorization with your Discord session...
                    </div>
                ) : null}
            </section>
        </main>
    );
}
