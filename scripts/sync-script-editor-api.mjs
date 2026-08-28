import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parse } from 'yaml';

const owner = 'Roblox';
const repository = 'creator-docs';
const docsRoot = 'content/en-us/reference/engine';
const outputPath = resolve('public/data/roblox-script-api.min.json');
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Ro-Link Script Editor API sync' };

async function fetchJson(url) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
    return response.json();
}

async function fetchText(url) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
    return response.text();
}

function cleanText(value) {
    return String(value || '')
        .replace(/\[([^\]]+)]\([^\)]+\)/g, '$1')
        .replace(/`(?:Class|Datatype|Enum|Global|Library)\.([^`]+)`/g, '`$1`')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeParameters(parameters) {
    return (parameters || []).map((parameter) => ({
        n: parameter.name === '...' ? '...' : String(parameter.name || 'value'),
        t: String(parameter.type || 'any'),
        ...(parameter.default !== undefined && parameter.default !== null && parameter.default !== '' ? { v: String(parameter.default) } : {}),
    }));
}

function normalizeMember(item, kind, ownerName) {
    const fullName = String(item.name || '');
    const dotPrefix = `${ownerName}.`;
    const colonPrefix = `${ownerName}:`;
    const name = fullName.startsWith(dotPrefix)
        ? fullName.slice(dotPrefix.length)
        : fullName.startsWith(colonPrefix) ? fullName.slice(colonPrefix.length) : fullName;
    const parameters = normalizeParameters(item.parameters);
    const returns = (item.returns || []).map((entry) => String(entry.type || 'any'));
    const signature = kind === 'property'
        ? `${fullName}: ${item.type || 'any'}`
        : `${fullName}(${parameters.map((parameter) => `${parameter.n}: ${parameter.t}`).join(', ')}): ${returns.length ? returns.join(', ') : '()'}`;
    return {
        n: name,
        k: kind,
        s: signature,
        ...(parameters.length ? { p: parameters } : {}),
        ...(returns.length ? { r: returns } : {}),
        ...(cleanText(item.summary) ? { d: cleanText(item.summary) } : {}),
        ...(item.tags?.length ? { tg: item.tags.map(String) } : {}),
    };
}

function mergeOverloads(members) {
    const merged = new Map();
    for (const member of members) {
        const key = `${member.k}:${member.n}`;
        const current = merged.get(key);
        if (!current) {
            merged.set(key, member);
            continue;
        }
        const signatures = new Set([...(current.o || [current.s]), member.s]);
        current.o = [...signatures];
        current.s = current.o.join('\n');
    }
    return [...merged.values()];
}

function normalizeDocument(document) {
    const ownerName = String(document.name || '');
    const members = [
        ...(document.constructors || []).map((item) => normalizeMember(item, 'constructor', ownerName)),
        ...(document.properties || []).map((item) => normalizeMember(item, 'property', ownerName)),
        ...(document.functions || []).map((item) => normalizeMember(item, 'function', ownerName)),
        ...(document.methods || []).map((item) => normalizeMember(item, 'method', ownerName)),
        ...(document.events || []).map((item) => normalizeMember(item, 'event', ownerName)),
        ...(document.callbacks || []).map((item) => normalizeMember(item, 'callback', ownerName)),
    ];
    return {
        n: ownerName,
        ...(cleanText(document.summary) ? { d: cleanText(document.summary) } : {}),
        m: mergeOverloads(members),
    };
}

async function loadDirectory(directory, revision) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repository}/contents/${docsRoot}/${directory}?ref=${revision}`;
    const entries = await fetchJson(apiUrl);
    const yamlFiles = entries.filter((entry) => entry.type === 'file' && entry.name.endsWith('.yaml'));
    return Promise.all(yamlFiles.map(async (entry) => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repository}/${revision}/${docsRoot}/${directory}/${entry.name}`;
        return normalizeDocument(parse(await fetchText(rawUrl)));
    }));
}

const branch = await fetchJson(`https://api.github.com/repos/${owner}/${repository}/branches/main`);
const revision = branch.commit.sha;
const [globalDocuments, libraries, dataTypes] = await Promise.all([
    loadDirectory('globals', revision),
    loadDirectory('libraries', revision),
    loadDirectory('datatypes', revision),
]);

const globals = mergeOverloads(globalDocuments.flatMap((document) => document.m));
const metadata = {
    version: 1,
    generatedAt: new Date().toISOString(),
    revision,
    sources: [
        'https://luau.org/library/',
        'https://create.roblox.com/docs/reference/engine/globals/LuaGlobals',
        'https://create.roblox.com/docs/reference/engine/globals/RobloxGlobals',
        'https://create.roblox.com/docs/reference/engine/libraries',
        'https://create.roblox.com/docs/reference/engine/datatypes',
    ],
    globals,
    libraries: libraries.sort((a, b) => a.n.localeCompare(b.n)),
    dataTypes: dataTypes.sort((a, b) => a.n.localeCompare(b.n)),
};

await writeFile(outputPath, JSON.stringify(metadata));
console.log(`Wrote ${outputPath} (${globals.length} globals, ${libraries.length} libraries, ${dataTypes.length} data types) from creator-docs@${revision.slice(0, 12)}.`);
