export const SITE_TESTING_DOMAIN = 'rolink.site';

export function isSiteTestingAuthHost(hostname: string) {
    return hostname === SITE_TESTING_DOMAIN || hostname === `www.${SITE_TESTING_DOMAIN}`;
}
