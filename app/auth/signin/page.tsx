import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import SignInClient from '@/components/auth/SignInClient';
import { isAllowedDashboardUrl } from '@/lib/customDashboardDomains';
import { DGSU_BAN_AUTH_ERROR } from '@/lib/dgsuBanConstants';

type SignInPageProps = {
    searchParams: Promise<{
        callbackUrl?: string | string[];
        error?: string | string[];
    }>;
};

function firstSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function getSafeCallbackUrl(value: string | undefined) {
    if (value?.startsWith('/') && !value.startsWith('//')) {
        return value;
    }

    if (value && isAllowedDashboardUrl(value)) {
        return value;
    }

    return '/dashboard';
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
    const params = await searchParams;
    const callbackUrl = getSafeCallbackUrl(firstSearchParam(params.callbackUrl));
    const error = firstSearchParam(params.error);
    const session = await getServerSession(authOptions);
    const rememberedDiscordUserId = String(session?.user?.id || '').trim();

    // The signed, HTTP-only session cookie is verified here on the Ro-Link
    // server. A remembered browser never has to contact Discord itself.
    if (rememberedDiscordUserId && session?.error !== DGSU_BAN_AUTH_ERROR) {
        redirect(callbackUrl);
    }

    return <SignInClient callbackUrl={callbackUrl} error={error} />;
}
