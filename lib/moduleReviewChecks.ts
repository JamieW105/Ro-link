export type ModuleReviewCheckStatus = 'pass' | 'fail';

export interface ModuleReviewConfigFieldInput {
    key: string;
    label?: string;
    shortDescription?: string;
    options?: string[];
    defaultValue?: boolean | string | string[] | number | Record<string, unknown>;
    subFields?: ModuleReviewConfigFieldInput[];
}

export interface ModuleReviewInput {
    name: string;
    slug: string;
    description: string;
    version: string;
    category: string;
    isOfficial: boolean;
    sourceCode: string;
    moderationNote?: string;
    configSchema?: Record<string, ModuleReviewConfigFieldInput>;
}

export interface ModuleReviewCheckResult {
    id: string;
    title: string;
    description: string;
    status: ModuleReviewCheckStatus;
    details: string[];
}

interface TextSample {
    label: string;
    value: string;
}

const PROFANITY_PATTERNS = [
    /\bf+u+c+k+(?:er|ing|ed)?\b/i,
    /\bs+h+i+t+(?:ty)?\b/i,
    /\bb+i+t+c+h+(?:es|ing)?\b/i,
    /\ba+s+s+h+o+l+e+s?\b/i,
    /\bd+i+c+k+s?\b/i,
    /\bp+u+s+s+y+\b/i,
    /\bc+u+n+t+s?\b/i,
    /\bb+a+s+t+a+r+d+s?\b/i,
    /\bw+h+o+r+e+s?\b/i,
    /\bslut+s?\b/i,
    /\bf+a+g+(?:g+o+t+)?s?\b/i,
    /\br+e+t+a+r+d+(?:ed|s)?\b/i,
    /\bn+i+g+g+(?:a|er)s?\b/i,
    /\bk+y+s+\b/i,
];

const SCAM_LANGUAGE_PATTERNS = [
    /\bfree\s+robux\b/i,
    /\brobux\s+generator\b/i,
    /\badmin\s+hack\b/i,
    /\btoken\s+grabber\b/i,
    /\bcookie\s+grabber\b/i,
    /\bkey\s+system\s+bypass\b/i,
    /\baccount\s+stealer\b/i,
    /\bpassword\s+stealer\b/i,
    /\bclaim\s+(?:your\s+)?(?:reward|prize|robux)\b/i,
    /\blimited\s+time\s+(?:reward|offer)\b/i,
    /\bverify\s+to\s+claim\b/i,
];

const DANGEROUS_CODE_PATTERNS = [
    { pattern: /\bloadstring\s*\(/i, detail: 'Uses loadstring for dynamic code execution.' },
    { pattern: /\bHttpGet\s*\(/i, detail: 'Uses HttpGet to pull remote code or data.' },
    { pattern: /\bHttpPost\s*\(/i, detail: 'Uses HttpPost to send data externally.' },
    { pattern: /\bRequestAsync\s*\(/i, detail: 'Uses RequestAsync for external HTTP requests.' },
    { pattern: /\bHttpService\s*:\s*PostAsync\s*\(/i, detail: 'Posts data through HttpService.' },
    { pattern: /\bHttpService\s*:\s*GetAsync\s*\(/i, detail: 'Fetches data through HttpService.' },
    { pattern: /\bInsertService\b/i, detail: 'References InsertService for runtime asset insertion.' },
    { pattern: /\bLoadAsset\s*\(/i, detail: 'Loads an external Roblox asset at runtime.' },
    { pattern: /\brequire\s*\(\s*\d{5,}\s*\)/i, detail: 'Requires an external Roblox asset by numeric ID.' },
    { pattern: /\bgetfenv\s*\(/i, detail: 'Reads or manipulates the Lua environment.' },
    { pattern: /\bsetfenv\s*\(/i, detail: 'Mutates the Lua environment.' },
    { pattern: /\bdebug\./i, detail: 'Uses the debug library.' },
    { pattern: /\bgetrawmetatable\s*\(/i, detail: 'Reads raw metatables.' },
    { pattern: /\bsetreadonly\s*\(/i, detail: 'Changes readonly table behavior.' },
    { pattern: /\bsyn\.request\b|\bhttp_request\b|\brequest\s*\(/i, detail: 'Uses exploit-style HTTP request APIs.' },
];

const PRIVATE_VALUE_PATTERNS = [
    { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, detail: 'Contains an email address.' },
    { pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]){2,}\d{3,4}\b/, detail: 'Contains a phone-number-like value.' },
    { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/, detail: 'Contains an IP-address-like value.' },
    { pattern: /\b[A-Za-z0-9._%+-]+#\d{4}\b/, detail: 'Contains a legacy Discord tag.' },
    { pattern: /\b(?:discord(?:app)?\.com\/invite|discord\.gg)\/[A-Za-z0-9-]+\b/i, detail: 'Contains a Discord invite.' },
    { pattern: /\b(?:password|passwd|pwd|token|secret|api[_-]?key|authorization|auth[_-]?key)\s*[:=]\s*["'][^"']{6,}["']/i, detail: 'Contains a hard-coded credential-like assignment.' },
    { pattern: /\b(?:Bot|Bearer)\s+[A-Za-z0-9._-]{20,}\b/i, detail: 'Contains an authorization token-like value.' },
    { pattern: /\b[\w-]{24}\.[\w-]{6}\.[\w-]{25,}\b/, detail: 'Contains a Discord-token-like value.' },
    { pattern: /_?ROBLOSECURITY/i, detail: 'References a Roblox security cookie.' },
    { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i, detail: 'Contains a private key block.' },
];

const PRIVATE_PROFILE_FIELDS = [
    /\bUserId\b/i,
    /\bDisplayName\b/i,
    /\bAccountAge\b/i,
    /\bMembershipType\b/i,
    /\bGetRankInGroup\s*\(/i,
    /\bGetRoleInGroup\s*\(/i,
    /\bGetUserIdFromNameAsync\s*\(/i,
    /\bPlayers\s*:\s*GetNameFromUserIdAsync\s*\(/i,
];

const PERSISTENCE_PATTERNS = [
    /\bDataStoreService\b/i,
    /\bGetDataStore\s*\(/i,
    /\bSetAsync\s*\(/i,
    /\bUpdateAsync\s*\(/i,
    /\bIncrementAsync\s*\(/i,
    /\bMemoryStoreService\b/i,
    /\bSetAsync\s*\(/i,
    /\bJSONEncode\s*\(/i,
];

const EXTERNAL_LINK_PATTERN = /\bhttps?:\/\/[^\s"'<>)}\]]+/gi;
const URL_SHORTENER_PATTERN = /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|rebrand\.ly|cutt\.ly|shorturl\.at)\b/i;
const PASTE_OR_RAW_PATTERN = /\b(?:pastebin\.com|hastebin\.com|rentry\.co|raw\.githubusercontent\.com|gist\.githubusercontent\.com)\b/i;
const WEBHOOK_PATTERN = /\b(?:discord(?:app)?\.com\/api\/webhooks|hooks\.slack\.com\/services)\b/i;

function normalizeText(value: unknown) {
    return String(value ?? '').trim();
}

function getConfigSamples(configSchema: ModuleReviewInput['configSchema']) {
    const samples: TextSample[] = [];

    for (const [key, field] of Object.entries(configSchema || {})) {
        samples.push({ label: `config key "${key}"`, value: key });
        samples.push({ label: `config label "${key}"`, value: normalizeText(field.label) });
        samples.push({ label: `config description "${key}"`, value: normalizeText(field.shortDescription) });
        for (const option of field.options || []) {
            samples.push({ label: `config option "${key}"`, value: option });
        }
        if (Array.isArray(field.defaultValue)) {
            samples.push({ label: `config default "${key}"`, value: field.defaultValue.join(' ') });
        } else if (field.defaultValue && typeof field.defaultValue === 'object') {
            samples.push({ label: `config default "${key}"`, value: JSON.stringify(field.defaultValue).slice(0, 500) });
        } else {
            samples.push({ label: `config default "${key}"`, value: normalizeText(field.defaultValue) });
        }
        for (const subField of field.subFields || []) {
            samples.push({ label: `sub config key "${key}.${subField.key}"`, value: subField.key });
            samples.push({ label: `sub config label "${key}.${subField.key}"`, value: normalizeText(subField.label) });
            samples.push({ label: `sub config description "${key}.${subField.key}"`, value: normalizeText(subField.shortDescription) });
        }
    }

    return samples.filter((sample) => sample.value);
}

function getReviewTextSamples(module: ModuleReviewInput): TextSample[] {
    return [
        { label: 'name', value: module.name },
        { label: 'slug', value: module.slug },
        { label: 'description', value: module.description },
        { label: 'version', value: module.version },
        { label: 'category', value: module.category },
        { label: 'moderation note', value: module.moderationNote || '' },
        { label: 'source code', value: module.sourceCode },
        ...getConfigSamples(module.configSchema),
    ].filter((sample) => sample.value);
}

function findPatternMatches(samples: TextSample[], patterns: RegExp[], message: string) {
    const details: string[] = [];

    for (const sample of samples) {
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            if (pattern.test(sample.value)) {
                details.push(`${message} in ${sample.label}.`);
                break;
            }
        }
    }

    return details;
}

function uniqueDetails(details: string[]) {
    return Array.from(new Set(details)).slice(0, 8);
}

function result(
    id: string,
    title: string,
    description: string,
    details: string[],
): ModuleReviewCheckResult {
    const unique = uniqueDetails(details);
    return {
        id,
        title,
        description,
        status: unique.length > 0 ? 'fail' : 'pass',
        details: unique,
    };
}

function checkPrivateInfo(module: ModuleReviewInput, samples: TextSample[]) {
    const details = samples.flatMap((sample) => {
        const matches: string[] = [];
        for (const rule of PRIVATE_VALUE_PATTERNS) {
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(sample.value)) {
                matches.push(`${rule.detail} Found in ${sample.label}.`);
            }
        }
        return matches;
    });

    const hasPersistence = PERSISTENCE_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(module.sourceCode);
    });
    const hasPrivateProfileField = PRIVATE_PROFILE_FIELDS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(module.sourceCode);
    });

    if (hasPersistence && hasPrivateProfileField) {
        details.push('Source appears to persist Roblox profile identifiers or account attributes.');
    }

    return result(
        'private-info',
        'Private Info Storage',
        'Looks for hard-coded personal data, credentials, and code that stores player profile details.',
        details,
    );
}

function checkSuspiciousLinks(samples: TextSample[]) {
    const details: string[] = [];

    for (const sample of samples) {
        const urls = sample.value.match(EXTERNAL_LINK_PATTERN) || [];
        for (const url of urls) {
            if (WEBHOOK_PATTERN.test(url)) {
                details.push(`Webhook URL found in ${sample.label}.`);
            } else if (URL_SHORTENER_PATTERN.test(url)) {
                details.push(`URL shortener found in ${sample.label}.`);
            } else if (PASTE_OR_RAW_PATTERN.test(url)) {
                details.push(`Paste or raw-code URL found in ${sample.label}.`);
            } else if (!/^(https?:\/\/)?(?:www\.)?(?:ro-link\.com|roblox\.com|create\.roblox\.com|devforum\.roblox\.com)\b/i.test(url)) {
                details.push(`Unapproved external URL found in ${sample.label}.`);
            }
        }
    }

    return result(
        'suspicious-links',
        'Suspicious External Links',
        'Flags webhooks, shorteners, paste sites, raw-code links, and domains outside common trusted Roblox/Ro-Link references.',
        details,
    );
}

function checkDangerousScriptBehavior(module: ModuleReviewInput) {
    const details = DANGEROUS_CODE_PATTERNS
        .filter((rule) => {
            rule.pattern.lastIndex = 0;
            return rule.pattern.test(module.sourceCode);
        })
        .map((rule) => rule.detail);

    return result(
        'dangerous-script',
        'Dangerous Script Behavior',
        'Looks for remote execution, external HTTP calls, environment mutation, and exploit-style APIs.',
        details,
    );
}

function checkImpersonation(module: ModuleReviewInput, samples: TextSample[]) {
    if (module.isOfficial) {
        return result(
            'impersonation',
            'Asset/Name Impersonation',
            'Checks whether non-official submissions claim to be Ro-Link, staff, admin, verified, or system modules.',
            [],
        );
    }

    const publicText = samples
        .filter((sample) => sample.label !== 'source code')
        .map((sample) => sample.value)
        .join('\n');
    const details: string[] = [];

    if (/\b(?:official|verified|staff|admin|system|trusted)\b/i.test(publicText)) {
        details.push('Public module text claims official, verified, staff, admin, system, or trusted status.');
    }

    if (/\bro[-\s]?link\b/i.test(publicText) && /\b(?:module|admin|staff|official|system)\b/i.test(publicText)) {
        details.push('Public module text appears to impersonate Ro-Link or a Ro-Link system module.');
    }

    return result(
        'impersonation',
        'Asset/Name Impersonation',
        'Checks whether non-official submissions claim to be Ro-Link, staff, admin, verified, or system modules.',
        details,
    );
}

function checkObfuscation(module: ModuleReviewInput) {
    const source = module.sourceCode || '';
    const lines = source.split(/\r?\n/);
    const details: string[] = [];
    const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const encodedStringMatches = source.match(/[A-Za-z0-9+/]{180,}={0,2}/g) || [];
    const escapedCharacters = source.match(/\\x[0-9a-f]{2}|\\\d{2,3}/gi) || [];
    const charCodeArrays = source.match(/\{(?:\s*\d{1,3}\s*,){40,}\s*\d{1,3}\s*\}/g) || [];
    const shortIdentifierMatches = source.match(/\blocal\s+[a-zA-Z]{1,2}\s*=/g) || [];

    if (longestLine > 1000) {
        details.push(`Very long source line detected (${longestLine.toLocaleString()} characters).`);
    }
    if (encodedStringMatches.length > 0) {
        details.push('Large base64-like encoded string detected.');
    }
    if (escapedCharacters.length > 80) {
        details.push('High volume of escaped byte characters detected.');
    }
    if (charCodeArrays.length > 0) {
        details.push('Large character-code array detected.');
    }
    if (shortIdentifierMatches.length > 30) {
        details.push('Many short local variable names suggest minified or obfuscated code.');
    }

    return result(
        'obfuscation',
        'Obfuscation/Minified Code',
        'Looks for long minified lines, encoded blobs, byte escapes, character-code arrays, and unreadable identifiers.',
        details,
    );
}

export function runModuleReviewChecks(module: ModuleReviewInput): ModuleReviewCheckResult[] {
    const samples = getReviewTextSamples(module);

    return [
        checkPrivateInfo(module, samples),
        result(
            'profanity',
            'Profanity',
            'Checks source, name, description, category, config fields, and notes for profanity or abusive language.',
            findPatternMatches(samples, PROFANITY_PATTERNS, 'Profanity or abusive language found'),
        ),
        checkSuspiciousLinks(samples),
        checkDangerousScriptBehavior(module),
        checkImpersonation(module, samples),
        checkObfuscation(module),
        result(
            'spam-scam',
            'Spam/Scam Language',
            'Flags scam phrases such as free currency offers, account stealing, token grabbing, fake rewards, and bypass claims.',
            findPatternMatches(samples, SCAM_LANGUAGE_PATTERNS, 'Spam or scam language found'),
        ),
    ];
}
