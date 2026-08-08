import assert from 'node:assert/strict';
import test from 'node:test';

import { buildModuleProjectPackage, normalizeModuleProjectPath, validateModuleProject, type ModuleProjectFile, type ModuleProjectManifest } from '../lib/moduleIde';
import { validateBridgeEvent } from '../lib/moduleStudioBridge';
import { validateModuleUiTree } from '../lib/moduleUiSchema';

const manifest: ModuleProjectManifest = {
    formatVersion: 2,
    name: 'Regression Module',
    version: '1.2.3',
    description: 'Fixture',
    requiredRuntimeVersion: '2.2.0',
    entrypoints: { server: 'Server/Main.server.luau', client: 'Client/Main.client.luau' },
    capabilities: [],
    dependencies: {},
};

const files: ModuleProjectFile[] = [
    { id: '1', path: 'Server/Main.server.luau', name: 'Main.server.luau', kind: 'server_script', sourceCode: 'return {}', uiTree: null, revision: 2, createdAt: '', updatedAt: '' },
    { id: '2', path: 'Client/Main.client.luau', name: 'Main.client.luau', kind: 'client_script', sourceCode: 'return {}', uiTree: null, revision: 3, createdAt: '', updatedAt: '' },
];

test('project paths reject traversal and preserve canonical project paths', () => {
    assert.equal(normalizeModuleProjectPath('Server/Main.server.luau'), 'Server/Main.server.luau');
    assert.equal(normalizeModuleProjectPath('../Server/Main.server.luau'), null);
    assert.equal(normalizeModuleProjectPath('Server//Main.server.luau'), null);
    assert.equal(normalizeModuleProjectPath('/Server/Main.server.luau'), null);
});

test('project validation detects missing entrypoints and invalid remotes', () => {
    const problems = validateModuleProject({
        manifest: { ...manifest, entrypoints: { server: 'Server/Missing.server.luau' } },
        files,
        remotes: [
            { id: '1', name: 'bad name', remoteType: 'event', direction: 'bidirectional', schema: {} },
            { id: '2', name: 'BAD NAME', remoteType: 'function', direction: 'client_to_server', schema: {} },
        ],
    });
    assert.ok(problems.some((problem) => problem.code === 'missing_entrypoint'));
    assert.ok(problems.some((problem) => problem.code === 'invalid_remote_name'));
    assert.ok(problems.some((problem) => problem.code === 'duplicate_remote'));
});

test('UI validation accepts serialized whitelisted instances and blocks scripts', () => {
    const valid = validateModuleUiTree({ className: 'ScreenGui', name: 'AdminGui', properties: { DisplayOrder: 5 }, attributes: {}, children: [{ className: 'Frame', name: 'Root', properties: { BackgroundColor3: { type: 'Color3', r: 0, g: 0.5, b: 1 } }, attributes: {}, children: [] }] }, 'UI/AdminGui');
    assert.equal(valid.length, 0);
    const invalid = validateModuleUiTree({ className: 'LocalScript', name: 'Injected', properties: {}, children: [] }, 'UI/Injected');
    assert.ok(invalid.some((problem) => problem.code === 'unsupported_ui_class'));
});

test('package hash and ordering are deterministic', () => {
    const base = {
        module: { id: 'module-id', slug: 'regression', name: 'Regression Module', version: '1.2.3' },
        project: { manifest, requiredRuntimeVersion: '2.2.0', revision: 9 },
        files,
        remotes: [
            { id: '2', name: 'Zulu', remoteType: 'event' as const, direction: 'bidirectional' as const, schema: {} },
            { id: '1', name: 'Alpha', remoteType: 'function' as const, direction: 'client_to_server' as const, schema: { type: 'object' } },
        ],
    };
    const first = buildModuleProjectPackage(base as never);
    const second = buildModuleProjectPackage({ ...base, files: [...files].reverse(), remotes: [...base.remotes].reverse() } as never);
    assert.equal(first.packageHash, second.packageHash);
    assert.deepEqual(first.packagePayload.files.map((file) => file.path), ['Client/Main.client.luau', 'Server/Main.server.luau']);
    assert.deepEqual(first.packagePayload.remotes.map((remote) => remote.name), ['Alpha', 'Zulu']);
});

test('Studio bridge accepts known events and rejects unknown or oversized payloads', () => {
    assert.equal(validateBridgeEvent({ type: 'script.request', requestId: '1', payload: { instanceId: 'abc' } }).type, 'script.request');
    assert.throws(() => validateBridgeEvent({ type: 'database.secret', payload: {} }), /Unsupported Studio event type/);
    assert.throws(() => validateBridgeEvent({ type: 'sync.error', payload: { message: 'x'.repeat(513 * 1024) } }), /too large/);
});
