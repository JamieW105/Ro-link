'use client';
import { Status } from '@/components/ui/status';

import { Card } from "@/components/ui/card";
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

import { DGSU_BAN_AUTH_ERROR, DGSU_BAN_ERROR_MESSAGE } from '@/lib/dgsuBanConstants';
import { LogIn } from 'lucide-react';
import { getCanonicalSignInUrl } from '@/lib/signInNavigation';
import { Button } from '@/components/ui/button';

type SignInClientProps = {
    callbackUrl: string;
    error?: string;
    authOrigin?: string;
    allowRootAlias?: boolean;
    discordConfigured?: boolean;
};

export default function SignInClient({ callbackUrl, error, authOrigin, allowRootAlias, discordConfigured = true }: SignInClientProps) {
    const errorMessage = !discordConfigured || error === 'Configuration'
        ? 'Discord sign in is temporarily unavailable. Please contact the site administrator.'
        : error === DGSU_BAN_AUTH_ERROR
        ? DGSU_BAN_ERROR_MESSAGE
        : 'Discord sign in could not be completed. Please try again.';
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [hasRequestError, setHasRequestError] = useState(false);
    const [destination, setDestination] = useState('Ro-Link');

    useEffect(() => {
        try {
            const url = new URL(callbackUrl, window.location.origin);
            setDestination(url.hostname);
        } catch {
            setDestination('Ro-Link');
        }
    }, [callbackUrl]);

    useEffect(() => {
        const nextUrl = getCanonicalSignInUrl(window.location.origin, authOrigin, callbackUrl, error, allowRootAlias);
        if (nextUrl) window.location.replace(nextUrl);
    }, [callbackUrl, error, authOrigin, allowRootAlias]);

    async function handleDiscordSignIn() {
        if (!discordConfigured) return;
        const nextUrl = getCanonicalSignInUrl(window.location.origin, authOrigin, callbackUrl, error, allowRootAlias);
        if (nextUrl) {
            window.location.replace(nextUrl);
            return;
        }
        setIsSigningIn(true);
        setHasRequestError(false);
        try {
            await signIn('discord', { callbackUrl });
        } catch {
            setHasRequestError(true);
        } finally {
            setIsSigningIn(false);
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12 text-foreground">

            <Card className="relative w-full max-w-[440px] rounded-xl border border-border bg-card p-8 shadow-sm">
                <div className="mb-7 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Image src="/Media/Ro-LinkIcon.png" alt="Ro-Link" width={44} height={44} className="size-11 rounded-lg object-contain" />
                        <div>
                            <p className="text-sm font-semibold text-muted-foreground">Ro-Link</p>
                            <h1 className="text-xl font-bold tracking-tight">Sign in to continue</h1>
                        </div>
                    </div>
                    <div className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Secure
                    </div>
                </div>

                <Card className="mb-6 rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground">Destination</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{destination}</p>
                </Card>

                {error || hasRequestError || !discordConfigured ? (
                    <Status variant="error" role="alert" className="w-full whitespace-normal rounded-md p-4 text-sm leading-7">
                        {errorMessage}
                    </Status>
                ) : null}

                <Button
                    variant="default"
                    size="lg"
                    type="button"
                    onClick={handleDiscordSignIn}
                    disabled={isSigningIn || !discordConfigured}
                    className="flex w-full items-center justify-center gap-2 px-5 text-sm transition disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <LogIn aria-hidden="true" className="h-5 w-5" />
                    {isSigningIn ? 'Opening Discord...' : 'Sign in with Discord'}
                </Button>

                <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
                    Ro-Link uses Discord to verify your account and dashboard access.
                </p>
            </Card>
        </main>
    );
}
