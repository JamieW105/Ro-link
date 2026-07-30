'use client';

import { usePathname } from 'next/navigation';

import { PublicHeader } from '@/components/public/PublicHeader';
import { isPublicHeaderRoute } from '@/lib/siteRoutes';

export function PublicHeaderGate() {
    const pathname = usePathname();

    return isPublicHeaderRoute(pathname) ? <PublicHeader /> : null;
}
