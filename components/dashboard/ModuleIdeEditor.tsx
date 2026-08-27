'use client';

import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useCallback, useMemo, useRef } from 'react';

import { moduleApiMetadata, moduleApiNames } from '@/lib/moduleApiMetadata';
import { luauLanguageSuggestions } from '@/lib/luauLanguageSuggestions';

export type IdeDiagnostic = {
    severity: 'error' | 'warning';
    file: string;
    line: number;
    column: number;
    message: string;
    code: string;
};

type RobloxMember = { n: string; k: string; t: string; c: string; p: Array<{ n: string; t: string; c: string; d?: string }>; tg?: string[]; sec?: unknown };
type RobloxClass = { n: string; s: string; t?: string[]; m: RobloxMember[] };
type RobloxEnum = { n: string; i: Array<{ n: string; v: number; t?: string[] }> };
type RobloxMetadata = { classes: RobloxClass[]; enums: RobloxEnum[]; studioVersion: string; generatedAt: string };
type ScriptApiParameter = { n: string; t: string; v?: string };
type ScriptApiMember = { n: string; k: 'constructor' | 'property' | 'function' | 'method' | 'event' | 'callback'; s: string; p?: ScriptApiParameter[]; r?: string[]; d?: string; tg?: string[]; o?: string[] };
type ScriptApiNamespace = { n: string; d?: string; m: ScriptApiMember[] };
type ScriptApiMetadata = { version: number; generatedAt: string; revision: string; sources: string[]; globals: ScriptApiMember[]; libraries: ScriptApiNamespace[]; dataTypes: ScriptApiNamespace[] };

interface ModuleIdeEditorProps {
    value: string;
    path: string;
    language?: 'luau' | 'json';
    projectPaths: string[];
    onChange: (value: string) => void;
    onSave: () => void;
    onDiagnostics: (diagnostics: IdeDiagnostic[]) => void;
}

let languageConfigured = false;
let providersConfigured = false;
let currentProjectPaths: string[] = [];
let robloxMetadataPromise: Promise<RobloxMetadata> | null = null;
let scriptApiMetadataPromise: Promise<ScriptApiMetadata> | null = null;

function loadRobloxMetadata() {
    if (!robloxMetadataPromise) {
        robloxMetadataPromise = fetch('/data/roblox-api.min.json', { cache: 'force-cache' }).then(async (response) => {
            if (!response.ok) throw new Error(`Roblox API metadata failed (${response.status}).`);
            return response.json() as Promise<RobloxMetadata>;
        });
    }
    return robloxMetadataPromise;
}

function loadScriptApiMetadata() {
    if (!scriptApiMetadataPromise) {
        scriptApiMetadataPromise = fetch('/data/roblox-script-api.min.json', { cache: 'force-cache' }).then(async (response) => {
            if (!response.ok) throw new Error(`Roblox script API metadata failed (${response.status}).`);
            return response.json() as Promise<ScriptApiMetadata>;
        });
    }
    return scriptApiMetadataPromise;
}

function memberSignature(member: RobloxMember) {
    const parameters = (member.p || []).map((parameter) => `${parameter.n}: ${parameter.t || 'any'}`).join(', ');
    if (member.k === 'Function' || member.k === 'Callback') return `${member.n}(${parameters}): ${member.t || 'any'}`;
    if (member.k === 'Event') return `${member.n}: RBXScriptSignal`;
    return `${member.n}: ${member.t || 'any'}`;
}

function completionKind(monaco: typeof Monaco, kind: string) {
    if (kind === 'Function' || kind === 'Callback' || kind === 'function' || kind === 'method') return monaco.languages.CompletionItemKind.Method;
    if (kind === 'constructor') return monaco.languages.CompletionItemKind.Constructor;
    if (kind === 'Event' || kind === 'event') return monaco.languages.CompletionItemKind.Event;
    return monaco.languages.CompletionItemKind.Property;
}

function snippetForMember(member: { n: string; k: string; p?: Array<{ n: string }> }) {
    if (!['Function', 'Callback', 'function', 'method', 'constructor'].includes(member.k)) return member.n;
    const parameters = (member.p || []).map((parameter, index) => `\${${index + 1}:${parameter.n === '...' ? '...' : parameter.n}}`).join(', ');
    return `${member.n}(${parameters})`;
}

function resolveClassMembers(className: string, classes: Map<string, RobloxClass>) {
    const members: RobloxMember[] = [];
    const seen = new Set<string>();
    let current = classes.get(className);
    while (current) {
        for (const member of current.m || []) {
            if (!seen.has(member.n)) {
                seen.add(member.n);
                members.push(member);
            }
        }
        current = current.s ? classes.get(current.s) : undefined;
    }
    return members;
}

function expressionResultClass(expression: string, variables: Map<string, string>, classes: Map<string, RobloxClass>, namespaces: Map<string, ScriptApiNamespace>) {
    const root = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(expression)?.[1];
    if (!root) return undefined;
    let className: string | undefined = variables.get(root) || (classes.has(root) || namespaces.has(root) ? root : undefined);
    if (!className) return undefined;
    const remainder = expression.slice(root.length);
    for (const segment of remainder.matchAll(/[.:]([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?/g)) {
        if (!className) return undefined;
        const memberName = segment[1];
        const classMember: RobloxMember | undefined = resolveClassMembers(className, classes).find((member) => member.n === memberName);
        if (classMember) {
            className = classMember.k === 'Event' ? 'RBXScriptSignal' : classMember.t;
            continue;
        }
        const scriptMember: ScriptApiMember | undefined = namespaces.get(className)?.m.find((member) => member.n === memberName);
        const returnType: string | undefined = scriptMember?.r?.[0];
        if (!returnType) return undefined;
        className = returnType.replace(/\?$/, '');
    }
    return className;
}

function inferredInteractionClass(name: string, classes: Map<string, RobloxClass>) {
    const normalized = name.toLowerCase();
    const inferred = normalized.endsWith('button') ? 'TextButton'
        : normalized === 'mouse' ? 'Mouse'
            : normalized.includes('inputservice') || normalized === 'input' ? 'UserInputService'
                : normalized.includes('clickdetector') ? 'ClickDetector'
                    : normalized.includes('prompt') ? 'ProximityPrompt'
                        : undefined;
    return inferred && classes.has(inferred) ? inferred : undefined;
}

function inferVariableClasses(source: string, classes = new Map<string, RobloxClass>(), namespaces = new Map<string, ScriptApiNamespace>()) {
    const variables = new Map<string, string>();
    for (const match of source.matchAll(/local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*game:GetService\(["']([^"']+)["']\)/g)) variables.set(match[1], match[2]);
    for (const match of source.matchAll(/(?:\blocal\s+|[,(]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/g)) variables.set(match[1], match[2]);
    for (const match of source.matchAll(/local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Instance\.new\(["']([^"']+)["']/g)) variables.set(match[1], match[2]);
    for (const match of source.matchAll(/local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.(?:new|from[A-Za-z0-9_]*)\s*\(/g)) variables.set(match[1], match[2]);
    for (const match of source.matchAll(/local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[A-Za-z_][A-Za-z0-9_]*:(?:FindFirstChildOfClass|FindFirstChildWhichIsA)\(["']([^"']+)["']/g)) variables.set(match[1], match[2]);
    variables.set('game', 'DataModel');
    variables.set('workspace', 'Workspace');
    variables.set('script', 'LuaSourceContainer');
    for (let pass = 0; pass < 3; pass += 1) {
        for (const match of source.matchAll(/local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*(?:[.:][A-Za-z_][A-Za-z0-9_]*(?:\([^\n)]*\))?)*)/g)) {
            if (variables.has(match[1])) continue;
            const result = expressionResultClass(match[2], variables, classes, namespaces);
            if (result && (classes.has(result) || namespaces.has(result))) variables.set(match[1], result);
        }
    }
    return variables;
}

function buildDiagnostics(source: string, path: string): IdeDiagnostic[] {
    const diagnostics: IdeDiagnostic[] = [];
    const lines = source.split('\n');
    const stack: Array<{ char: string; line: number; column: number }> = [];
    const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    let longComment = false;
    lines.forEach((line, lineIndex) => {
        let quote = '';
        let escaped = false;
        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            const next = line[index + 1];
            if (longComment) {
                if (char === ']' && next === ']') { longComment = false; index += 1; }
                continue;
            }
            if (!quote && char === '-' && next === '-' && line[index + 2] === '[' && line[index + 3] === '[') { longComment = true; break; }
            if (!quote && char === '-' && next === '-') break;
            if (quote) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === quote) quote = '';
                continue;
            }
            if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
            if ('([{'.includes(char)) stack.push({ char, line: lineIndex + 1, column: index + 1 });
            else if (pairs[char]) {
                const open = stack.pop();
                if (!open || open.char !== pairs[char]) diagnostics.push({ severity: 'error', file: path, line: lineIndex + 1, column: index + 1, code: 'unmatched_bracket', message: `Unmatched ${char}.` });
            }
        }
        for (const match of line.matchAll(/\bcontext\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
            if (!moduleApiNames.has(match[1])) diagnostics.push({ severity: 'warning', file: path, line: lineIndex + 1, column: (match.index || 0) + 1, code: 'unknown_rolink_api', message: `context.${match[1]} is not in the current Ro-Link Module API.` });
        }
        if (/\bloadstring\s*\(/.test(line)) diagnostics.push({ severity: 'warning', file: path, line: lineIndex + 1, column: 1, code: 'loadstring', message: 'Avoid loadstring in distributable modules.' });
    });
    for (const open of stack) diagnostics.push({ severity: 'error', file: path, line: open.line, column: open.column, code: 'unclosed_bracket', message: `Unclosed ${open.char}.` });
    return diagnostics;
}

function configureLuau(monaco: typeof Monaco, projectPaths: string[]) {
    currentProjectPaths = projectPaths;
    if (!languageConfigured) {
        monaco.languages.register({ id: 'luau', extensions: ['.luau', '.lua'], aliases: ['Luau'] });
        monaco.languages.setLanguageConfiguration('luau', {
            comments: { lineComment: '--', blockComment: ['--[[', ']]'] },
            brackets: [['{', '}'], ['[', ']'], ['(', ')']],
            autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }, { open: '`', close: '`' }],
            surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }, { open: '`', close: '`' }],
            indentationRules: {
                increaseIndentPattern: /^.*\b(?:then|do|function|repeat)\b.*$|^.*[({[]\s*$/,
                decreaseIndentPattern: /^\s*(?:end|until|else|elseif|[)}\]])/,
            },
        });
        monaco.languages.setMonarchTokensProvider('luau', {
            defaultToken: '',
            tokenPostfix: '.luau',
            keywords: ['and', 'break', 'const', 'continue', 'do', 'else', 'elseif', 'end', 'export', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'type', 'typeof', 'until', 'while'],
            builtins: ['assert', 'bit32', 'buffer', 'CFrame', 'Color3', 'coroutine', 'debug', 'Enum', 'error', 'game', 'Instance', 'ipairs', 'math', 'next', 'os', 'pairs', 'pcall', 'print', 'Random', 'RaycastParams', 'require', 'script', 'select', 'shared', 'string', 'table', 'task', 'tonumber', 'tostring', 'type', 'typeof', 'utf8', 'Vector2', 'Vector3', 'vector', 'warn', 'workspace', 'xpcall'],
            typeKeywords: ['any', 'boolean', 'buffer', 'never', 'nil', 'number', 'string', 'thread', 'unknown'],
            operators: ['+', '-', '*', '/', '//', '%', '^', '#', '==', '~=', '<=', '>=', '<', '>', '=', '+=', '-=', '*=', '/=', '%=', '^=', '..', '->', '::', ':'],
            tokenizer: {
                root: [
                    [/--\[\[/, 'comment', '@comment'],
                    [/--.*$/, 'comment'],
                    [/[a-zA-Z_][\w]*/, { cases: { '@keywords': 'keyword', '@builtins': 'type.identifier', '@typeKeywords': 'type', '@default': 'identifier' } }],
                    [/0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
                    [/`/, 'string', '@interpolated'],
                    [/["']/, { cases: { '"': { token: 'string.quote', next: '@doubleString' }, "'": { token: 'string.quote', next: '@singleString' } } }],
                    [/[{}()[\]]/, '@brackets'],
                    [/[+\-*\/%^#=~<>:.]+/, 'operator'],
                ],
                comment: [[/[^\]]+/, 'comment'], [/\]\]/, 'comment', '@pop'], [/\]/, 'comment']],
                doubleString: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string.quote', '@pop']],
                singleString: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string.quote', '@pop']],
                interpolated: [[/[^\\`]+/, 'string'], [/\\./, 'string.escape'], [/`/, 'string', '@pop']],
            },
        });
        monaco.editor.defineTheme('rolink-luau', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '64748B' },
                { token: 'keyword', foreground: '7DD3FC' },
                { token: 'type', foreground: '67E8F9' },
                { token: 'type.identifier', foreground: '67E8F9' },
                { token: 'string', foreground: '86EFAC' },
                { token: 'number', foreground: 'FCD34D' },
                { token: 'operator', foreground: 'C4B5FD' },
            ],
            colors: {
                'editor.background': '#090d14',
                'editor.foreground': '#e2e8f0',
                'editorLineNumber.foreground': '#475569',
                'editorLineNumber.activeForeground': '#bae6fd',
                'editor.selectionBackground': '#0ea5e944',
                'editor.inactiveSelectionBackground': '#0ea5e922',
                'editorCursor.foreground': '#7dd3fc',
                'editorIndentGuide.background1': '#1e293b',
                'editorIndentGuide.activeBackground1': '#334155',
            },
        });
        languageConfigured = true;
    }

    void Promise.all([loadRobloxMetadata(), loadScriptApiMetadata()]).then(([metadata, scriptApi]) => {
        if (providersConfigured) return;
        providersConfigured = true;
        const classMap = new Map(metadata.classes.map((item) => [item.n, item]));
        const enumMap = new Map(metadata.enums.map((item) => [item.n, item]));
        const services = metadata.classes.filter((item) => item.t?.includes('Service') || item.n.endsWith('Service'));
        const scriptNamespaces = new Map([...scriptApi.libraries, ...scriptApi.dataTypes].map((item) => [item.n, item]));
        const signalNames = new Set(metadata.classes.flatMap((item) => item.m.filter((member) => member.k === 'Event').map((member) => member.n)));

        const scriptMemberSuggestion = (member: ScriptApiMember, range: Monaco.IRange) => ({
            label: member.n,
            kind: completionKind(monaco, member.k),
            insertText: snippetForMember(member),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            detail: member.s,
            documentation: member.d ? { value: member.d } : undefined,
            tags: member.tg?.includes('Deprecated') ? [monaco.languages.CompletionItemTag.Deprecated] : undefined,
        });
        const languageSuggestion = (entry: (typeof luauLanguageSuggestions)[number], range: Monaco.IRange) => ({
            label: entry.label,
            kind: entry.kind === 'snippet' ? monaco.languages.CompletionItemKind.Snippet : entry.kind === 'value' ? monaco.languages.CompletionItemKind.Value : monaco.languages.CompletionItemKind.Keyword,
            insertText: entry.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            detail: entry.detail,
        });

        monaco.languages.registerCompletionItemProvider('luau', {
            triggerCharacters: ['.', ':', '"', "'"],
            provideCompletionItems(model, position) {
                const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
                const word = model.getWordUntilPosition(position);
                const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
                if (/game:GetService\(["'][^"']*$/.test(line)) {
                    return { suggestions: services.map((service) => ({ label: service.n, kind: monaco.languages.CompletionItemKind.Class, insertText: service.n, range, detail: 'Roblox service' })) };
                }
                const enumMatch = /Enum\.([A-Za-z_][A-Za-z0-9_]*)?\.?([A-Za-z0-9_]*)$/.exec(line);
                if (enumMatch) {
                    if (line.endsWith('.')) {
                        const selected = enumMap.get(enumMatch[1] || '');
                        if (selected) return { suggestions: selected.i.map((item) => ({ label: item.n, kind: monaco.languages.CompletionItemKind.EnumMember, insertText: item.n, range, detail: `Enum.${selected.n}.${item.n}` })) };
                    }
                    return { suggestions: metadata.enums.map((item) => ({ label: item.n, kind: monaco.languages.CompletionItemKind.Enum, insertText: item.n, range, detail: `Enum.${item.n}` })) };
                }
                if (/\bcontext\.[A-Za-z0-9_]*$/.test(line)) {
                    return { suggestions: moduleApiMetadata.filter((entry) => entry.name.indexOf('.') === -1).map((entry) => ({ label: entry.name, kind: entry.kind === 'function' ? monaco.languages.CompletionItemKind.Method : monaco.languages.CompletionItemKind.Property, insertText: entry.insertText || entry.name, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: entry.signature, documentation: { value: entry.description } })) };
                }
                const memberMatch = /([A-Za-z_][A-Za-z0-9_]*(?:[.:][A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?)*)[.:]([A-Za-z0-9_]*)$/.exec(line);
                if (memberMatch) {
                    const namespace = scriptNamespaces.get(memberMatch[1]);
                    if (namespace) {
                        const members = scriptApi.dataTypes.includes(namespace)
                            ? namespace.m.filter((member) => member.k !== 'method' && member.k !== 'event' && member.k !== 'callback')
                            : namespace.m;
                        return { suggestions: members.map((member) => scriptMemberSuggestion(member, range)) };
                    }
                    const variableClasses = inferVariableClasses(model.getValue(), classMap, scriptNamespaces);
                    let className = expressionResultClass(memberMatch[1], variableClasses, classMap, scriptNamespaces);
                    if (!className && !memberMatch[1].includes('.') && !memberMatch[1].includes(':')) className = inferredInteractionClass(memberMatch[1], classMap);
                    if (!className) {
                        const precedingMember = memberMatch[1].split(/[.:]/).at(-1);
                        const isSignal = precedingMember && signalNames.has(precedingMember);
                        if (isSignal) className = 'RBXScriptSignal';
                    }
                    const dataType = className ? scriptNamespaces.get(className) : undefined;
                    if (dataType && scriptApi.dataTypes.includes(dataType)) return { suggestions: dataType.m.filter((member) => member.k !== 'constructor').map((member) => scriptMemberSuggestion(member, range)) };
                    if (className) return { suggestions: resolveClassMembers(className, classMap).map((member) => ({ label: member.n, kind: completionKind(monaco, member.k), insertText: snippetForMember(member), insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: memberSignature(member), documentation: { value: `${className}.${member.n}${member.tg?.includes('Deprecated') ? '\n\n**Deprecated**' : ''}` }, tags: member.tg?.includes('Deprecated') ? [monaco.languages.CompletionItemTag.Deprecated] : undefined })) };
                }
                if (/require\(script(?:\.Parent)*\.[A-Za-z0-9_]*$/.test(line)) return { suggestions: currentProjectPaths.filter((path) => path.endsWith('.luau')).map((path) => ({ label: path.split('/').at(-1)?.replace(/\.luau$/, '') || path, kind: monaco.languages.CompletionItemKind.Module, insertText: path.split('/').at(-1)?.replace(/\.luau$/, '') || path, range, detail: path })) };
                if (/^\s*$|(?:^|[^.:])\b[A-Za-z_][A-Za-z0-9_]*$|(?:\s|[=(,])$/.test(line)) {
                    const namespaceSuggestions = [...scriptApi.libraries, ...scriptApi.dataTypes].map((namespace) => ({ label: namespace.n, kind: monaco.languages.CompletionItemKind.Class, insertText: namespace.n, range, detail: namespace.d || `Roblox ${scriptApi.libraries.includes(namespace) ? 'library' : 'data type'}` }));
                    return { suggestions: [...luauLanguageSuggestions.map((entry) => languageSuggestion(entry, range)), ...scriptApi.globals.map((member) => scriptMemberSuggestion(member, range)), ...namespaceSuggestions] };
                }
                return { suggestions: [] };
            },
        });

        monaco.languages.registerHoverProvider('luau', {
            provideHover(model, position) {
                const word = model.getWordAtPosition(position)?.word;
                if (!word) return null;
                const api = moduleApiMetadata.find((entry) => entry.name === word);
                if (api) return { contents: [{ value: `\`\`\`luau\n${api.signature}\n\`\`\`` }, { value: api.description }, ...(api.parameters ? [{ value: api.parameters.map((parameter) => `- \`${parameter.name}: ${parameter.type}\` — ${parameter.description}`).join('\n') }] : [])] };
                const line = model.getLineContent(position.lineNumber);
                const variable = /([A-Za-z_][A-Za-z0-9_]*)[.:][A-Za-z0-9_]*$/.exec(line.slice(0, position.column + word.length))?.[1];
                const className = variable ? inferVariableClasses(model.getValue(), classMap, scriptNamespaces).get(variable) : undefined;
                const member = className ? resolveClassMembers(className, classMap).find((item) => item.n === word) : undefined;
                return member ? { contents: [{ value: `\`\`\`luau\n${className}:${memberSignature(member)}\n\`\`\`` }, { value: member.tg?.includes('Deprecated') ? '**Deprecated Roblox API**' : 'Roblox API member' }] } : null;
            },
        });

        monaco.languages.registerSignatureHelpProvider('luau', {
            signatureHelpTriggerCharacters: ['(', ','],
            provideSignatureHelp(model, position) {
                const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
                const match = /(?:context\.)?([A-Za-z_][A-Za-z0-9_]*)\([^()]*$/.exec(line);
                const entry = match ? moduleApiMetadata.find((item) => item.name === match[1] && item.kind === 'function') : undefined;
                if (!entry) return null;
                const activeParameter = (line.slice(line.lastIndexOf('(') + 1).match(/,/g) || []).length;
                return { value: { signatures: [{ label: entry.signature, documentation: entry.description, parameters: (entry.parameters || []).map((parameter) => ({ label: parameter.name, documentation: parameter.description })) }], activeSignature: 0, activeParameter }, dispose() {} };
            },
        });
    }).catch(() => undefined);
}

export default function ModuleIdeEditor({ value, path, language = 'luau', projectPaths, onChange, onSave, onDiagnostics }: ModuleIdeEditorProps) {
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof Monaco | null>(null);
    const modelPath = useMemo(() => `file:///rolink/${encodeURI(path)}`, [path]);

    const beforeMount = useCallback<BeforeMount>((monaco) => {
        configureLuau(monaco, projectPaths);
    }, [projectPaths]);

    const refreshDiagnostics = useCallback((source: string, editorPath: string) => {
        if (language !== 'luau') { onDiagnostics([]); return; }
        const diagnostics = buildDiagnostics(source, editorPath);
        onDiagnostics(diagnostics);
        const monaco = monacoRef.current;
        const model = editorRef.current?.getModel();
        if (monaco && model) monaco.editor.setModelMarkers(model, 'rolink-luau', diagnostics.map((diagnostic) => ({ severity: diagnostic.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, startLineNumber: diagnostic.line, endLineNumber: diagnostic.line, startColumn: diagnostic.column, endColumn: Math.max(diagnostic.column + 1, model.getLineMaxColumn(diagnostic.line)), message: diagnostic.message, code: diagnostic.code })));
    }, [language, onDiagnostics]);

    const onMount = useCallback<OnMount>((editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onSave);
        editor.addAction({ id: 'rolink.format', label: 'Format Luau Document', keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF], run(instance) {
            const model = instance.getModel();
            if (!model || language !== 'luau') return;
            const lines = model.getValue().split('\n');
            let depth = 0;
            const formatted = lines.map((raw) => {
                const text = raw.trim();
                if (/^(?:end|until|else|elseif)\b|^[)}\]]/.test(text)) depth = Math.max(0, depth - 1);
                const output = `${'\t'.repeat(depth)}${text}`;
                if (/\b(then|do|function|repeat)\s*(?:--.*)?$/.test(text) || /[({[]\s*$/.test(text)) depth += 1;
                if (/^(else|elseif)\b/.test(text)) depth += 1;
                return output;
            }).join('\n');
            instance.executeEdits('rolink-format', [{ range: model.getFullModelRange(), text: formatted }]);
        } });
        refreshDiagnostics(editor.getValue(), path);
    }, [language, onSave, path, refreshDiagnostics]);

    return <Editor
        path={modelPath}
        language={language}
        theme="rolink-luau"
        value={value}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(nextValue) => {
            const source = nextValue ?? '';
            onChange(source);
            refreshDiagnostics(source, path);
        }}
        options={{
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            cursorSmoothCaretAnimation: 'on',
            fontFamily: 'var(--font-geist-mono), Consolas, monospace',
            fontLigatures: true,
            fontSize: 13,
            folding: true,
            formatOnPaste: false,
            glyphMargin: true,
            lineHeight: 21,
            minimap: { enabled: false },
            multiCursorModifier: 'alt',
            padding: { top: 12, bottom: 12 },
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            snippetSuggestions: 'top',
            stickyScroll: { enabled: true },
            suggest: { showDeprecated: true, showMethods: true, showFunctions: true },
            tabCompletion: 'on',
            tabSize: 4,
            insertSpaces: false,
            wordWrap: 'off',
        }}
    />;
}
