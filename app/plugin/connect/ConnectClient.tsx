'use client';
import { Status } from '@/components/ui/status';

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
            <Card className="w-full max-w-xl rounded-xl border border-border bg-card shadow-sm backdrop-blur-xl p-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-14 w-14 rounded-xl bg-muted border border-border flex items-center justify-center">
                        <Image src="/Media/Ro-LinkIcon.png" alt="Ro-Link" width={32} height={32} className="h-8 w-8 object-contain" />
                    </div>
                    <div>
                        <p className="text-[11px] text-foreground font-bold">Ro-Link Studio Plugin</p>
                        <h1 className="text-3xl font-black tracking-tight">Connect Roblox Studio</h1>
                    </div>
                </div>

                {missingSessionParams ? (
                    <Card className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
                        This link is missing the Studio session details. Re-open the link from the Roblox Studio plugin.
                    </Card>
                ) : null}

                {clientOutcome.kind === 'success' ? (
                    <div className="space-y-5">
                        {signedInName ? (
                            <Card className="rounded-xl border border-border bg-card px-5 py-4">
                                <p className="text-[11px] text-muted-foreground font-bold mb-2">Discord Account</p>
                                <p className="text-lg font-bold">{signedInName}</p>
                            </Card>
                        ) : null}
                        <Status variant="success" className="w-full whitespace-normal rounded-md p-4 text-sm leading-7" role="status">
                            Roblox Studio is connected. Return to the Ro-Link plugin window to continue setup.
                        </Status>
                        <p className="text-xs text-muted-foreground font-bold">
                            Studio Session: {sessionId} / Code: {code}
                        </p>
                    </div>
                ) : null}

                {clientOutcome.kind === 'error' ? (
                    <div className="space-y-5">
                        {signedInName ? (
                            <Card className="rounded-xl border border-border bg-card px-5 py-4">
                                <p className="text-[11px] text-muted-foreground font-bold mb-2">Discord Account</p>
                                <p className="text-lg font-bold">{signedInName}</p>
                            </Card>
                        ) : null}
                        <Card className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm leading-7 text-rose-100">
                            {clientOutcome.message}
                        </Card>
                        <p className="text-xs text-muted-foreground">
                            Refresh this page after fixing the issue, or start a new connection from the Studio plugin.
                        </p>
                        <p className="text-xs text-muted-foreground font-bold">
                            Studio Session: {sessionId} / Code: {code}
                        </p>
                    </div>
                ) : null}

                {!missingSessionParams && clientOutcome.kind === 'need_discord' && status === 'loading' ? (
                    <Card className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
                        Checking your Ro-Link session...
                    </Card>
                ) : null}

                {!missingSessionParams && clientOutcome.kind === 'need_discord' && status === 'unauthenticated' ? (
                    <div className="space-y-5">
                        <p className="text-sm leading-7 text-muted-foreground">
                            Sign in with Discord so Ro-Link can link this Studio session to your account.
                        </p>
                        <Button variant="outline"
                            type="button"
                            onClick={() => signIn('discord', { callbackUrl })}
                            className="inline-flex items-center justify-center px-5 py-3 text-sm transition hover:"
                        >
                            Sign In With Discord
                        </Button>
                    </div>
                ) : null}

                {!missingSessionParams && clientOutcome.kind === 'need_discord' && needsDiscordReauth ? (
                    <div className="space-y-5">
                        <p className="text-sm leading-7 text-muted-foreground">
                            Your Discord session is missing a fresh token. Sign in again to finish connecting Studio.
                        </p>
                        <Button variant="outline"
                            type="button"
                            onClick={() => signIn('discord', { callbackUrl })}
                            className="inline-flex items-center justify-center px-5 py-3 text-sm transition hover:"
                        >
                            Sign In With Discord Again
                        </Button>
                    </div>
                ) : null}

                {!missingSessionParams && serverNeedsDiscordButClientLooksReady ? (
                    <Card className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-foreground">
                        Finishing Studio authorization with your Discord session...
                    </Card>
                ) : null}
            </Card>
        </main>
    );
}
