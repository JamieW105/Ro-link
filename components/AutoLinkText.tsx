'use client';

import type { ReactNode } from 'react';

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi;
const DEFAULT_LINK_CLASS_NAME = 'break-all font-medium text-sky-300 underline underline-offset-4 transition-colors hover:text-sky-200';

type AutoLinkTextProps = {
    as?: 'div' | 'p' | 'span';
    className?: string;
    linkClassName?: string;
    preserveLineBreaks?: boolean;
    text: string;
};

function splitTrailingPunctuation(value: string) {
    let trimmedValue = value;
    let trailingPunctuation = '';

    while (trimmedValue && /[),.!?:;\]}]/.test(trimmedValue.at(-1) || '')) {
        trailingPunctuation = `${trimmedValue.at(-1)}${trailingPunctuation}`;
        trimmedValue = trimmedValue.slice(0, -1);
    }

    return {
        trailingPunctuation,
        url: trimmedValue,
    };
}

function toHref(value: string) {
    return /^(?:https?:)?\/\//i.test(value) ? value : `https://${value}`;
}

function isLikelyUrl(value: string) {
    try {
        const url = new URL(toHref(value));
        return url.hostname.includes('.');
    } catch {
        return false;
    }
}

function renderLinkifiedText(text: string, linkClassName: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(URL_PATTERN)) {
        const matchIndex = match.index ?? -1;
        if (matchIndex < 0 || matchIndex < lastIndex) {
            continue;
        }

        const fullMatch = match[0];
        const { url, trailingPunctuation } = splitTrailingPunctuation(fullMatch);
        if (!url || !isLikelyUrl(url)) {
            continue;
        }

        if (matchIndex > lastIndex) {
            nodes.push(text.slice(lastIndex, matchIndex));
        }

        nodes.push(
            <a
                key={`link-${matchIndex}-${url}`}
                href={toHref(url)}
                target="_blank"
                rel="noreferrer"
                className={linkClassName}
            >
                {url}
            </a>,
        );

        if (trailingPunctuation) {
            nodes.push(trailingPunctuation);
        }

        lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes.length > 0 ? nodes : [text];
}

function renderTextWithLineBreaks(text: string, linkClassName: string): ReactNode[] {
    const lines = text.split(/\r\n|\r|\n/);

    return lines.flatMap((line, index) => {
        const nodes = renderLinkifiedText(line, linkClassName);

        if (index === lines.length - 1) {
            return nodes;
        }

        return [
            ...nodes,
            <br key={`line-break-${index}`} />,
        ];
    });
}

export default function AutoLinkText({
    as = 'span',
    className,
    linkClassName = DEFAULT_LINK_CLASS_NAME,
    preserveLineBreaks = false,
    text,
}: AutoLinkTextProps) {
    const Component = as;

    return (
        <Component className={className}>
            {preserveLineBreaks
                ? renderTextWithLineBreaks(text, linkClassName)
                : renderLinkifiedText(text, linkClassName)}
        </Component>
    );
}
