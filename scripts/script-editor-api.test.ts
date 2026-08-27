import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { luauLanguageSuggestions } from '../lib/luauLanguageSuggestions';

type Member = { n: string; k: string; s: string };
type Namespace = { n: string; m: Member[] };
type Metadata = { sources: string[]; globals: Member[]; libraries: Namespace[]; dataTypes: Namespace[] };

const metadata = JSON.parse(readFileSync(new URL('../public/data/roblox-script-api.min.json', import.meta.url), 'utf8')) as Metadata;

function namespace(collection: Namespace[], name: string) {
    const result = collection.find((entry) => entry.n === name);
    assert.ok(result, `Expected ${name} metadata`);
    return result;
}

function hasMembers(collection: Namespace[], name: string, expected: string[]) {
    const names = new Set(namespace(collection, name).m.map((member) => member.n));
    for (const member of expected) assert.ok(names.has(member), `Expected ${name}.${member}`);
}

test('catalog includes all documented Roblox script API groups', () => {
    assert.equal(metadata.globals.length, 50);
    assert.equal(metadata.libraries.length, 11);
    assert.equal(metadata.dataTypes.length, 48);
    assert.ok(metadata.sources.includes('https://luau.org/library/'));
});

test('catalog covers modern Luau and Roblox globals and libraries', () => {
    const globals = new Set(metadata.globals.map((member) => member.n));
    for (const name of ['assert', 'require', 'select', 'typeof', 'warn', 'xpcall']) assert.ok(globals.has(name), `Expected global ${name}`);
    hasMembers(metadata.libraries, 'buffer', ['create', 'readbits', 'writebits']);
    hasMembers(metadata.libraries, 'math', ['clamp', 'lerp', 'map', 'round']);
    hasMembers(metadata.libraries, 'string', ['split', 'pack', 'unpack']);
    hasMembers(metadata.libraries, 'table', ['clear', 'clone', 'create', 'freeze', 'isfrozen']);
    hasMembers(metadata.libraries, 'task', ['cancel', 'desynchronize', 'synchronize']);
    hasMembers(metadata.libraries, 'utf8', ['codes', 'graphemes', 'nfcnormalize']);
    hasMembers(metadata.libraries, 'vector', ['angle', 'ceil', 'floor', 'sign']);
});

test('catalog exposes Roblox data type constructors, properties, and methods', () => {
    hasMembers(metadata.dataTypes, 'Content', ['fromAssetId', 'fromObject', 'fromUri']);
    hasMembers(metadata.dataTypes, 'Instance', ['new', 'fromExisting']);
    hasMembers(metadata.dataTypes, 'SharedTable', ['new', 'clone', 'increment', 'update']);
    hasMembers(metadata.dataTypes, 'Vector3', ['new', 'zero', 'Angle', 'Lerp']);
    for (const dataType of metadata.dataTypes) {
        assert.ok(dataType.m.every((member) => !member.n.includes('.') && !member.n.includes(':')), `${dataType.n} contains a qualified completion label`);
    }
});

test('language suggestions include statements, loops, keywords, and literal values', () => {
    const labels = new Set(luauLanguageSuggestions.map((suggestion) => suggestion.label));
    for (const label of ['local', 'local function', 'if', 'for … in', 'for … in pairs', 'for … in ipairs', 'for i = …', 'while', 'repeat … until', 'in', 'true', 'false', 'nil']) {
        assert.ok(labels.has(label), `Expected Luau suggestion ${label}`);
    }
    assert.ok(luauLanguageSuggestions.find((suggestion) => suggestion.label === 'for … in pairs')?.insertText.includes('pairs('));
});
