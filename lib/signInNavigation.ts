export function getCanonicalSignInUrl(currentOrigin: string, authOrigin: string | undefined, callbackUrl: string, error?: string, allowRootAlias = false) {
    if (!authOrigin || authOrigin === currentOrigin) return null;
    const current = new URL(currentOrigin);
    const canonical = new URL(authOrigin);
    // Hosting may redirect the apex to www (or vice versa). NextAuth on
    // Vercel uses the actual host for its OAuth callback, so stay on either
    // root alias rather than sending the browser into a redirect loop.
    if (allowRootAlias && current.protocol === canonical.protocol && current.port === canonical.port
        && (current.hostname === `www.${canonical.hostname}` || canonical.hostname === `www.${current.hostname}`)) {
        return null;
    }
    const nextUrl = new URL('/auth/signin', authOrigin);
    nextUrl.searchParams.set('callbackUrl', new URL(callbackUrl, currentOrigin).href);
    if (error) nextUrl.searchParams.set('error', error);
    return nextUrl.href;
}
