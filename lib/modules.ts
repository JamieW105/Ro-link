import { createHash } from 'crypto';

export type AddonModuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

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

const VALID_MODULE_STATUSES = new Set<AddonModuleStatus>(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED']);
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

type LuaTokenType = 'identifier' | 'keyword' | 'number' | 'punctuation' | 'string' | 'whitespace';

interface LuaToken {
    type: LuaTokenType;
    value: string;
    decoded?: string;
}

const LUA_KEYWORDS = new Set([
    'and',
    'break',
    'continue',
    'do',
    'else',
    'elseif',
    'end',
    'export',
    'false',
    'for',
    'function',
    'if',
    'in',
    'local',
    'nil',
    'not',
    'or',
    'repeat',
    'return',
    'then',
    'true',
    'type',
    'typeof',
    'until',
    'while',
]);

const LUA_GLOBALS_AND_COMMON_FIELDS = new Set([
    '_G',
    'assert',
    'bit32',
    'BrickColor',
    'CFrame',
    'Color3',
    'ColorSequence',
    'coroutine',
    'debug',
    'Enum',
    'error',
    'game',
    'getmetatable',
    'Instance',
    'ipairs',
    'math',
    'next',
    'NumberRange',
    'NumberSequence',
    'os',
    'pairs',
    'pcall',
    'plugin',
    'print',
    'Random',
    'rawget',
    'rawlen',
    'rawset',
    'require',
    'script',
    'select',
    'self',
    'setmetatable',
    'shared',
    'string',
    'table',
    'task',
    'tonumber',
    'tostring',
    'TweenInfo',
    'type',
    'typeof',
    'UDim',
    'UDim2',
    'unpack',
    'utf8',
    'Vector2',
    'Vector3',
    'warn',
    'workspace',
    'xpcall',
]);

function isIdentifierStart(char: string) {
    return /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string) {
    return /[A-Za-z0-9_]/.test(char);
}

function isWhitespace(char: string) {
    return /\s/.test(char);
}

function findLongBracketClose(sourceCode: string, startIndex: number) {
    if (sourceCode[startIndex] !== '[') {
        return null;
    }

    let index = startIndex + 1;
    while (sourceCode[index] === '=') {
        index += 1;
    }

    if (sourceCode[index] !== '[') {
        return null;
    }

    const equals = sourceCode.slice(startIndex + 1, index);
    const openEnd = index + 1;
    const closeMarker = `]${equals}]`;
    const closeIndex = sourceCode.indexOf(closeMarker, openEnd);

    return {
        openEnd,
        closeIndex,
        closeMarkerLength: closeMarker.length,
    };
}

function normalizeLuaLongStringContent(content: string) {
    if (content.startsWith('\r\n')) {
        return content.slice(2);
    }
    if (content.startsWith('\n')) {
        return content.slice(1);
    }
    return content;
}

function decodeLuaQuotedString(rawValue: string) {
    let output = '';
    for (let index = 1; index < rawValue.length - 1; index += 1) {
        const char = rawValue[index];
        if (char !== '\\') {
            output += char;
            continue;
        }

        index += 1;
        const escaped = rawValue[index];
        if (escaped === undefined) {
            break;
        }

        if (escaped === '\r' && rawValue[index + 1] === '\n') {
            index += 1;
            continue;
        }
        if (escaped === '\n' || escaped === '\r') {
            continue;
        }
        if (escaped === 'a') output += '\x07';
        else if (escaped === 'b') output += '\b';
        else if (escaped === 'f') output += '\f';
        else if (escaped === 'n') output += '\n';
        else if (escaped === 'r') output += '\r';
        else if (escaped === 't') output += '\t';
        else if (escaped === 'v') output += '\v';
        else if (escaped === 'z') {
            while (index + 1 < rawValue.length - 1 && isWhitespace(rawValue[index + 1])) {
                index += 1;
            }
        } else if (escaped === 'x') {
            const hex = rawValue.slice(index + 1, index + 3);
            if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                output += String.fromCharCode(parseInt(hex, 16));
                index += 2;
            } else {
                output += escaped;
            }
        } else if (escaped === 'u' && rawValue[index + 1] === '{') {
            const closeIndex = rawValue.indexOf('}', index + 2);
            const codePoint = closeIndex > index + 2 ? parseInt(rawValue.slice(index + 2, closeIndex), 16) : NaN;
            if (Number.isFinite(codePoint)) {
                output += String.fromCodePoint(codePoint);
                index = closeIndex;
            } else {
                output += escaped;
            }
        } else if (/[0-9]/.test(escaped)) {
            let digits = escaped;
            while (digits.length < 3 && /[0-9]/.test(rawValue[index + 1] || '')) {
                digits += rawValue[index + 1];
                index += 1;
            }
            output += String.fromCharCode(Number(digits) % 256);
        } else {
            output += escaped;
        }
    }

    return output;
}

function tokenizeLua(sourceCode: string): LuaToken[] {
    const tokens: LuaToken[] = [];
    let index = 0;

    while (index < sourceCode.length) {
        const char = sourceCode[index];
        const next = sourceCode[index + 1];

        if (isWhitespace(char)) {
            let end = index + 1;
            while (end < sourceCode.length && isWhitespace(sourceCode[end])) {
                end += 1;
            }
            tokens.push({ type: 'whitespace', value: sourceCode.slice(index, end) });
            index = end;
            continue;
        }

        if (char === '-' && next === '-') {
            const longComment = findLongBracketClose(sourceCode, index + 2);
            if (longComment) {
                index = longComment.closeIndex >= 0
                    ? longComment.closeIndex + longComment.closeMarkerLength
                    : sourceCode.length;
            } else {
                while (index < sourceCode.length && sourceCode[index] !== '\n') {
                    index += 1;
                }
            }
            tokens.push({ type: 'whitespace', value: '\n' });
            continue;
        }

        if (char === '"' || char === "'") {
            const quote = char;
            let end = index + 1;
            let escaped = false;
            while (end < sourceCode.length) {
                const current = sourceCode[end];
                if (escaped) {
                    escaped = false;
                } else if (current === '\\') {
                    escaped = true;
                } else if (current === quote) {
                    end += 1;
                    break;
                }
                end += 1;
            }
            const value = sourceCode.slice(index, end);
            tokens.push({ type: 'string', value, decoded: decodeLuaQuotedString(value) });
            index = end;
            continue;
        }

        if (char === '[') {
            const longString = findLongBracketClose(sourceCode, index);
            if (longString) {
                const closeIndex = longString.closeIndex >= 0 ? longString.closeIndex : sourceCode.length;
                const value = sourceCode.slice(index, closeIndex + (longString.closeIndex >= 0 ? longString.closeMarkerLength : 0));
                const content = sourceCode.slice(longString.openEnd, closeIndex);
                tokens.push({ type: 'string', value, decoded: normalizeLuaLongStringContent(content) });
                index = closeIndex + (longString.closeIndex >= 0 ? longString.closeMarkerLength : 0);
                continue;
            }
        }

        if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(next || ''))) {
            let end = index + 1;
            while (end < sourceCode.length && /[A-Za-z0-9_.]/.test(sourceCode[end])) {
                end += 1;
            }
            tokens.push({ type: 'number', value: sourceCode.slice(index, end) });
            index = end;
            continue;
        }

        if (isIdentifierStart(char)) {
            let end = index + 1;
            while (end < sourceCode.length && isIdentifierPart(sourceCode[end])) {
                end += 1;
            }
            const value = sourceCode.slice(index, end);
            tokens.push({
                type: LUA_KEYWORDS.has(value) ? 'keyword' : 'identifier',
                value,
            });
            index = end;
            continue;
        }

        tokens.push({ type: 'punctuation', value: char });
        index += 1;
    }

    return tokens;
}

function nextSignificantTokenIndex(tokens: LuaToken[], startIndex: number) {
    for (let index = startIndex; index < tokens.length; index += 1) {
        if (tokens[index].type !== 'whitespace') {
            return index;
        }
    }
    return -1;
}

function previousSignificantTokenIndex(tokens: LuaToken[], startIndex: number) {
    for (let index = startIndex; index >= 0; index -= 1) {
        if (tokens[index].type !== 'whitespace') {
            return index;
        }
    }
    return -1;
}

function shouldRenameIdentifier(name: string) {
    return !LUA_KEYWORDS.has(name)
        && !LUA_GLOBALS_AND_COMMON_FIELDS.has(name)
        && name !== 'CONFIG'
        && !/^__rolink_/.test(name);
}

function collectLocalRenameCandidates(tokens: LuaToken[]) {
    const candidates = new Set<string>();

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (token.type === 'keyword' && token.value === 'local') {
            const nextIndex = nextSignificantTokenIndex(tokens, index + 1);
            if (nextIndex >= 0 && tokens[nextIndex].type === 'keyword' && tokens[nextIndex].value === 'function') {
                const nameIndex = nextSignificantTokenIndex(tokens, nextIndex + 1);
                if (nameIndex >= 0 && tokens[nameIndex].type === 'identifier' && shouldRenameIdentifier(tokens[nameIndex].value)) {
                    candidates.add(tokens[nameIndex].value);
                }
                continue;
            }

            let inTypeAnnotation = false;
            for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
                const current = tokens[cursor];
                if (current.type === 'whitespace' && current.value.includes('\n')) {
                    break;
                }
                if (current.value === '=') {
                    break;
                }
                if (current.value === ',') {
                    inTypeAnnotation = false;
                    continue;
                }
                if (current.value === ':') {
                    inTypeAnnotation = true;
                    continue;
                }
                if (!inTypeAnnotation && current.type === 'identifier' && shouldRenameIdentifier(current.value)) {
                    candidates.add(current.value);
                }
            }
        }

        if (token.type === 'keyword' && token.value === 'function') {
            const openIndex = (() => {
                let cursor = index + 1;
                while (cursor < tokens.length) {
                    if (tokens[cursor].value === '(') return cursor;
                    if (tokens[cursor].type === 'whitespace' || tokens[cursor].type === 'identifier' || tokens[cursor].value === '.' || tokens[cursor].value === ':') {
                        cursor += 1;
                        continue;
                    }
                    return -1;
                }
                return -1;
            })();

            if (openIndex >= 0) {
                let depth = 1;
                let inTypeAnnotation = false;
                for (let cursor = openIndex + 1; cursor < tokens.length; cursor += 1) {
                    const current = tokens[cursor];
                    if (current.value === '(') depth += 1;
                    if (current.value === ')') {
                        depth -= 1;
                        if (depth === 0) break;
                    }
                    if (depth !== 1) continue;
                    if (current.value === ',') {
                        inTypeAnnotation = false;
                        continue;
                    }
                    if (current.value === ':') {
                        inTypeAnnotation = true;
                        continue;
                    }
                    if (!inTypeAnnotation && current.type === 'identifier' && shouldRenameIdentifier(current.value)) {
                        candidates.add(current.value);
                    }
                }
            }
        }

        if (token.type === 'keyword' && token.value === 'for') {
            let inTypeAnnotation = false;
            for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
                const current = tokens[cursor];
                if (current.value === '=' || (current.type === 'keyword' && current.value === 'in')) {
                    break;
                }
                if (current.value === ',') {
                    inTypeAnnotation = false;
                    continue;
                }
                if (current.value === ':') {
                    inTypeAnnotation = true;
                    continue;
                }
                if (!inTypeAnnotation && current.type === 'identifier' && shouldRenameIdentifier(current.value)) {
                    candidates.add(current.value);
                }
            }
        }
    }

    return candidates;
}

function buildRenameMap(tokens: LuaToken[], sourceCode: string) {
    const candidates = Array.from(collectLocalRenameCandidates(tokens)).sort();
    const hash = checksumModuleSource(sourceCode).slice(0, 10);
    const renameMap = new Map<string, string>();

    candidates.forEach((candidate, index) => {
        renameMap.set(candidate, `__rolink_${hash}_${index.toString(36)}`);
    });

    return renameMap;
}

function isTableFieldKey(tokens: LuaToken[], index: number, braceDepth: number) {
    if (braceDepth <= 0) {
        return false;
    }
    const nextIndex = nextSignificantTokenIndex(tokens, index + 1);
    const prevIndex = previousSignificantTokenIndex(tokens, index - 1);
    const afterNextIndex = nextIndex >= 0 ? nextSignificantTokenIndex(tokens, nextIndex + 1) : -1;
    return nextIndex >= 0
        && tokens[nextIndex].value === '='
        && (afterNextIndex < 0 || tokens[afterNextIndex].value !== '=')
        && (prevIndex < 0 || tokens[prevIndex].value !== '.');
}

function obfuscateIdentifierToken(tokens: LuaToken[], index: number, renameMap: Map<string, string>, braceDepth: number) {
    const token = tokens[index];
    if (token.type !== 'identifier') {
        return token.value;
    }

    const renamed = renameMap.get(token.value);
    if (!renamed) {
        return token.value;
    }

    const prevIndex = previousSignificantTokenIndex(tokens, index - 1);
    if (prevIndex >= 0 && tokens[prevIndex].value === '.') {
        const prevPrevIndex = previousSignificantTokenIndex(tokens, prevIndex - 1);
        if (prevPrevIndex < 0 || tokens[prevPrevIndex].value !== '.') {
            return token.value;
        }
    }
    if (prevIndex >= 0 && tokens[prevIndex].value === ':') {
        return token.value;
    }
    if (isTableFieldKey(tokens, index, braceDepth)) {
        return token.value;
    }

    return renamed;
}

function encodeLuaString(decoded: string, decodeFunctionName: string, seed: number) {
    const bytes = Buffer.from(decoded, 'utf8');
    const key = (seed % 173) + 53;
    const encoded = Array.from(bytes, (byte, index) => (byte + key + (((index + 1) * 17) % 251)) % 256);
    return `${decodeFunctionName}({${encoded.join(',')}},${key})`;
}

function encodeIntegerConstant(rawValue: string, seed: number) {
    if (!/^\d+$/.test(rawValue)) {
        return rawValue;
    }

    const value = Number(rawValue);
    if (!Number.isSafeInteger(value)) {
        return rawValue;
    }

    const mask = ((seed % 997) + 31) * 3;
    return `(${value + mask}-${mask})`;
}

function tokenStartsLikeWord(value: string) {
    return /^[A-Za-z0-9_]/.test(value);
}

function tokenEndsLikeWord(value: string) {
    return /[A-Za-z0-9_]$/.test(value);
}

function needsSpaceBetween(prev: string, next: string) {
    if (!prev || !next) {
        return false;
    }

    if (tokenEndsLikeWord(prev) && tokenStartsLikeWord(next)) {
        return true;
    }
    if (/[\])}]$/.test(prev) && tokenStartsLikeWord(next)) {
        return true;
    }
    if (prev.endsWith('-') && next.startsWith('-')) {
        return true;
    }

    return false;
}

function buildObfuscatedPrelude(decodeFunctionName: string, hash: string) {
    const charName = `__rolink_char_${hash}`;
    const concatName = `__rolink_concat_${hash}`;
    const outputName = `__rolink_out_${hash}`;
    const indexName = `__rolink_i_${hash}`;
    const noiseName = `__rolink_noise_${hash}`;

    return [
        `local ${charName}=string.char`,
        `local ${concatName}=table.concat`,
        `local function ${decodeFunctionName}(__rolink_data_${hash},__rolink_key_${hash})`,
        `local ${outputName}={}`,
        `for ${indexName}=1,#__rolink_data_${hash} do`,
        `${outputName}[${indexName}]=${charName}((__rolink_data_${hash}[${indexName}]-__rolink_key_${hash}-(${indexName}*17%251))%256)`,
        'end',
        `return ${concatName}(${outputName})`,
        'end',
        `local ${noiseName}=0`,
        `if ${noiseName}==${Number.parseInt(hash.slice(0, 5), 36)} then ${noiseName}=${noiseName}+1 end`,
    ].join('\n');
}

export function obfuscateModuleSourceForStudio(sourceCode: string) {
    const tokens = tokenizeLua(sourceCode);
    const renameMap = buildRenameMap(tokens, sourceCode);
    const hash = checksumModuleSource(sourceCode).slice(0, 8);
    const decodeFunctionName = `__rolink_decode_${hash}`;
    const fragments: string[] = [];
    let previous = '';
    let braceDepth = 0;

    tokens.forEach((token, index) => {
        if (token.type === 'whitespace') {
            return;
        }

        let value = token.value;
        if (token.type === 'identifier') {
            value = obfuscateIdentifierToken(tokens, index, renameMap, braceDepth);
        } else if (token.type === 'string') {
            value = encodeLuaString(token.decoded ?? '', decodeFunctionName, index + sourceCode.length);
        } else if (token.type === 'number') {
            value = encodeIntegerConstant(token.value, index + sourceCode.length);
        }

        if (needsSpaceBetween(previous, value)) {
            fragments.push(' ');
        }
        fragments.push(value);
        previous = value;

        if (token.value === '{') {
            braceDepth += 1;
        } else if (token.value === '}') {
            braceDepth = Math.max(0, braceDepth - 1);
        }
    });

    return [
        '-- Ro-Link managed marketplace module. Source is statically obfuscated before Studio insertion.',
        buildObfuscatedPrelude(decodeFunctionName, hash),
        fragments.join(''),
        '',
    ].join('\n');
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

export function parseModuleConfigVersion(sourceCode: string) {
    const configMatch = /(?:^|\n)\s*(?:local\s+)?CONFIG\s*=\s*\{/m.exec(sourceCode);
    if (!configMatch) return '';

    const openBraceIndex = sourceCode.indexOf('{', configMatch.index);
    if (openBraceIndex < 0) return '';

    const closeBraceIndex = findMatchingBrace(sourceCode, openBraceIndex);
    if (closeBraceIndex < 0) return '';

    const inner = sourceCode.slice(openBraceIndex + 1, closeBraceIndex);
    for (const entry of splitTopLevelEntries(inner)) {
        const match = entry.match(/^\s*(?:\["([^"]+)"\]|\['([^']+)'\]|([A-Za-z_][A-Za-z0-9_]*))\s*=\s*([\s\S]*)$/);
        if (!match) continue;

        const key = trimModuleString(match[1] || match[2] || match[3], 80).toLowerCase();
        if (key !== 'version') continue;

        return trimModuleString(parseSimpleLuaValue(match[4]), 40);
    }

    return '';
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
            const configVersion = parseModuleConfigVersion(sourceCode);
            if (configVersion) {
                input.version = configVersion;
            }
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
        isOfficial: row.is_official_module === true,
        sourceChecksum: String(row.source_checksum || ''),
        configSchema: parseStoredModuleConfigSchema(row.config_schema),
        authorDiscordId: row.author_discord_id ? String(row.author_discord_id) : null,
        submittedAt: row.submitted_at || null,
        reviewedAt: row.reviewed_at || null,
        reviewedByDiscordId: row.reviewed_by_discord_id ? String(row.reviewed_by_discord_id) : null,
        moderationNote: String(row.moderation_note || ''),
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
