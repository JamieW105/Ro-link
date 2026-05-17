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

function normalizeRootDomain(domain: string) {
    return domain
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^wildcard\./, '');
}

export function getRolinkRootDomains() {
    const configured = process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAINS
        || process.env.NEXT_PUBLIC_ROLINK_ROOT_DOMAIN
        || DEFAULT_ROLINK_ROOT_DOMAIN;

    const domains = configured
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean)
        .map(normalizeRootDomain);

    const automaticDomains = [
        readHostname(process.env.NEXTAUTH_URL),
        readHostname(process.env.NEXT_PUBLIC_BASE_URL),
        readHostname(process.env.VERCEL_PROJECT_PRODUCTION_URL),
        readHostname(process.env.VERCEL_URL),
    ].filter((domain): domain is string => Boolean(domain))
        .map(normalizeRootDomain);

    const explicitDomains = domains.length > 0 ? domains : [DEFAULT_ROLINK_ROOT_DOMAIN];

    return Array.from(new Set([
        ...explicitDomains,
        DEFAULT_ROLINK_ROOT_DOMAIN,
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

export function resolveDashboardSubdomainFromHostname(hostnameInput: unknown) {
    const hostname = String(hostnameInput || '').split(':')[0].trim().toLowerCase();
    if (!hostname) return null;

    for (const rootDomain of getRolinkRootDomains()) {
        if (hostname === rootDomain) return null;
        if (!hostname.endsWith(`.${rootDomain}`)) continue;

        const subdomain = hostname.slice(0, -`.${rootDomain}`.length);
        if (!subdomain || subdomain.includes('.')) return null;
        return subdomain;
    }

    return null;
}

function readForwardedHostValues(value: unknown) {
    const header = String(value || '').trim();
    if (!header) return [];

    return header
        .split(',')
        .map((entry) => entry
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.toLowerCase().startsWith('host=')))
        .filter((part): part is string => Boolean(part))
        .map((part) => part.slice(part.indexOf('=') + 1).trim().replace(/^"|"$/g, ''));
}

function readHostnameCandidate(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    return readHostname(raw) || raw.split(':')[0].toLowerCase();
}

export function resolveDashboardSubdomainFromHostnameCandidates(...hostnameInputs: unknown[]) {
    const seen = new Set<string>();

    for (const input of hostnameInputs) {
        const values = readForwardedHostValues(input);
        if (values.length === 0) {
            values.push(...String(input || '').split(','));
        }

        for (const value of values) {
            const hostname = readHostnameCandidate(value);
            if (!hostname || seen.has(hostname)) continue;

            seen.add(hostname);

            const subdomain = resolveDashboardSubdomainFromHostname(hostname);
            if (subdomain) {
                return { hostname, subdomain };
            }
        }
    }

    return null;
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
