'use client';

import { MessageCircle as LucideMessageCircle } from 'lucide-react';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

import { DGSU_BAN_AUTH_ERROR, DGSU_BAN_ERROR_MESSAGE } from '@/lib/dgsuBanConstants';

type SignInClientProps = {
    callbackUrl: string;
    error?: string;
};

function getConfiguredRootDomains() {
    const configured = process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAINS
        || process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAIN
        || 'rolink.cloud,rolink.site';

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
        <LucideMessageCircle aria-hidden="true" className="h-5 w-5" />
    );
}

export default function SignInClient({ callbackUrl, error }: SignInClientProps) {
    const errorMessage = error === DGSU_BAN_AUTH_ERROR
        ? DGSU_BAN_ERROR_MESSAGE
        : 'Discord sign in could not be completed. Please try again.';
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
                        {errorMessage}
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
