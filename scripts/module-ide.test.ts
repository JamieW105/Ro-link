import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildModuleProjectPackage, normalizeModuleProjectPath, normalizeModuleScriptPath, validateModuleProject, type ModuleProjectFile, type ModuleProjectManifest } from '../lib/moduleIde';
import { MODULE_CATEGORIES, parseModuleCategory } from '../lib/moduleCategories';
import { validateBridgeEvent } from '../lib/moduleStudioBridge';
import { validateModuleUiTree } from '../lib/moduleUiSchema';
import { canCreatorUseUnpublishedModule, normalizeAddonModule } from '../lib/modules';
import { canRestoreApprovedModuleVersion, getModulePackageServerSource, getModuleVersionKey } from '../lib/moduleApprovedVersion';
import { getNewModuleScriptSource, isModuleIdeVisibleFile } from '../lib/moduleFileRules';
import { compareModuleVersions, isModuleVersionGreater, MODULE_VERSION_PATTERN, suggestNextModuleVersion } from '../lib/moduleVersions';

const manifest: ModuleProjectManifest = {
    formatVersion: 2,
    name: 'Regression Module',
    version: '1.2.3',
    description: 'Fixture',
    requiredRuntimeVersion: '2.2.0',
    entrypoints: { server: 'Server/Main.server', client: 'Client/Main.client' },
    capabilities: [],
    dependencies: {},
};

const files: ModuleProjectFile[] = [
    { id: '1', path: 'Server/Main.server', name: 'Main.server', kind: 'server_script', sourceCode: '', uiTree: null, revision: 2, createdAt: '', updatedAt: '' },
    { id: '2', path: 'Client/Main.client', name: 'Main.client', kind: 'client_script', sourceCode: '', uiTree: null, revision: 3, createdAt: '', updatedAt: '' },
    { id: '3', path: 'Shared/Main.module', name: 'Main.module', kind: 'shared_module', sourceCode: 'local module = {}\n\nreturn module\n', uiTree: null, revision: 1, createdAt: '', updatedAt: '' },
];

test('project paths reject traversal and preserve canonical project paths', () => {
    assert.equal(normalizeModuleProjectPath('Server/Main.server.luau'), 'Server/Main.server.luau');
    assert.equal(normalizeModuleProjectPath('../Server/Main.server.luau'), null);
    assert.equal(normalizeModuleProjectPath('Server//Main.server.luau'), null);
    assert.equal(normalizeModuleProjectPath('/Server/Main.server.luau'), null);
});

test('script paths use Roblox-style suffixes without .luau', () => {
    assert.equal(normalizeModuleScriptPath('Server/Main.server.luau', 'server_script'), 'Server/Main.server');
    assert.equal(normalizeModuleScriptPath('Client/Main.luau', 'client_script'), 'Client/Main.client');
    assert.equal(normalizeModuleScriptPath('Shared/Helpers.module.luau', 'shared_module'), 'Shared/Helpers.module');
});

test('new scripts are empty except for the module starter', () => {
    assert.equal(getNewModuleScriptSource('server_script'), '');
    assert.equal(getNewModuleScriptSource('client_script'), '');
    assert.equal(getNewModuleScriptSource('shared_module'), 'local module = {}\n\nreturn module\n');
});

test('JSON metadata never appears as an IDE project file', () => {
    assert.equal(isModuleIdeVisibleFile({ kind: 'manifest', path: 'module.json' }), false);
    assert.equal(isModuleIdeVisibleFile({ kind: 'shared_module', path: 'Shared/config.json' }), false);
    assert.equal(isModuleIdeVisibleFile({ kind: 'shared_module', path: 'Shared/Config.module' }), true);
});

test('project validation detects missing entrypoints', () => {
    const problems = validateModuleProject({
        manifest: { ...manifest, entrypoints: { server: 'Server/Missing.server.luau' } },
        files,
    });
    assert.ok(problems.some((problem) => problem.code === 'missing_entrypoint'));
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
    };
    const first = buildModuleProjectPackage(base as never);
    const second = buildModuleProjectPackage({ ...base, files: [...files].reverse() } as never);
    assert.equal(first.packageHash, second.packageHash);
    assert.deepEqual(first.packagePayload.files.map((file) => file.path), ['Client/Main.client', 'Server/Main.server', 'Shared/Main.module']);
    assert.equal('remotes' in first.packagePayload, false);
});

test('Studio bridge accepts known events and rejects unknown or oversized payloads', () => {
    assert.equal(validateBridgeEvent({ type: 'script.request', requestId: '1', payload: { instanceId: 'abc' } }).type, 'script.request');
    assert.throws(() => validateBridgeEvent({ type: 'database.secret', payload: {} }), /Unsupported Studio event type/);
    assert.throws(() => validateBridgeEvent({ type: 'sync.error', payload: { message: 'x'.repeat(513 * 1024) } }), /too large/);
});

test('module updates require a numerically greater version and allow leading-zero increments', () => {
    assert.equal(MODULE_VERSION_PATTERN.test('1.0.01'), true);
    assert.equal(isModuleVersionGreater('1.0.01', '1.0.0'), true);
    assert.equal(isModuleVersionGreater('1.0.1', '1.0.01'), false);
    assert.equal(isModuleVersionGreater('1.1.0', '1.0.999'), true);
    assert.equal(compareModuleVersions('2.0.0', '1.999.999'), 1);
    assert.equal(suggestNextModuleVersion('1.0.0'), '1.0.1');
});

test('denied modules remain private testable projects for their uploader', () => {
    assert.equal(canCreatorUseUnpublishedModule('REJECTED', 'creator-1', 'creator-1'), true);
    assert.equal(canCreatorUseUnpublishedModule('REJECTED', 'creator-1', 'someone-else'), false);
    assert.equal(canCreatorUseUnpublishedModule('ARCHIVED', 'creator-1', 'creator-1'), false);
});

test('marketplace visibility only restores an approved release package', () => {
    assert.equal(canRestoreApprovedModuleVersion({ status: 'DRAFT', publishedAt: '2026-08-01', reviewedAt: '2026-08-01' }), true);
    assert.equal(canRestoreApprovedModuleVersion({ status: 'PENDING_REVIEW', publishedAt: '2026-08-01', reviewedAt: '2026-08-01' }), false);
    assert.equal(canRestoreApprovedModuleVersion({ status: 'DRAFT', publishedAt: null, reviewedAt: null }), false);
    assert.notEqual(getModuleVersionKey('module-1', '1.0.0'), getModuleVersionKey('module-1', '1.1.0'));
    assert.equal(getModulePackageServerSource({
        entrypoints: { server: 'Server/Main.server.luau' },
        files: [
            { path: 'Server/Old.server.luau', sourceCode: 'return "old"' },
            { path: 'Server/Main.server.luau', sourceCode: 'return "approved"' },
        ],
    }), 'return "approved"');
});

test('module thumbnails preserve legacy images and cap galleries at five', () => {
    const legacy = normalizeAddonModule({ thumbnail_url: 'https://example.com/legacy.png' });
    assert.equal(legacy?.thumbnailUrl, 'https://example.com/legacy.png');
    assert.deepEqual(legacy?.thumbnailUrls, ['https://example.com/legacy.png']);

    const gallery = normalizeAddonModule({
        thumbnail_url: 'https://example.com/legacy.png',
        thumbnail_urls: Array.from({ length: 6 }, (_, index) => `https://example.com/${index + 1}.png`),
    });
    assert.equal(gallery?.thumbnailUrl, 'https://example.com/1.png');
    assert.equal(gallery?.thumbnailUrls.length, 5);
});

test('module categories expose the creator choices and reject unknown values', () => {
    assert.deepEqual(MODULE_CATEGORIES, ['General', 'Moderation', 'Misc', 'Fun', 'Troll']);
    assert.equal(parseModuleCategory('Moderation'), 'Moderation');
    assert.equal(parseModuleCategory('Unknown'), null);
});

test('Studio runtime uses the shared Module API instead of project remotes', () => {
    const source = readFileSync(new URL('../roblox/ModuleIDEPlugin/PluginMain.luau', import.meta.url), 'utf8');
    assert.match(source, /CallClient = function\(targetModuleId: string, user: Player, \.\.\.: any\)/);
    assert.match(source, /CallServer = function\(targetModuleId: string, \.\.\.: any\)/);
    assert.match(source, /definition\.CallClient/);
    assert.match(source, /definition\.CallServer/);
    assert.doesNotMatch(source, /projectPackage\.remotes/);
    assert.doesNotMatch(source, /FindFirstChild\("Remotes"\)/);
});
