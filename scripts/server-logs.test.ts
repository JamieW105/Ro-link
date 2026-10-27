import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { PGlite } from '@electric-sql/pglite';
import { excludeManagementLogs } from '../lib/serverLogs';

test('server log queries exclude linked and legacy management actions before pagination', async (t) => {
    const database = new PGlite();
    t.after(() => database.close());
    await database.exec(`
        CREATE TABLE logs (
            id integer, server_id text, action text, moderator text,
            moderation_action_id text, timestamp integer
        );
        INSERT INTO logs VALUES
            (1, 'server', 'BAN', 'staff', NULL, 1),
            (2, 'server', 'KICK', 'staff', NULL, 2),
            (3, 'other', 'WARN', 'staff', NULL, 3),
            (4, 'server', 'RO_LINK_REMOVED', 'staff', NULL, 4),
            (5, 'server', 'RO_LINK_BLOCKED', 'staff', NULL, 5),
            (6, 'server', 'RO_LINK_REMOVED', 'staff', 'removal', 6),
            (7, 'server', 'RO_LINK_BLOCKED', 'staff', 'block', 7),
            (8, 'server', 'FUTURE_STAFF_ACTION', 'staff', 'future', 8);
    `);

    const client = createClient('https://logs.example.test', 'test-key', {
        global: {
            fetch: async (input) => {
                const params = new URL(String(input)).searchParams;
                assert.equal(params.get('moderation_action_id'), 'is.null');
                assert.equal(params.get('action'), 'not.in.(RO_LINK_REMOVED,RO_LINK_BLOCKED)');
                const excludedActions = params.get('action')!.slice('not.in.('.length, -1).split(',');
                const serverId = params.get('server_id')?.slice('eq.'.length) ?? null;
                const moderator = params.get('moderator')?.slice('eq.'.length) ?? null;
                const result = await database.query(`
                    SELECT id FROM logs
                    WHERE moderation_action_id IS NULL
                        AND action <> ALL($1::text[])
                        AND ($2::text IS NULL OR server_id = $2)
                        AND ($3::text IS NULL OR moderator = $3)
                    ORDER BY timestamp DESC LIMIT $4
                `, [excludedActions, serverId, moderator, Number(params.get('limit') || 100)]);
                return new Response(JSON.stringify(result.rows), {
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        },
    });

    const serverLogs = await excludeManagementLogs(client.from('logs').select('*'))
        .eq('server_id', 'server').order('timestamp', { ascending: false }).limit(2);
    assert.equal(serverLogs.error, null);
    assert.deepEqual(serverLogs.data, [{ id: 2 }, { id: 1 }]);

    const staffHistory = await excludeManagementLogs(client.from('logs').select('*'))
        .eq('moderator', 'staff').order('timestamp', { ascending: false }).limit(3);
    assert.equal(staffHistory.error, null);
    assert.deepEqual(staffHistory.data, [{ id: 3 }, { id: 2 }, { id: 1 }]);
});
