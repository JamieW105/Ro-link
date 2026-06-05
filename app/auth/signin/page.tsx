'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function getConfiguredRootDomains() {
    const configured = process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAINS
        || process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAIN
        || 'rolink.cloud';

    return configured
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean)
        .map((domain) => domain
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .replace(/^wildcard\./, ''));
}

function getCanonicalAuthOrigin(callbackUrl: string) {
    const configured = process.env.NEXT_PUBLIC_AUTH_BASE_URL
        || process.env.NEXT_PUBLIC_CANONICAL_AUTH_URL;

    if (configured) {
        return configured.replace(/\/$/, '');
    }

    try {
        const callback = new URL(callbackUrl);
        const hostname = callback.hostname.toLowerCase();
        const rootDomain = getConfiguredRootDomains().find((domain) => (
            hostname === domain || hostname.endsWith(`.${domain}`)
        ));

        if (rootDomain) {
            return `${callback.protocol}//${rootDomain}`;
        }
    } catch {
        return null;
    }

    return null;
}

function DiscordIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.076.076 0 0 0-.041.107a14.314 14.314 0 0 0 1.226 1.994a.075.075 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.175 1.086 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z" />
        </svg>
    );
}

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const error = searchParams.get('error');
    const [isSigningIn, setIsSigningIn] = useState(false);
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
        const canonicalOrigin = getCanonicalAuthOrigin(callbackUrl);
        if (!canonicalOrigin || canonicalOrigin === window.location.origin) return;

        const nextUrl = new URL('/auth/signin', canonicalOrigin);
        nextUrl.searchParams.set('callbackUrl', callbackUrl);
        if (error) nextUrl.searchParams.set('error', error);
        window.location.replace(nextUrl.toString());
    }, [callbackUrl, error]);

    async function handleDiscordSignIn() {
        setIsSigningIn(true);
        await signIn('discord', { callbackUrl });
        setIsSigningIn(false);
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6 py-12 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.22),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0)_0%,#020617_72%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

            <section className="relative w-full max-w-[440px] rounded-xl border border-slate-800 bg-slate-950/90 p-8 shadow-2xl shadow-black/40">
                <div className="mb-7 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="h-11 w-11 rounded-lg object-contain" />
                        <div>
                            <p className="text-sm font-semibold text-slate-400">Ro-Link</p>
                            <h1 className="text-xl font-bold tracking-tight">Sign in to continue</h1>
                        </div>
                    </div>
                    <div className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-400">
                        Secure
                    </div>
                </div>

                <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Destination</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-200">{destination}</p>
                </div>

                {error ? (
                    <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        Discord sign in could not be completed. Please try again.
                    </div>
                ) : null}

                <button
                    type="button"
                    onClick={handleDiscordSignIn}
                    disabled={isSigningIn}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-5 text-sm font-bold text-white transition hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <DiscordIcon />
                    {isSigningIn ? 'Opening Discord...' : 'Sign in with Discord'}
                </button>

                <p className="mt-5 text-center text-xs leading-5 text-slate-500">
                    Ro-Link uses Discord to verify your account and dashboard access.
                </p>
            </section>
        </main>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <main className="flex min-h-screen items-center justify-center bg-[#020617]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </main>
        }>
            <SignInContent />
        </Suspense>
    );
}
