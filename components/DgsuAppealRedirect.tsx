'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { DGSU_BAN_AUTH_ERROR } from '@/lib/dgsuBanConstants';

export function DgsuAppealRedirect() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (
            session?.error === DGSU_BAN_AUTH_ERROR
            && pathname !== '/report'
            && pathname !== '/auth/signin'
        ) {
            router.replace('/report#appeal');
        }
    }, [pathname, router, session?.error]);

    return null;
}

