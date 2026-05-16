const DEFAULT_ROLINK_ROOT_DOMAIN = 'rolink.cloud';

function readHostname(value: string | undefined) {
    if (!value) return null;

    try {
        const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        return new URL(withProtocol).hostname.toLowerCase();
    } catch {
        return null;
    }
}

export function getRolinkRootDomains() {
    const configured = process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAINS
        || process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAIN
        || DEFAULT_ROLINK_ROOT_DOMAIN;

    const domains = configured
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean)
        .map((domain) => domain.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));

    const automaticDomains = [
        readHostname(process.env.NEXTAUTH_URL),
        readHostname(process.env.NEXT_PUBLIC_BASE_URL),
        readHostname(process.env.VERCEL_PROJECT_PRODUCTION_URL),
        readHostname(process.env.VERCEL_URL),
    ].filter((domain): domain is string => Boolean(domain));

    return Array.from(new Set([
        ...(domains.length > 0 ? domains : [DEFAULT_ROLINK_ROOT_DOMAIN]),
        ...automaticDomains,
    ]));
}

export function getPrimaryRolinkRootDomain() {
    return getRolinkRootDomains()[0] || DEFAULT_ROLINK_ROOT_DOMAIN;
}

export function buildDashboardHostname(subdomain: string, rootDomain = getPrimaryRolinkRootDomain()) {
    return `${subdomain}.${rootDomain}`;
}

export function isAllowedDashboardUrl(input: unknown) {
    try {
        const url = new URL(String(input || ''));
        if (!['http:', 'https:'].includes(url.protocol)) return false;

        const hostname = url.hostname.toLowerCase();
        return getRolinkRootDomains().some((rootDomain) => (
            hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)
        ));
    } catch {
        return false;
    }
}

const RESERVED_SUBDOMAINS = new Set([
    'admin',
    'api',
    'app',
    'assets',
    'auth',
    'billing',
    'cdn',
    'dashboard',
    'docs',
    'help',
    'mail',
    'status',
    'support',
    'www',
]);

export function normalizeDashboardSubdomain(input: unknown) {
    let value = String(input || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');

    for (const rootDomain of getRolinkRootDomains()) {
        value = value.replace(new RegExp(`\\.${rootDomain.replace(/\./g, '\\.')}$`), '');
    }

    return value;
}

export function validateDashboardSubdomain(input: unknown) {
    const subdomain = normalizeDashboardSubdomain(input);

    if (!subdomain) {
        return { subdomain, error: 'Subdomain is required.' };
    }

    if (subdomain.length < 3 || subdomain.length > 63) {
        return { subdomain, error: 'Subdomain must be between 3 and 63 characters.' };
    }

    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
        return { subdomain, error: 'Use only lowercase letters, numbers, and hyphens. The name cannot start or end with a hyphen.' };
    }

    if (RESERVED_SUBDOMAINS.has(subdomain)) {
        return { subdomain, error: 'That subdomain is reserved for Ro-Link system use.' };
    }

    return { subdomain, error: null };
}
