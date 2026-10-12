import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { authOptions } from '../app/api/auth/[...nextauth]/route';

// Exercise the installed NextAuth v4 provider parser and OAuth client, rather
// than only asserting that a config string exists. No Discord requests or
// real credentials are used: token exchange goes to a local test server.
const nextAuthDirectory = dirname(require.resolve('next-auth'));
const { default: parseProviders } = require(join(nextAuthDirectory, 'core/lib/providers.js'));
const { openidClient } = require(join(nextAuthDirectory, 'core/lib/oauth/client.js'));
const callbackUrl = 'https://www.rolink.cloud/api/auth/callback/discord';
const expectedState = 'regression-state';

async function createDiscordClient(overrides: { issuer?: string; token?: { url: string } } = {}) {
    const { provider } = parseProviders({
        providers: authOptions.providers,
        url: 'https://www.rolink.cloud/api/auth',
        providerId: 'discord',
    });
    return openidClient({
        provider: {
            ...provider,
            clientId: 'regression-client',
            clientSecret: 'regression-secret',
            ...overrides,
        },
    });
}

test('reproduces the reported callback error when the expected issuer is absent', async () => {
    const client = await createDiscordClient({ issuer: undefined });
    await assert.rejects(client.oauthCallback(callbackUrl, {
        code: 'regression-code',
        state: expectedState,
        iss: 'https://discord.com',
    }, { state: expectedState }), /issuer must be configured on the issuer/);
});

test('configured Discord issuer completes token exchange with and without callback iss', async (t) => {
    const exchanges: URLSearchParams[] = [];
    const server = createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk.toString();
        exchanges.push(new URLSearchParams(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            access_token: 'regression-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
        }));
    });
    t.after(() => new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
    }));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const client = await createDiscordClient({ token: { url: `http://127.0.0.1:${address.port}/token` } });
    assert.equal(client.issuer.issuer, 'https://discord.com');

    for (const issuerParams of [{ iss: 'https://discord.com' }, {}]) {
        const tokens = await client.oauthCallback(callbackUrl, {
            code: 'regression-code',
            state: expectedState,
            ...issuerParams,
        }, { state: expectedState });
        assert.equal(tokens.access_token, 'regression-access-token');
    }
    assert.equal(exchanges.length, 2);
    for (const exchange of exchanges) {
        assert.equal(exchange.get('grant_type'), 'authorization_code');
        assert.equal(exchange.get('code'), 'regression-code');
        assert.equal(exchange.get('redirect_uri'), callbackUrl);
    }
});

test('Discord callback still rejects an unexpected issuer before token exchange', async () => {
    const client = await createDiscordClient();
    await assert.rejects(client.oauthCallback(callbackUrl, {
        code: 'regression-code',
        state: expectedState,
        iss: 'https://attacker.example',
    }, { state: expectedState }), /iss mismatch/);
});

test('Discord callback still rejects an invalid state before token exchange', async () => {
    const client = await createDiscordClient();
    await assert.rejects(client.oauthCallback(callbackUrl, {
        code: 'regression-code',
        state: 'wrong-state',
        iss: 'https://discord.com',
    }, { state: expectedState }), /state mismatch/);
});
