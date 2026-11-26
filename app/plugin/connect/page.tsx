import { Card } from "@/components/ui/card";
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
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
            <Card className="w-full max-w-xl rounded-xl border border-border bg-card shadow-sm backdrop-blur-xl p-10">
                <Card className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
                    Loading Studio connection details...
                </Card>
            </Card>
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
