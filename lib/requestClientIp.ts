function firstHeaderValue(value: string | null) {
    return (value || '').split(',')[0]?.trim() || '';
}

export function getRequestClientIp(headers: Headers) {
    // Vercel supplies these headers at its edge. Do not require the opt-in
    // intended for self-hosted proxies, or every visitor shares one bucket.
    if (process.env.VERCEL === '1') {
        return firstHeaderValue(headers.get('x-vercel-forwarded-for'))
            || firstHeaderValue(headers.get('x-forwarded-for'))
            || 'unknown';
    }

    if (process.env.TRUST_PROXY_HEADERS !== 'true') return 'direct-client';

    return firstHeaderValue(headers.get('cf-connecting-ip'))
        || firstHeaderValue(headers.get('x-real-ip'))
        || firstHeaderValue(headers.get('x-forwarded-for'))
        || 'unknown';
}
