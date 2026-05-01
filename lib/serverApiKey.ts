function trimString(value: unknown) {
    return String(value ?? '').trim();
}

export function readServerApiKey(req: Request) {
    const directApiKey = trimString(req.headers.get('x-api-key'));
    if (directApiKey) {
        return directApiKey;
    }

    const authorizationHeader = trimString(req.headers.get('authorization'));
    if (!authorizationHeader) {
        return null;
    }

    if (authorizationHeader.toLowerCase().startsWith('bearer ')) {
        const bearerToken = trimString(authorizationHeader.slice('Bearer '.length));
        return bearerToken || null;
    }

    return authorizationHeader || null;
}
