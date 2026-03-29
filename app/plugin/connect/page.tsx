'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

type ConnectState = 'idle' | 'authorizing' | 'authorized' | 'error';

export default function PluginConnectPage() {
    const { data: session, status } = useSession();
    const searchParams = useSearchParams();
    const sessionId = useMemo(() => searchParams.get('sessionId')?.trim() || '', [searchParams]);
    const code = useMemo(() => searchParams.get('code')?.trim() || '', [searchParams]);
    const [connectState, setConnectState] = useState<ConnectState>('idle');
    const [message, setMessage] = useState('Approve this Studio connection to continue in Roblox Studio.');

    useEffect(() => {
        if (status !== 'authenticated' || !sessionId || !code || connectState === 'authorizing' || connectState === 'authorized') {
            return;
        }

        let cancelled = false;

        async function authorize() {
            setConnectState('authorizing');
            setMessage('Authorizing Roblox Studio with your Ro-Link account...');

            const response = await fetch('/api/plugin/session/authorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, code }),
            });

            const payload = await response.json().catch(() => ({}));
            if (cancelled) {
                return;
            }

            if (!response.ok) {
                setConnectState('error');
                setMessage(payload.error || 'Studio authorization failed.');
                return;
            }

            setConnectState('authorized');
            setMessage('Roblox Studio is connected. Return to the Ro-Link plugin window to continue setup.');
        }

        authorize();

        return () => {
            cancelled = true;
        };
    }, [status, sessionId, code, connectState]);

    const missingSessionParams = !sessionId || !code;

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

                {status === 'loading' ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm text-slate-300">
                        Checking your Ro-Link session...
                    </div>
                ) : null}

                {status === 'unauthenticated' ? (
                    <div className="space-y-5">
                        <p className="text-sm leading-7 text-slate-300">
                            Sign in with Discord first. The Studio plugin will use that session to load the Ro-Link servers you can configure.
                        </p>
                        <button
                            type="button"
                            onClick={() => signIn('discord')}
                            className="inline-flex items-center justify-center rounded-2xl bg-[#5865F2] px-5 py-3 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-[#4752C4]"
                        >
                            Sign In With Discord
                        </button>
                    </div>
                ) : null}

                {status === 'authenticated' ? (
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-bold mb-2">Discord Account</p>
                            <p className="text-lg font-bold">{session.user?.name || session.user?.email || 'Unknown User'}</p>
                        </div>

                        <div className={`rounded-2xl px-5 py-4 text-sm leading-7 ${
                            connectState === 'authorized'
                                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-50'
                                : connectState === 'error'
                                    ? 'border border-rose-500/30 bg-rose-500/10 text-rose-100'
                                    : 'border border-sky-500/20 bg-sky-500/10 text-slate-100'
                        }`}>
                            {message}
                        </div>

                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 font-bold">
                            Studio Session: {sessionId || 'missing'} / Code: {code || 'missing'}
                        </p>
                    </div>
                ) : null}
            </section>
        </main>
    );
}
