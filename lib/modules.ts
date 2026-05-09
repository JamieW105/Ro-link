import { createHash } from 'crypto';

export type AddonModuleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface SanitizedAddonModuleInput {
    name?: string;
    slug?: string;
    description?: string;
    version?: string;
    category?: string;
    status?: AddonModuleStatus;
    sourceCode?: string;
    configSchema?: ModuleConfigSchema;
}

export type ModuleConfigFieldType = 'bool' | 'dropdown' | 'checkboxes' | 'color';

export interface ModuleConfigField {
    key: string;
    label: string;
    shortDescription: string;
    type: ModuleConfigFieldType;
    options: string[];
    defaultValue: boolean | string | string[];
}

export type ModuleConfigSchema = Record<string, ModuleConfigField>;

export type SanitizedAddonModuleResult =
    | { input: SanitizedAddonModuleInput }
    | { errors: string[] };

const VALID_MODULE_STATUSES = new Set<AddonModuleStatus>(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const VALID_CONFIG_TYPES = new Set<ModuleConfigFieldType>(['bool', 'dropdown', 'checkboxes', 'color']);

export function trimModuleString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

export function slugifyModuleName(value: string) {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    return slug || 'module';
}

export function checksumModuleSource(sourceCode: string) {
    return createHash('sha256').update(sourceCode, 'utf8').digest('hex');
}

function splitTopLevelEntries(value: string) {
    const entries: string[] = [];
    let current = '';
    let depth = 0;
    let quote: '"' | "'" | null = null;
    let escaped = false;

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];

        if (quote) {
            current += char;
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }

        if (char === '{') depth += 1;
        if (char === '}') depth = Math.max(0, depth - 1);

        if ((char === ',' || char === ';' || char === '\n') && depth === 0) {
            const entry = current.trim();
            if (entry) entries.push(entry);
            current = '';
            continue;
        }

        current += char;
    }

    const entry = current.trim();
    if (entry) entries.push(entry);
    return entries;
}

function unquoteConfigString(value: string) {
    const trimmed = value.trim();
    const quote = trimmed[0];
    if ((quote === '"' || quote === "'") && trimmed[trimmed.length - 1] === quote) {
        return trimmed
            .slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
    }
    return trimmed;
}

function findMatchingBrace(sourceCode: string, startIndex: number) {
    let depth = 0;
    let quote: '"' | "'" | null = null;
    let escaped = false;

    for (let index = startIndex; index < sourceCode.length; index += 1) {
        const char = sourceCode[index];

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return index;
        }
    }

    return -1;
}

function parseSimpleLuaValue(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const inner = trimmed.slice(1, -1);
        const objectValue: Record<string, unknown> = {};
        const arrayValue: unknown[] = [];
        let hasObjectKeys = false;

        for (const entry of splitTopLevelEntries(inner)) {
            const keyedMatch = entry.match(/^\s*(?:\["([^"]+)"\]|\['([^']+)'\]|([A-Za-z_][A-Za-z0-9_]*))\s*=\s*([\s\S]*)$/);
            if (keyedMatch) {
                hasObjectKeys = true;
                const key = keyedMatch[1] || keyedMatch[2] || keyedMatch[3];
                objectValue[key] = parseSimpleLuaValue(keyedMatch[4]);
            } else {
                arrayValue.push(parseSimpleLuaValue(entry));
            }
        }

        return hasObjectKeys ? objectValue : arrayValue;
    }

    return unquoteConfigString(trimmed);
}

function normalizeConfigType(value: unknown): ModuleConfigFieldType | null {
    const normalized = String(value || '')
        .toLowerCase()
        .replace(/[\s_-]+/g, '');

    if (normalized === 'bool' || normalized === 'boolean' || normalized === 'toggle' || normalized === 'togglable') {
        return 'bool';
    }
    if (normalized === 'dropdown' || normalized === 'select') {
        return 'dropdown';
    }
    if (normalized === 'checkboxes' || normalized === 'checkbox' || normalized === 'multiselect') {
        return 'checkboxes';
    }
    if (normalized === 'colorwheel' || normalized === 'color' || normalized === 'hexcolor') {
        return 'color';
    }

    return null;
}

function normalizeConfigOptions(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => trimModuleString(item, 120))
        .filter(Boolean)
        .slice(0, 50);
}

function defaultConfigValue(type: ModuleConfigFieldType, options: string[], rawDefault: unknown) {
    if (rawDefault !== undefined && rawDefault !== null && rawDefault !== '') {
        if (type === 'bool') return rawDefault === true || String(rawDefault).toLowerCase() === 'true';
        if (type === 'checkboxes') {
            if (Array.isArray(rawDefault)) {
                return rawDefault.map((item) => String(item)).filter((item) => options.includes(item));
            }
            return [];
        }
        if (type === 'color') {
            const color = String(rawDefault).trim();
            return /^#[0-9a-f]{6}$/i.test(color) ? color : '#38bdf8';
        }
        const selected = String(rawDefault);
        return options.includes(selected) ? selected : (options[0] || '');
    }

    if (type === 'bool') return false;
    if (type === 'checkboxes') return [];
    if (type === 'color') return '#38bdf8';
    return options[0] || '';
}

export function parseModuleConfigSchema(sourceCode: string): ModuleConfigSchema {
    const configMatch = /(?:^|\n)\s*(?:local\s+)?CONFIG\s*=\s*\{/m.exec(sourceCode);
    if (!configMatch) return {};

    const openBraceIndex = sourceCode.indexOf('{', configMatch.index);
    if (openBraceIndex < 0) return {};

    const closeBraceIndex = findMatchingBrace(sourceCode, openBraceIndex);
    if (closeBraceIndex < 0) return {};

    const inner = sourceCode.slice(openBraceIndex + 1, closeBraceIndex);
    const schema: ModuleConfigSchema = {};

    for (const entry of splitTopLevelEntries(inner)) {
        const match = entry.match(/^\s*(?:\["([^"]+)"\]|\['([^']+)'\]|([A-Za-z_][A-Za-z0-9_]*))\s*=\s*(\{[\s\S]*\})\s*$/);
        if (!match) continue;

        const key = trimModuleString(match[1] || match[2] || match[3], 80);
        const rawField = parseSimpleLuaValue(match[4]);
        if (!key || !rawField || typeof rawField !== 'object' || Array.isArray(rawField)) continue;

        const fieldRecord = rawField as Record<string, unknown>;
        const type = normalizeConfigType(fieldRecord.Type ?? fieldRecord.type);
        if (!type || !VALID_CONFIG_TYPES.has(type)) continue;

        const options = normalizeConfigOptions(fieldRecord.Options ?? fieldRecord.options);
        const label = trimModuleString(fieldRecord.Label ?? fieldRecord.label ?? key.replace(/_/g, ' '), 120);
        const shortDescription = trimModuleString(
            fieldRecord.Short_Description ?? fieldRecord.short_description ?? fieldRecord.description ?? '',
            300,
        );

        schema[key] = {
            key,
            label: label || key,
            shortDescription,
            type,
            options,
            defaultValue: defaultConfigValue(type, options, fieldRecord.Default ?? fieldRecord.defaultValue ?? fieldRecord.Value),
        };
    }

    return schema;
}

export function parseModuleConfigSettings(value: unknown, schema: ModuleConfigSchema) {
    const rawSettings = parseModuleSettings(value);
    const settings: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(schema || {})) {
        const rawValue = rawSettings[key];

        if (field.type === 'bool') {
            settings[key] = rawValue === undefined ? field.defaultValue : rawValue === true || String(rawValue).toLowerCase() === 'true';
            continue;
        }

        if (field.type === 'checkboxes') {
            const values = Array.isArray(rawValue) ? rawValue.map((item) => String(item)) : [];
            settings[key] = values.filter((item) => field.options.includes(item));
            continue;
        }

        if (field.type === 'color') {
            const color = String(rawValue || field.defaultValue || '').trim();
            settings[key] = /^#[0-9a-f]{6}$/i.test(color) ? color : field.defaultValue;
            continue;
        }

        const selected = String(rawValue || '');
        settings[key] = field.options.includes(selected) ? selected : field.defaultValue;
    }

    for (const [key, rawValue] of Object.entries(rawSettings)) {
        if (!(key in settings)) {
            settings[key] = rawValue;
        }
    }

    return settings;
}

export function sanitizeAddonModuleInput(body: Record<string, unknown>, partial = false): SanitizedAddonModuleResult {
    const input: SanitizedAddonModuleInput = {};
    const errors: string[] = [];

    if (!partial || 'name' in body) {
        const name = trimModuleString(body.name, 120);
        if (!name) {
            errors.push('Module name is required.');
        } else {
            input.name = name;
        }
    }

    if ('slug' in body) {
        const slug = slugifyModuleName(trimModuleString(body.slug, 80));
        if (slug) {
            input.slug = slug;
        }
    }

    if (!partial || 'description' in body) {
        input.description = trimModuleString(body.description, 2000);
    }

    if (!partial || 'version' in body) {
        input.version = trimModuleString(body.version, 40) || '1.0.0';
    }

    if (!partial || 'category' in body) {
        input.category = trimModuleString(body.category, 80) || 'General';
    }

    if (!partial || 'status' in body) {
        const status = trimModuleString(body.status, 20).toUpperCase() as AddonModuleStatus;
        input.status = VALID_MODULE_STATUSES.has(status) ? status : 'DRAFT';
    }

    if (!partial || 'sourceCode' in body || 'source_code' in body) {
        const sourceCode = trimModuleString(body.sourceCode ?? body.source_code, 250_000);
        if (!sourceCode) {
            errors.push('Module source code is required.');
        } else {
            input.sourceCode = sourceCode;
            input.configSchema = parseModuleConfigSchema(sourceCode);
        }
    }

    if (errors.length > 0) {
        return { errors } as const;
    }

    return { input } as const;
}

export function normalizeAddonModule(row: Record<string, unknown> | null | undefined, includeSource = false) {
    if (!row) {
        return null;
    }

    return {
        id: String(row.id || ''),
        slug: String(row.slug || ''),
        name: String(row.name || 'Untitled Module'),
        description: String(row.description || ''),
        version: String(row.version || '1.0.0'),
        category: String(row.category || 'General'),
        status: String(row.status || 'DRAFT') as AddonModuleStatus,
        sourceChecksum: String(row.source_checksum || ''),
        configSchema: parseStoredModuleConfigSchema(row.config_schema),
        authorDiscordId: row.author_discord_id ? String(row.author_discord_id) : null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        publishedAt: row.published_at || null,
        ...(includeSource ? { sourceCode: String(row.source_code || '') } : {}),
    };
}

export function parseModuleSettings(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

export function parseStoredModuleConfigSchema(value: unknown): ModuleConfigSchema {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    const schema: ModuleConfigSchema = {};
    for (const [key, rawField] of Object.entries(value as Record<string, unknown>)) {
        if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField)) continue;
        const fieldRecord = rawField as Record<string, unknown>;
        const type = VALID_CONFIG_TYPES.has(fieldRecord.type as ModuleConfigFieldType)
            ? fieldRecord.type as ModuleConfigFieldType
            : normalizeConfigType(fieldRecord.Type);
        if (!type) continue;

        const options = normalizeConfigOptions(fieldRecord.options ?? fieldRecord.Options);
        schema[key] = {
            key,
            label: trimModuleString(fieldRecord.label ?? fieldRecord.Label ?? key.replace(/_/g, ' '), 120) || key,
            shortDescription: trimModuleString(fieldRecord.shortDescription ?? fieldRecord.Short_Description ?? '', 300),
            type,
            options,
            defaultValue: defaultConfigValue(type, options, fieldRecord.defaultValue),
        };
    }

    return schema;
}
