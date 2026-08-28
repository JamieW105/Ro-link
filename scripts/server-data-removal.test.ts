import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteServerData } from '../lib/serverDataRemoval';

function createMockClient(options: {
    remainingServer?: { id: string } | null;
    deleteErrorTable?: string;
} = {}) {
    const operations: string[] = [];

    const client = {
        from(table: string) {
            return {
                delete() {
                    return {
                        eq(column: string, value: string) {
                            operations.push(`delete:${table}:${column}:${value}`);
                            return Promise.resolve({
                                error: options.deleteErrorTable === table
                                    ? { message: `Could not delete ${table}` }
                                    : null,
                            });
                        },
                    };
                },
                select(columns: string) {
                    return {
                        eq(column: string, value: string) {
                            return {
                                maybeSingle() {
                                    operations.push(`verify:${table}:${columns}:${column}:${value}`);
                                    return Promise.resolve({
                                        data: options.remainingServer ?? null,
                                        error: null,
                                    });
                                },
                            };
                        },
                    };
                },
            };
        },
    };

    return { client, operations };
}

test('deletes server child data, the server record, and verifies removal', async () => {
    const { client, operations } = createMockClient();

    await deleteServerData('123', client);

    assert.deepEqual(operations, [
        'delete:logs:server_id:123',
        'delete:live_servers:server_id:123',
        'delete:command_queue:server_id:123',
        'delete:dashboard_roles:server_id:123',
        'delete:reports:server_id:123',
        'delete:server_addon_modules:server_id:123',
        'delete:server_custom_modules:server_id:123',
        'delete:servers:id:123',
        'verify:servers:id:id:123',
    ]);
});

test('fails when a child table cannot be cleaned up', async () => {
    const { client, operations } = createMockClient({ deleteErrorTable: 'command_queue' });

    await assert.rejects(
        deleteServerData('123', client),
        /Failed to delete command_queue: Could not delete command_queue/,
    );
    assert.equal(operations.some((operation) => operation.startsWith('delete:servers:')), false);
});

test('fails when the server record remains after deletion', async () => {
    const { client } = createMockClient({ remainingServer: { id: '123' } });

    await assert.rejects(
        deleteServerData('123', client),
        /the server record still exists/,
    );
});
