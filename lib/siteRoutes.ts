export const PUBLIC_ROUTE_PREFIXES = [
    '/auth/signin',
    '/careers',
    '/custom-dashboard',
    '/dgsu',
    '/docs',
    '/features',
    '/posts',
    '/privacy',
    '/report',
    '/terms',
    '/verify',
];

export function isPublicSiteRoute(pathname: string) {
    if (pathname === '/') return true;

    return PUBLIC_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isPublicHeaderRoute(pathname: string) {
    return isPublicSiteRoute(pathname) && pathname !== '/docs' && !pathname.startsWith('/docs/');
}
