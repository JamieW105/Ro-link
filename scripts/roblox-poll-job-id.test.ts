import assert from 'node:assert/strict';
import test from 'node:test';

import { readRobloxPollJobId } from '../lib/robloxPollJobId';

test('uses the same normalized JobId for current and legacy heartbeat fields', () => {
    for (const field of ['jobId', 'job_id', 'JobId']) {
        assert.equal(readRobloxPollJobId({ [field]: ' instance-a ' }, new Headers()), 'instance-a');
    }
});

test('prefers the current body field and falls back after empty or invalid values', () => {
    const headers = new Headers({ 'x-roblox-job-id': 'instance-from-header' });
    assert.equal(readRobloxPollJobId({ jobId: 'instance-a', job_id: 'instance-b' }, headers), 'instance-a');
    assert.equal(readRobloxPollJobId({ jobId: ' ', JobId: 'instance-b' }, headers), 'instance-b');
    assert.equal(readRobloxPollJobId({ jobId: null, job_id: {} }, headers), 'instance-from-header');
    assert.equal(readRobloxPollJobId({ jobId: null, playerCount: 1, players: [{}] }, new Headers()), null);
});
