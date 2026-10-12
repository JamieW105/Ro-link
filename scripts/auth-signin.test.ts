import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { getCanonicalAuthOrigin } from '../lib/authOrigin';
import { getCanonicalSignInUrl } from '../lib/signInNavigation';
import { getRequestClientIp } from '../lib/requestClientIp';
import { consumeRateLimit } from '../lib/rateLimit';
import { proxy } from '../proxy';
import { GET as dashboardSignIn } from '../app/api/auth/custom-dashboard/route';

function withEnv(values: Record<string, string | undefined>, run: () => void | Promise<void>) {
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    const restore = () => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    };
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        const result = run();
        if (result) return result.finally(restore);
        restore();
    } catch (error) {
        restore();
        throw error;
    }
}

test('Vercel visitors have independent auth limits without TRUST_PROXY_HEADERS', async () => {
    await withEnv({ VERCEL: '1', TRUST_PROXY_HEADERS: undefined, NODE_ENV: 'test' }, async () => {
        const request = (ip: string) => new NextRequest('https://www.rolink.cloud/api/auth/signin/discord', {
            method: 'POST',
            headers: { host: 'www.rolink.cloud', 'x-vercel-forwarded-for': ip },
        });
        for (let i = 0; i < 60; i += 1) {
            assert.equal((await proxy(request('192.0.2.10'))).status, 200);
        }
        const blocked = await proxy(request('192.0.2.10'));
        assert.equal(blocked.status, 429);
        assert.equal(blocked.headers.get('Retry-After'), '600');
        assert.equal((await proxy(request('192.0.2.11'))).status, 200);
    });
});

test('client IP trusts Vercel headers only on Vercel, and keeps self-hosted opt-in', async () => {
    const headers = new Headers({
        'x-vercel-forwarded-for': '192.0.2.20',
        'x-forwarded-for': '192.0.2.21, 192.0.2.22',
        'cf-connecting-ip': '192.0.2.23',
    });
    await withEnv({ VERCEL: undefined, TRUST_PROXY_HEADERS: undefined }, () => {
        assert.equal(getRequestClientIp(headers), 'direct-client');
    });
    await withEnv({ VERCEL: '1', TRUST_PROXY_HEADERS: 'true' }, () => {
        assert.equal(getRequestClientIp(headers), '192.0.2.20');
        assert.equal(getRequestClientIp(new Headers({ 'x-forwarded-for': '192.0.2.21, 192.0.2.22' })), '192.0.2.21');
    });
    await withEnv({ VERCEL: undefined, TRUST_PROXY_HEADERS: 'true' }, () => {
        assert.equal(getRequestClientIp(headers), '192.0.2.23');
    });
});

test('auth block survives the counting window and expires after its full duration', (t) => {
    let now = 1_000;
    t.mock.method(Date, 'now', () => now);
    const rule = { limit: 1, windowMs: 60_000, blockMs: 600_000 };
    assert.equal(consumeRateLimit('auth-block-duration', rule).allowed, true);
    assert.equal(consumeRateLimit('auth-block-duration', rule).allowed, false);
    now += 61_000;
    const stillBlocked = consumeRateLimit('auth-block-duration', rule);
    assert.equal(stillBlocked.allowed, false);
    assert.equal(stillBlocked.retryAfterSeconds, 539);
    now += 539_000;
    assert.equal(consumeRateLimit('auth-block-duration', rule).allowed, true);
});

test('sign-in uses NEXTAUTH_URL including www instead of inferring an apex', async () => {
    await withEnv({
        NEXTAUTH_URL: ' https://www.rolink.cloud/api/auth ',
        NEXT_PUBLIC_AUTH_BASE_URL: 'https://rolink.cloud',
    }, async () => {
        assert.equal(getCanonicalAuthOrigin(), 'https://www.rolink.cloud');
        const callback = 'https://community.rolink.cloud/dashboard/123?tab=members';
        const response = await dashboardSignIn(new Request(
            `https://community.rolink.cloud/api/auth/custom-dashboard?callbackUrl=${encodeURIComponent(callback)}`,
        ));
        const destination = new URL(response.headers.get('Location')!);
        assert.equal(destination.origin, 'https://www.rolink.cloud');
        assert.equal(destination.pathname, '/auth/signin');
        assert.equal(destination.searchParams.get('callbackUrl'), callback);
        assert.equal((await dashboardSignIn(new Request(
            'https://www.rolink.cloud/api/auth/custom-dashboard?callbackUrl=https://attacker.example',
        ))).status, 400);
    });
});

test('auth origin supports explicit fallback, localhost and absent or invalid config', async () => {
    await withEnv({ NEXTAUTH_URL: undefined, NEXT_PUBLIC_AUTH_BASE_URL: undefined, NEXT_PUBLIC_CANONICAL_AUTH_URL: undefined }, async () => {
        assert.equal(getCanonicalAuthOrigin(), undefined);
        assert.equal(getCanonicalAuthOrigin('https://community.rolink.cloud/dashboard/123'), 'https://rolink.cloud');
        assert.equal(getCanonicalAuthOrigin('https://attacker.example/dashboard'), undefined);
        process.env.NEXT_PUBLIC_CANONICAL_AUTH_URL = 'https://www.rolink.site/';
        assert.equal(getCanonicalAuthOrigin(), 'https://www.rolink.site');
        process.env.NEXTAUTH_URL = 'http://localhost:3000';
        assert.equal(getCanonicalAuthOrigin(), 'http://localhost:3000');
        process.env.NEXTAUTH_URL = 'javascript:alert(1)';
        assert.equal(getCanonicalAuthOrigin(), undefined);
        process.env.NEXTAUTH_URL = 'https://user:password@www.rolink.cloud';
        assert.equal(getCanonicalAuthOrigin(), undefined);
    });
});

test('sign-in navigation avoids www/apex loops and preserves custom dashboard destinations', () => {
    assert.equal(getCanonicalSignInUrl('https://www.rolink.cloud', 'https://rolink.cloud', '/dashboard', undefined, true), null);
    assert.equal(getCanonicalSignInUrl('https://rolink.cloud', 'https://www.rolink.cloud', '/dashboard', undefined, true), null);
    assert.equal(new URL(getCanonicalSignInUrl('https://rolink.cloud', 'https://www.rolink.cloud', '/dashboard')!).origin, 'https://www.rolink.cloud');
    assert.equal(getCanonicalSignInUrl('http://localhost:3012', undefined, '/dashboard'), null);
    const destination = new URL(getCanonicalSignInUrl(
        'https://community.rolink.cloud', 'https://www.rolink.cloud', '/dashboard/123?tab=members', 'OAuthCallback',
    )!);
    assert.equal(destination.origin, 'https://www.rolink.cloud');
    assert.equal(destination.searchParams.get('callbackUrl'), 'https://community.rolink.cloud/dashboard/123?tab=members');
    assert.equal(destination.searchParams.get('error'), 'OAuthCallback');
});
