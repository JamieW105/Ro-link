'use client';

import { Textarea } from '@/components/ui/textarea';

import { ChangeEvent, UIEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import type { luauHighlighter } from '@/lib/luau-highlighter';

interface LuauCodeBlockProps {
    code: string;
    emptyFallback?: string;
    className?: string;
}

interface LuauCodeEditorProps {
    ariaLabel?: string;
    value: string;
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    required?: boolean;
    className?: string;
    minHeightClassName?: string;
}

function LuauHighlightedCode({ code }: { code: string }) {
    const { resolvedTheme } = useTheme();
    const [highlighter, setHighlighter] = useState<typeof luauHighlighter | null>(null);

    useEffect(() => {
        let active = true;
        // Keep syntax grammar out of pages that never display source code.
        import('@/lib/luau-highlighter').then(({ luauHighlighter }) => {
            if (active) setHighlighter(luauHighlighter);
        }).catch(() => {
            // Source stays visible and editable if a lazy chunk cannot be loaded.
        });
        return () => { active = false; };
    }, []);

    const lines = useMemo(() => highlighter?.codeToTokens(code, {
        lang: 'luau',
        theme: resolvedTheme === 'dark' ? 'github-dark' : 'github-light',
    }).tokens, [code, highlighter, resolvedTheme]);

    if (!lines) return <span className="text-foreground">{code}</span>;

    return <>{lines.map((line, lineIndex) => (
        <span key={lineIndex} data-luau-line="">
            {line.map((token, tokenIndex) => (
                <span key={tokenIndex} data-luau-token="" style={{ color: token.color }}>{token.content}</span>
            ))}
            {lineIndex < lines.length - 1 ? '\n' : null}
        </span>
    ))}</>;
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
    ariaLabel = "Luau source code",
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
        <div data-luau-editor="" className={`relative overflow-hidden rounded-xl border border-border bg-muted transition-colors focus-within:ring-2 focus-within:ring-ring ${className}`}>
            <pre
                ref={highlightRef}
                aria-hidden="true"
                data-luau-highlight=""
                className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-4 font-mono text-xs leading-6 tracking-normal [tab-size:4] ${minHeightClassName}`}
            >
                <code className="[font-family:inherit] [font-size:inherit] [line-height:inherit]">
                    <LuauHighlightedCode code={highlightedValue} />
                </code>
            </pre>
            <Textarea
                aria-label={ariaLabel}
                value={value}
                onChange={onChange}
                onScroll={syncScroll}
                required={required}
                wrap="off"
                className={`relative z-10 w-full border-0  focus-visible:ring-0 resize-y overflow-auto bg-transparent p-4 font-mono text-xs leading-6 tracking-normal [tab-size:4] text-transparent caret-foreground outline-none selection:bg-primary/20 ${minHeightClassName}`}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
            />
        </div>
    );
}
