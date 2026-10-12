import { getRolinkRootDomains } from './customDashboardDomains';

export function getCanonicalAuthOrigin(callbackUrl?: string) {
    // Use the same origin as NextAuth/Discord's registered callback. Inferring
    // an apex from the destination can disagree with a configured www host.
    const configured = process.env.NEXTAUTH_URL?.trim()
        || process.env.NEXT_PUBLIC_AUTH_BASE_URL?.trim()
        || process.env.NEXT_PUBLIC_CANONICAL_AUTH_URL?.trim();
    if (!configured) {
        // Preserve the custom-dashboard handoff when no auth URL is set.
        try {
            const callback = new URL(callbackUrl || '');
            if (!['http:', 'https:'].includes(callback.protocol)) return undefined;
            const root = getRolinkRootDomains().find((domain) => (
                callback.hostname === domain || callback.hostname.endsWith(`.${domain}`)
            ));
            return root ? `${callback.protocol}//${root}` : undefined;
        } catch {
            return undefined;
        }
    }

    try {
        const url = new URL(configured);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
        return url.origin;
    } catch {
        return undefined;
    }
}
