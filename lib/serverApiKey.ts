function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function summarizeKey(key: string | null) {
    if (!key) {
        return null;
    }

    return {
        prefix: key.slice(0, 6),
        length: key.length,
    };
}

export type ServerApiKeyDetails = {
    key: string | null;
    source: 'x-api-key' | 'authorization-bearer' | 'authorization-raw' | 'missing';
    hasXApiKey: boolean;
    hasAuthorization: boolean;
    queryKeyNames: string[];
    summary: {
        prefix: string;
        length: number;
    } | null;
};

export function readServerApiKeyDetails(req: Request, _bodyKey?: unknown): ServerApiKeyDetails {
    const directApiKey = trimString(req.headers.get('x-api-key'));
    const authorizationHeader = trimString(req.headers.get('authorization'));
    const url = new URL(req.url);
    const queryCandidates = ['apiKey', 'key', 'serverKey', 'securityKey'];
    const queryKeyNames = queryCandidates.filter((name) => trimString(url.searchParams.get(name)) !== '');

    if (directApiKey) {
        return {
            key: directApiKey,
            source: 'x-api-key',
            hasXApiKey: true,
            hasAuthorization: authorizationHeader !== '',
            queryKeyNames,
            summary: summarizeKey(directApiKey),
        };
    }

    if (authorizationHeader.toLowerCase().startsWith('bearer ')) {
        const bearerToken = trimString(authorizationHeader.slice('Bearer '.length));
        if (bearerToken) {
            return {
                key: bearerToken,
                source: 'authorization-bearer',
                hasXApiKey: false,
                hasAuthorization: true,
                queryKeyNames,
                summary: summarizeKey(bearerToken),
            };
        }
    } else if (authorizationHeader) {
        return {
            key: authorizationHeader,
            source: 'authorization-raw',
            hasXApiKey: false,
            hasAuthorization: true,
            queryKeyNames,
            summary: summarizeKey(authorizationHeader),
        };
    }

    // Never accept secrets in URLs or request bodies: both are commonly
    // retained by browser, CDN, proxy, and application logs.

    return {
        key: null,
        source: 'missing',
        hasXApiKey: false,
        hasAuthorization: authorizationHeader !== '',
        queryKeyNames,
        summary: null,
    };
}

export function readServerApiKey(req: Request, bodyKey?: unknown) {
    return readServerApiKeyDetails(req, bodyKey).key;
}

export function describeServerApiKeyDetails(details: ServerApiKeyDetails) {
    return {
        source: details.source,
        hasXApiKey: details.hasXApiKey,
        hasAuthorization: details.hasAuthorization,
        queryKeyNames: details.queryKeyNames,
        summary: details.summary,
    };
}
