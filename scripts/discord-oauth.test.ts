import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import DiscordProvider from 'next-auth/providers/discord';
import { TokenSet } from 'openid-client';
import { getDiscordOAuthConfig } from '../lib/discordOAuthConfig';

// Exercise the same provider normalization and OAuth client as NextAuth v4.
const require = createRequire(import.meta.url);
const authRoot = path.resolve(path.dirname(require.resolve('next-auth/providers/discord')), '..');
const parseProviders = require(path.join(authRoot, 'core/lib/providers.js')).default;
const { openidClient } = require(path.join(authRoot, 'core/lib/oauth/client.js'));

async function createClient() {
    const { provider } = parseProviders({
        url: 'https://preview.example.com/api/auth',
        providerId: 'discord',
        providers: [DiscordProvider({
            ...getDiscordOAuthConfig(),
            clientId: 'test-client',
            clientSecret: 'test-secret',
            authorization: { params: { scope: 'identify guilds' } },
        })],
    });
    assert.deepEqual(provider.checks, ['state']);
    assert.equal(provider.idToken, false);
    const client = await openidClient({ provider });
    let exchanges = 0;
    client.grant = async () => {
        exchanges++;
        return new TokenSet({ access_token: 'test-token', token_type: 'Bearer' });
    };
    return { client, provider, exchanges: () => exchanges };
}

for (const iss of ['https://discord.com', undefined]) {
    test(`Discord callback accepts ${iss ? 'the published issuer' : 'a legacy response without iss'}`, async () => {
        const { client, provider, exchanges } = await createClient();
        const tokens = await client.oauthCallback(provider.callbackUrl, {
            code: 'test-code', state: 'test-state', ...(iss ? { iss } : {}),
        }, { state: 'test-state' });
        assert.equal(tokens.access_token, 'test-token');
        assert.equal(exchanges(), 1);
    });
}

test('Discord callback rejects an unexpected issuer before exchanging the code', async () => {
    const { client, provider, exchanges } = await createClient();
    await assert.rejects(client.oauthCallback(provider.callbackUrl, {
        code: 'test-code', state: 'test-state', iss: 'https://unexpected.example.com',
    }, { state: 'test-state' }), /iss mismatch/);
    assert.equal(exchanges(), 0);
});

test('Discord callback still rejects a mismatched state', async () => {
    const { client, provider, exchanges } = await createClient();
    await assert.rejects(client.oauthCallback(provider.callbackUrl, {
        code: 'test-code', state: 'wrong-state', iss: 'https://discord.com',
    }, { state: 'test-state' }), /state mismatch/);
    assert.equal(exchanges(), 0);
});
