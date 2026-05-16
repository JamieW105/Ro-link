export const ROLINK_ROOT_DOMAIN = 'rolink.cloud';

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
    return String(input || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(new RegExp(`\\.${ROLINK_ROOT_DOMAIN.replace('.', '\\.')}$`), '')
        .replace(/\/.*$/, '');
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

