import assert from 'node:assert/strict';
import test from 'node:test';
import { searchRobloxUsers } from '../lib/robloxUserSearch';

test('Roblox search shares concurrent requests and caches normalized queries', async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        calls++;
        return Response.json({ data: [{ id: 123, name: 'Example' }] });
    });
    const [first, second] = await Promise.all([searchRobloxUsers('Example'), searchRobloxUsers('@EXAMPLE')]);
    assert.deepEqual(first, { users: [{ id: 123, name: 'Example' }], unavailable: false });
    assert.deepEqual(second, first);
    assert.deepEqual(await searchRobloxUsers('example'), first);
    assert.equal(calls, 1);
});

test('short queries do not call Roblox', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected fetch'); });
    assert.deepEqual(await searchRobloxUsers('a'), { users: [], unavailable: false });
    assert.equal(fetch.mock.callCount(), 0);
});

test('rejections, malformed responses, and network failures return controlled unavailable results', async (t) => {
    const unavailable = { users: [], unavailable: true };
    for (const status of [400, 403, 500]) {
        t.mock.method(globalThis, 'fetch', async () => new Response('', { status }));
        assert.deepEqual(await searchRobloxUsers(`error${status}`), unavailable);
    }
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable'); });
    assert.deepEqual(await searchRobloxUsers('network'), unavailable);
    t.mock.method(globalThis, 'fetch', async () => Response.json({ unexpected: [] }));
    assert.deepEqual(await searchRobloxUsers('malformed'), unavailable);
});

test('rate limits back off across queries and recover after Retry-After', async (t) => {
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        calls++;
        return calls === 1
            ? new Response('', { status: 429, headers: { 'Retry-After': '10' } })
            : Response.json({ data: [{ id: 456, name: 'Recovered' }] });
    });
    assert.equal((await searchRobloxUsers('limited')).unavailable, true);
    assert.equal((await searchRobloxUsers('other-query')).unavailable, true);
    assert.equal(calls, 1);
    now += 10_001;
    assert.equal((await searchRobloxUsers('other-query')).unavailable, false);
    assert.equal(calls, 2);
});
