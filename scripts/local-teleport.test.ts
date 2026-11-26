import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLocalTeleport } from '../lib/commandDelivery';

const liveServers = [
    { id: 'moderator-job', players: ['Moderator', 'Alice', 'Bob'] },
    { id: 'other-job', players: ['Charlie'] },
];
const actor = { moderator_roblox_username: 'moderator' };

test('Bring supports multiple targets, deduplicates them, and keeps Global and Me in the current job', () => {
    const global = resolveLocalTeleport('BRING', { ...actor, username: 'Global' }, liveServers);
    assert.deepEqual(global, {
        jobId: 'moderator-job',
        moves: [
            { username: 'Alice', moderator_roblox_username: 'Moderator' },
            { username: 'Bob', moderator_roblox_username: 'Moderator' },
        ],
    });
    assert.deepEqual(resolveLocalTeleport('BRING', { ...actor, username: '@alice, Bob ALICE' }, liveServers), global);
    assert.deepEqual(resolveLocalTeleport('BRING', { ...actor, username: 'Me' }, liveServers), {
        jobId: 'moderator-job',
        moves: [{ username: 'Moderator', moderator_roblox_username: 'Moderator' }],
    });
});

test('Bring rejects the whole selection if any target is in a different server', () => {
    const result = resolveLocalTeleport('BRING', { ...actor, usernames: ['Alice', 'Charlie'], job_id: 'other-job' }, liveServers);
    assert.ok('error' in result);
    assert.equal(result.status, 404);
});

test('To moves the moderator to one other local player and rejects special or multiple targets', () => {
    assert.deepEqual(resolveLocalTeleport('TO', { ...actor, username: 'Alice' }, liveServers), {
        jobId: 'moderator-job',
        moves: [{ username: 'Moderator', moderator_roblox_username: 'Alice' }],
    });
    for (const target of ['all', 'others', 'global', 'me', 'Alice Bob', 'Moderator', 'Charlie']) {
        assert.ok('error' in resolveLocalTeleport('TO', { ...actor, username: target }, liveServers), target);
    }
    assert.ok('error' in resolveLocalTeleport('TO', { ...actor, username: 'Alice', target_scope: 'GLOBAL' }, liveServers));
    assert.ok('error' in resolveLocalTeleport('TO', { ...actor, username: 'Alice' }, liveServers, 'other-job'));
});
