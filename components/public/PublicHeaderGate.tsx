'use client';

import { usePathname } from 'next/navigation';

import { PublicHeader } from '@/components/public/PublicHeader';

const PUBLIC_ROUTE_PREFIXES = [
    '/auth/signin',
    '/careers',
    '/custom-dashboard',
    '/dgsu',
    '/features',
    '/posts',
    '/privacy',
    '/report',
    '/terms',
    '/verify',
];

function isPublicRoute(pathname: string) {
    if (pathname === '/') return true;

    return PUBLIC_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function PublicHeaderGate() {
    const pathname = usePathname();

    return isPublicRoute(pathname) ? <PublicHeader /> : null;
}
