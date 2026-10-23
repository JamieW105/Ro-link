import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { POST as signIn } from '../app/api/auth/[...nextauth]/route';
import { GET as stats } from '../app/api/stats/route';
import { GET as banners } from '../app/api/site-banners/route';
import { getDiscordOAuthConfig, isDiscordOAuthConfigured } from '../lib/discordOAuthConfig';

function configure(t: TestContext, values: Record<string, string | undefined> = {}) {
    const defaults: Record<string, string | undefined> = {
        DISCORD_OAUTH_CLIENT_ID: undefined, DISCORD_OAUTH_CLIENT_SECRET: undefined,
        DISCORD_CLIENT_ID: undefined, DISCORD_CLIENT_SECRET: undefined,
        DISCORD_TOKEN: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined,
    };
    for (const [key, value] of Object.entries({ ...defaults, ...values })) {
        const previous = process.env[key];
        t.after(() => {
            if (previous === undefined) delete process.env[key];
            else process.env[key] = previous;
        });
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    t.mock.method(console, 'warn', () => {});
}

test('OAuth requires both credentials and supports legacy and dedicated env names', (t) => {
    configure(t);
    assert.equal(isDiscordOAuthConfigured(), false);
    process.env.DISCORD_CLIENT_ID = ' legacy-id ';
    assert.equal(isDiscordOAuthConfigured(), false);
    process.env.DISCORD_CLIENT_SECRET = ' legacy-secret ';
    assert.equal(isDiscordOAuthConfigured(), true);
    assert.deepEqual(getDiscordOAuthConfig(), { clientId: 'legacy-id', clientSecret: 'legacy-secret' });
    process.env.DISCORD_OAUTH_CLIENT_ID = ' oauth-id ';
    process.env.DISCORD_OAUTH_CLIENT_SECRET = ' oauth-secret ';
    assert.deepEqual(getDiscordOAuthConfig(), { clientId: 'oauth-id', clientSecret: 'oauth-secret' });
    process.env.DISCORD_OAUTH_CLIENT_SECRET = '  ';
    assert.equal(getDiscordOAuthConfig().clientSecret, 'legacy-secret');
});

test('unconfigured sign-in returns the configuration page for NextAuth JSON and form callers', async (t) => {
    configure(t);
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
    for (const json of [true, false]) {
        const body = new URLSearchParams({ callbackUrl: '/dashboard/123', ...(json ? { json: 'true' } : {}) });
        const response = await signIn(new NextRequest('http://localhost:3000/api/auth/signin/discord', {
            method: 'POST', body,
        }), { params: Promise.resolve({ nextauth: ['signin', 'discord'] }) });
        const destination = new URL(json ? (await response.json()).url : response.headers.get('location'));
        assert.equal(response.status, json ? 200 : 303);
        assert.equal(destination.pathname, '/auth/signin');
        assert.equal(destination.searchParams.get('error'), 'Configuration');
        assert.equal(destination.searchParams.get('callbackUrl'), '/dashboard/123');
    }
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('unconfigured public endpoints skip external calls and disable caching', async (t) => {
    configure(t);
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
    const statsResponse = await stats();
    assert.deepEqual(await statsResponse.json(), { guild_count: null, command_count: null });
    assert.equal(statsResponse.status, 200);
    const bannersResponse = await banners();
    assert.deepEqual(await bannersResponse.json(), []);
    for (const response of [statsResponse, bannersResponse]) assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(fetchMock.mock.callCount(), 0);
});

const databaseEnv = { NEXT_PUBLIC_SUPABASE_URL: 'https://runtime-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key' };

test('Discord 401 retains the working database command count', async (t) => {
    configure(t, { ...databaseEnv, DISCORD_TOKEN: 'test-only-token' });
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        if (String(input).startsWith('https://discord.com/')) return new Response(null, { status: 401 });
        return new Response(null, { headers: { 'content-range': '0-0/42' } });
    });
    const response = await stats();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { guild_count: null, command_count: 42 });
});

test('database failure retains the Discord guild count including zero', async (t) => {
    configure(t, { ...databaseEnv, DISCORD_TOKEN: 'test-only-token' });
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        if (String(input).startsWith('https://discord.com/')) return Response.json({ approximate_guild_count: 0 });
        throw new TypeError('fetch failed');
    });
    assert.deepEqual(await (await stats()).json(), { guild_count: 0, command_count: null });
    const response = await banners();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('healthy sources return their actual counts and empty banner result', async (t) => {
    configure(t, { ...databaseEnv, DISCORD_TOKEN: 'test-only-token' });
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        if (String(input).startsWith('https://discord.com/')) return Response.json({ approximate_guild_count: 12 });
        if (String(input).includes('/logs')) return new Response(null, { headers: { 'content-range': '*/0' } });
        return Response.json([]);
    });
    assert.deepEqual(await (await stats()).json(), { guild_count: 12, command_count: 0 });
    assert.deepEqual(await (await banners()).json(), []);
});
