import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { authorizeStudioPluginFromBrowserSession } from '@/lib/studioPluginBrowserAuth';

import { ConnectClient } from './ConnectClient';

export const dynamic = 'force-dynamic';

type SessionWithDiscord = Session & {
    accessToken?: string;
    error?: string;
    user?: Session['user'] & { id?: string };
};

function PluginConnectFallback() {
    return (
        <main className="min-h-screen bg-[#07111f] text-white flex items-center justify-center px-6 py-12">
            <section className="w-full max-w-xl rounded-[28px] border border-sky-900/40 bg-slate-950/80 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl p-10">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm text-slate-300">
                    Loading Studio connection details...
                </div>
            </section>
        </main>
    );
}

async function PluginConnectInner({ searchParams }: { searchParams: Promise<{ sessionId?: string; code?: string }> }) {
    const sp = await searchParams;
    const sessionId = typeof sp.sessionId === 'string' ? sp.sessionId.trim() : '';
    const code = typeof sp.code === 'string' ? sp.code.trim() : '';

    const session = await getServerSession(authOptions) as SessionWithDiscord | null;
    const cookieStore = await cookies();
    const headersList = await headers();

    const outcome = await authorizeStudioPluginFromBrowserSession({
        sessionId,
        code,
        session,
        cookieStore,
        requestHeaders: headersList,
    });

    const signedInName = session?.user?.name || session?.user?.email || null;

    return (
        <ConnectClient
            sessionId={sessionId}
            code={code}
            outcome={outcome}
            signedInName={signedInName}
        />
    );
}

export default function PluginConnectPage({ searchParams }: { searchParams: Promise<{ sessionId?: string; code?: string }> }) {
    return (
        <Suspense fallback={<PluginConnectFallback />}>
            <PluginConnectInner searchParams={searchParams} />
        </Suspense>
    );
}
