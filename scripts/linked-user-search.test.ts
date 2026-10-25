import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { searchLinkedUsers } from '../lib/linkedUserSearch';

test('connected account search uses stored identities and escapes username wildcards', async () => {
    const urls: URL[] = [];
    const client = createClient('https://example.supabase.co', 'test-key', { global: { fetch: async (input) => {
        urls.push(new URL(String(input)));
        return Response.json([
            { discord_id: '111', roblox_id: '222', roblox_username: 'Linked_User' },
            { discord_id: null, roblox_id: '333', roblox_username: 'Unlinked' },
        ]);
    } } });
    const users = await searchLinkedUsers(client, 'Linked_');
    assert.equal(users.length, 1);
    assert.equal(users[0].connectedDiscordId, '111');
    assert.equal(users[0].userId, '222');
    assert.equal(urls[0].searchParams.get('or'), '(roblox_username.ilike.%Linked\\_%)');
    assert.equal(urls[0].searchParams.get('limit'), '20');
    await searchLinkedUsers(client, '111');
    assert.equal(urls[1].searchParams.get('or'), '(roblox_username.ilike.%111%,roblox_id.eq.111,discord_id.eq.111)');
    assert.deepEqual(await searchLinkedUsers(client, 'a'), []);
    assert.deepEqual(await searchLinkedUsers(client, 'bad,filter'), []);
    assert.equal(urls.length, 2);
});
