import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const VERSION_URL = 'https://setup.rbxcdn.com/versionQTStudio';
const outputPath = resolve('public/data/roblox-api.min.json');

const versionResponse = await fetch(VERSION_URL, { headers: { Accept: 'text/plain' } });
if (!versionResponse.ok) throw new Error(`Roblox Studio version request failed (${versionResponse.status}).`);
const version = (await versionResponse.text()).trim();
if (!/^version-[0-9a-f]+$/i.test(version)) throw new Error(`Unexpected Roblox Studio version token: ${version}`);

const dumpUrl = `https://setup.rbxcdn.com/${version}-API-Dump.json`;
const dumpResponse = await fetch(dumpUrl, { headers: { Accept: 'application/json' } });
if (!dumpResponse.ok) throw new Error(`Roblox API dump request failed (${dumpResponse.status}).`);
const dump = await dumpResponse.json();

const classes = (dump.Classes || []).map((classInfo) => ({
    n: classInfo.Name,
    s: classInfo.Superclass,
    t: classInfo.Tags || [],
    m: (classInfo.Members || []).map((member) => ({
        n: member.Name,
        k: member.MemberType,
        t: member.ValueType?.Name || member.ReturnType?.Name || '',
        c: member.ValueType?.Category || member.ReturnType?.Category || '',
        p: (member.Parameters || []).map((parameter) => ({
            n: parameter.Name,
            t: parameter.Type?.Name || '',
            c: parameter.Type?.Category || '',
            d: parameter.Default,
        })),
        tg: member.Tags || [],
        sec: member.Security || null,
    })),
}));

const enums = (dump.Enums || []).map((enumInfo) => ({
    n: enumInfo.Name,
    i: (enumInfo.Items || []).map((item) => ({ n: item.Name, v: item.Value, t: item.Tags || [] })),
}));

const processed = {
    generatedAt: new Date().toISOString(),
    source: dumpUrl,
    studioVersion: version,
    version: dump.Version || 1,
    classes,
    enums,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(processed), 'utf8');
console.log(`Wrote ${classes.length} classes and ${enums.length} enums to ${outputPath}.`);
