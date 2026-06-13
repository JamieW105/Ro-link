'use client';

import { ChangeEvent, UIEvent, useMemo, useRef } from 'react';

type LuauTokenType = 'keyword' | 'builtin' | 'string' | 'number' | 'comment' | 'operator' | 'identifier' | 'plain';

interface LuauToken {
    type: LuauTokenType;
    value: string;
}

interface LuauCodeBlockProps {
    code: string;
    emptyFallback?: string;
    className?: string;
}

interface LuauCodeEditorProps {
    value: string;
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    required?: boolean;
    className?: string;
    minHeightClassName?: string;
}

const LUAU_KEYWORDS = new Set([
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
    'until',
    'while',
]);

const LUAU_BUILTINS = new Set([
    'assert',
    'bit32',
    'buffer',
    'CFrame',
    'Color3',
    'coroutine',
    'debug',
    'Enum',
    'error',
    'game',
    'Instance',
    'ipairs',
    'math',
    'next',
    'os',
    'pairs',
    'pcall',
    'print',
    'Random',
    'RaycastParams',
    'require',
    'script',
    'self',
    'shared',
    'string',
    'table',
    'task',
    'tonumber',
    'tostring',
    'type',
    'typeof',
    'UDim2',
    'Vector2',
    'Vector3',
    'warn',
    'workspace',
    'xpcall',
]);

function tokenClassName(type: LuauTokenType) {
    if (type === 'keyword') return 'text-sky-300';
    if (type === 'builtin') return 'text-cyan-300';
    if (type === 'string') return 'text-emerald-300';
    if (type === 'number') return 'text-amber-300';
    if (type === 'comment') return 'text-slate-500';
    if (type === 'operator') return 'text-fuchsia-300';
    return 'text-slate-200';
}

function isIdentifierStart(char: string) {
    return /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string) {
    return /[A-Za-z0-9_]/.test(char);
}

function readLongBracket(source: string, index: number) {
    if (source[index] !== '[') return null;

    let cursor = index + 1;
    while (source[cursor] === '=') cursor += 1;
    if (source[cursor] !== '[') return null;

    const equals = source.slice(index + 1, cursor);
    const closeMarker = `]${equals}]`;
    const contentStart = cursor + 1;
    const closeIndex = source.indexOf(closeMarker, contentStart);
    const end = closeIndex >= 0 ? closeIndex + closeMarker.length : source.length;

    return { end };
}

function readQuotedString(source: string, index: number) {
    const quote = source[index];
    let cursor = index + 1;

    while (cursor < source.length) {
        const char = source[cursor];
        if (char === '\\') {
            cursor += 2;
            continue;
        }
        cursor += 1;
        if (char === quote) break;
    }

    return cursor;
}

function readNumber(source: string, index: number) {
    const rest = source.slice(index);
    const hexMatch = /^0[xX][0-9A-Fa-f]+(?:\.[0-9A-Fa-f]+)?(?:[pP][+-]?\d+)?/.exec(rest);
    if (hexMatch) return index + hexMatch[0].length;

    const decimalMatch = /^(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    return decimalMatch ? index + decimalMatch[0].length : index + 1;
}

function tokenizeLuau(source: string): LuauToken[] {
    const tokens: LuauToken[] = [];
    let index = 0;

    while (index < source.length) {
        const char = source[index];
        const next = source[index + 1];

        if (/\s/.test(char)) {
            let cursor = index + 1;
            while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
            tokens.push({ type: 'plain', value: source.slice(index, cursor) });
            index = cursor;
            continue;
        }

        if (char === '-' && next === '-') {
            const longComment = readLongBracket(source, index + 2);
            if (longComment) {
                tokens.push({ type: 'comment', value: source.slice(index, longComment.end) });
                index = longComment.end;
                continue;
            }

            let cursor = index + 2;
            while (cursor < source.length && source[cursor] !== '\n') cursor += 1;
            tokens.push({ type: 'comment', value: source.slice(index, cursor) });
            index = cursor;
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            const end = readQuotedString(source, index);
            tokens.push({ type: 'string', value: source.slice(index, end) });
            index = end;
            continue;
        }

        const longString = readLongBracket(source, index);
        if (longString) {
            tokens.push({ type: 'string', value: source.slice(index, longString.end) });
            index = longString.end;
            continue;
        }

        if (/\d/.test(char) || (char === '.' && /\d/.test(next || ''))) {
            const end = readNumber(source, index);
            tokens.push({ type: 'number', value: source.slice(index, end) });
            index = end;
            continue;
        }

        if (isIdentifierStart(char)) {
            let cursor = index + 1;
            while (cursor < source.length && isIdentifierPart(source[cursor])) cursor += 1;
            const value = source.slice(index, cursor);
            const type = LUAU_KEYWORDS.has(value)
                ? 'keyword'
                : LUAU_BUILTINS.has(value)
                    ? 'builtin'
                    : 'identifier';
            tokens.push({ type, value });
            index = cursor;
            continue;
        }

        if ('+-*/%^#=~<>;:,.{}[]()'.includes(char)) {
            let cursor = index + 1;
            while (cursor < source.length && '+-*/%^#=~<>;:,.'.includes(source[cursor])) cursor += 1;
            tokens.push({ type: 'operator', value: source.slice(index, cursor) });
            index = cursor;
            continue;
        }

        tokens.push({ type: 'plain', value: char });
        index += 1;
    }

    return tokens;
}

function LuauHighlightedCode({ code }: { code: string }) {
    const tokens = useMemo(() => tokenizeLuau(code), [code]);

    return (
        <>
            {tokens.map((token, index) => (
                <span key={`${index}-${token.type}`} className={tokenClassName(token.type)}>
                    {token.value}
                </span>
            ))}
        </>
    );
}

export function LuauCodeBlock({ code, emptyFallback = 'No source code available.', className = '' }: LuauCodeBlockProps) {
    const displayCode = code || emptyFallback;

    return (
        <pre className={`custom-scrollbar overflow-auto font-mono text-xs leading-relaxed ${className}`}>
            <code>
                <LuauHighlightedCode code={displayCode} />
            </code>
        </pre>
    );
}

export function LuauCodeEditor({
    value,
    onChange,
    required = false,
    className = '',
    minHeightClassName = 'min-h-[540px]',
}: LuauCodeEditorProps) {
    const highlightRef = useRef<HTMLPreElement | null>(null);
    const highlightedValue = value ? `${value}\n` : ' ';

    function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
        if (!highlightRef.current) return;
        highlightRef.current.scrollTop = event.currentTarget.scrollTop;
        highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }

    return (
        <div className={`relative overflow-hidden rounded-xl border border-slate-800 bg-black/50 transition-colors focus-within:border-sky-500 ${className}`}>
            <pre
                ref={highlightRef}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-4 font-mono text-xs leading-relaxed ${minHeightClassName}`}
            >
                <code>
                    <LuauHighlightedCode code={highlightedValue} />
                </code>
            </pre>
            <textarea
                value={value}
                onChange={onChange}
                onScroll={syncScroll}
                required={required}
                wrap="off"
                className={`relative z-10 w-full resize-y overflow-auto bg-transparent p-4 font-mono text-xs leading-relaxed text-transparent caret-sky-100 outline-none selection:bg-sky-500/35 ${minHeightClassName}`}
                spellCheck={false}
            />
        </div>
    );
}
