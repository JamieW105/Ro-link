'use client';

import Link from 'next/link';
import { isValidElement, useEffect, useMemo, useRef, useState, type ReactNode, type SVGProps } from 'react';

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactNode;
type DocCategory = 'Platform' | 'Operations' | 'Configuration' | 'Developer';

type TocItem = {
    id: string;
    title: string;
};

type StatItem = {
    label: string;
    value: string;
};

type DocPage = {
    id: string;
    category: DocCategory;
    eyebrow: string;
    title: string;
    summary: string;
    icon: IconComponent;
    stats: StatItem[];
    toc: TocItem[];
    content: ReactNode;
};

type SearchableElementProps = {
    children?: ReactNode;
    title?: ReactNode;
    description?: ReactNode;
    eyebrow?: ReactNode;
    label?: ReactNode;
    value?: ReactNode;
    items?: ReactNode[];
    headers?: ReactNode[];
    rows?: ReactNode[][];
};

type DocSearchEntry = {
    key: string;
    pageId: string;
    sectionId: string | null;
    title: string;
    subtitle: string;
    body: string;
    tokens: string;
};

type DocSearchResult = DocSearchEntry & {
    score: number;
};

const INSTALLER_PLUGIN_URL = 'https://create.roblox.com/store/asset/87859041511603/RoLink-installer';

const Icons = {
    Book: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
    ),
    Rocket: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.5-1 1-4c2 0 3 .5 3 .5L12 11Z" />
            <path d="M15 9h5s1 .5 4 1c0 2-.5 3-.5 3L11 12Z" />
        </svg>
    ),
    Shield: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    ),
    Server: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect x="2" y="3" width="20" height="8" rx="2" />
            <rect x="2" y="13" width="20" height="8" rx="2" />
            <path d="M6 7h.01" />
            <path d="M6 17h.01" />
            <path d="M10 7h8" />
            <path d="M10 17h8" />
        </svg>
    ),
    Settings: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M12.22 2h-.44a2 2 0 0 0-1.94 1.52l-.23.96a2 2 0 0 1-1.37 1.45l-.94.3A2 2 0 0 1 5.2 6l-.72-.67a2 2 0 0 0-2.83.08l-.31.32a2 2 0 0 0-.08 2.83l.67.72a2 2 0 0 1 .3 2.1l-.3.94A2 2 0 0 1 2 12.22v.44a2 2 0 0 0 1.52 1.94l.96.23a2 2 0 0 1 1.45 1.37l.3.94A2 2 0 0 1 6 18.8l-.67.72a2 2 0 0 0 .08 2.83l.32.31a2 2 0 0 0 2.83.08l.72-.67a2 2 0 0 1 2.1-.3l.94.3a2 2 0 0 1 1.37 1.45l.23.96A2 2 0 0 0 11.78 22h.44a2 2 0 0 0 1.94-1.52l.23-.96a2 2 0 0 1 1.37-1.45l.94-.3A2 2 0 0 1 18.8 18l.72.67a2 2 0 0 0 2.83-.08l.31-.32a2 2 0 0 0 .08-2.83l-.67-.72a2 2 0 0 1-.3-2.1l.3-.94A2 2 0 0 1 22 11.78v-.44a2 2 0 0 0-1.52-1.94l-.96-.23a2 2 0 0 1-1.45-1.37l-.3-.94A2 2 0 0 1 18 5.2l.67-.72a2 2 0 0 0-.08-2.83l-.32-.31a2 2 0 0 0-2.83-.08l-.72.67a2 2 0 0 1-2.1.3l-.94-.3a2 2 0 0 1-1.37-1.45l-.23-.96A2 2 0 0 0 12.22 2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    Key: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="m21 2-2 2a5 5 0 0 0-7 7l-9 9v3h3l9-9a5 5 0 0 0 7-7l2-2Z" />
            <path d="m15 5 4 4" />
        </svg>
    ),
    Terminal: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
    ),
    Activity: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    Users: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    Globe: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    ),
    Search: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    ),
    ChevronRight: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="m9 18 6-6-6-6" />
        </svg>
    ),
    ExternalLink: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    ),
    Copy: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
    ),
    Check: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
    Menu: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
    ),
    X: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    ),
    AlertTriangle: (props: SVGProps<SVGSVGElement>) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="m10.29 3.86-7.5 13A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.71-3.14l-7.5-13a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
} as const;

function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

function InlineCode({ children }: { children: ReactNode }) {
    return <code className="rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[0.92em] text-sky-300">{children}</code>;
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 transition-colors hover:text-sky-200">
            {children}
            <Icons.ExternalLink className="h-3.5 w-3.5" />
        </a>
    );
}

function SectionCard({
    id,
    eyebrow,
    title,
    description,
    children,
}: {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24 border-t border-white/8 pt-10 first:border-t-0 first:pt-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-400/90">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[2.35rem]">{title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">{description}</p>
            <div className="mt-7 space-y-5">{children}</div>
        </section>
    );
}

function Callout({
    title,
    tone = 'info',
    children,
}: {
    title: string;
    tone?: 'info' | 'warn' | 'success';
    children: ReactNode;
}) {
    const tones = {
        info: { border: 'border-sky-500/20', bg: 'bg-sky-500/8', text: 'text-sky-200/90', title: 'text-sky-300', icon: Icons.Activity },
        warn: { border: 'border-amber-500/20', bg: 'bg-amber-500/8', text: 'text-amber-100/85', title: 'text-amber-300', icon: Icons.AlertTriangle },
        success: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/8', text: 'text-emerald-100/85', title: 'text-emerald-300', icon: Icons.Check },
    }[tone];
    const Icon = tones.icon;

    return (
        <div className={cn('w-full rounded-2xl border p-5', tones.border, tones.bg)}>
            <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 shrink-0 rounded-xl border p-2', tones.border, tones.bg)}>
                    <Icon className={cn('h-4 w-4', tones.title)} />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className={cn('text-sm font-bold', tones.title)}>{title}</h3>
                    <div className={cn('mt-2 text-sm leading-7', tones.text)}>{children}</div>
                </div>
            </div>
        </div>
    );
}

function CodeBlock({ children, label }: { children: ReactNode; label: string }) {
    const [copied, setCopied] = useState(false);
    const codeId = `code-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    function copyToClipboard() {
        const text = document.getElementById(codeId)?.innerText || String(children);
        navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }

    return (
        <div className="min-w-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#111827]">
            <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.02] px-4 py-3">
                <span className="min-w-0 truncate pr-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</span>
                <button
                    type="button"
                    onClick={copyToClipboard}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-white"
                >
                    {copied ? <Icons.Check className="h-3.5 w-3.5 text-emerald-400" /> : <Icons.Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre id={codeId} className="custom-scrollbar w-full max-w-full overflow-x-auto p-4 text-sm leading-7 text-slate-300">
                <code>{children}</code>
            </pre>
        </div>
    );
}

function Checklist({ items }: { items: string[] }) {
    return (
        <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-7 text-slate-300">
                    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-300">
                        <Icons.Check className="h-3 w-3" />
                    </span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
        <div className="table-responsive overflow-hidden rounded-[18px] border border-white/10">
            <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-white/[0.03]">
                    <tr>
                        {headers.map((header) => (
                            <th key={header} className="px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/8 bg-[#0f172a]/55">
                    {rows.map((row) => (
                        <tr key={row.join('-')}>
                            {row.map((cell, index) => (
                                <td key={`${row[0]}-${headers[index]}`} className={cn('px-4 py-3 align-top text-sm leading-7', index === 0 ? 'font-mono text-sky-300' : 'text-slate-300')}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function InfoGrid({
    items,
    columns = 'md:grid-cols-3',
}: {
    items: Array<{ title: string; description: string; meta?: string }>;
    columns?: string;
}) {
    return (
        <div className={cn('grid gap-4', columns)}>
            {items.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                    {item.meta && <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-400/85">{item.meta}</p>}
                    <h3 className="mt-2 text-base font-semibold text-white first:mt-0">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-400">{item.description}</p>
                </div>
            ))}
        </div>
    );
}

function StepList({ steps }: { steps: Array<{ title: string; description: string }> }) {
    return (
        <ol className="space-y-3">
            {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sm font-bold text-sky-300">
                        {index + 1}
                    </span>
                    <div>
                        <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                        <p className="mt-1 text-sm leading-7 text-slate-400">{step.description}</p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function ResourceCard({
    href,
    icon: Icon,
    title,
    description,
    external,
}: {
    href: string;
    icon: IconComponent;
    title: string;
    description: string;
    external?: boolean;
}) {
    const content = (
        <div className="group flex h-full items-center gap-4 rounded-[18px] border border-white/10 bg-white/[0.02] p-5 transition-all duration-200 hover:border-sky-400/30 hover:bg-white/[0.04]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sky-300">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-white transition-colors group-hover:text-sky-200">{title}</h3>
                <p className="mt-1.5 text-sm leading-7 text-slate-400">{description}</p>
            </div>
            <Icons.ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-200" />
        </div>
    );

    if (external) {
        return (
            <a href={href} target="_blank" rel="noreferrer">
                {content}
            </a>
        );
    }

    return <Link href={href}>{content}</Link>;
}

function PageStat({ label, value }: StatItem) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
            <span className="text-sm font-medium text-slate-200">{value}</span>
        </div>
    );
}

function NavButton({
    active,
    icon: Icon,
    children,
    onClick,
}: {
    active: boolean;
    icon: IconComponent;
    children: ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200',
                active ? 'bg-sky-500/12 text-sky-200 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.2)]' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
            )}
        >
            <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300')} />
            <span className="truncate">{children}</span>
        </button>
    );
}

function normalizeSearchText(value: string) {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function collectSearchText(node: ReactNode): string {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(collectSearchText).filter(Boolean).join(' ');

    if (isValidElement<SearchableElementProps>(node)) {
        const props = node.props;
        const values: ReactNode[] = [props.eyebrow, props.title, props.description, props.label, props.value, props.children];

        if (Array.isArray(props.items)) values.push(...props.items);
        if (Array.isArray(props.headers)) values.push(...props.headers);
        if (Array.isArray(props.rows)) values.push(...props.rows.flat());

        return values.map(collectSearchText).filter(Boolean).join(' ');
    }

    return '';
}

function buildSearchEntries(pages: DocPage[]): DocSearchEntry[] {
    return pages.flatMap((page) => {
        const pageBody = [
            page.eyebrow,
            page.summary,
            page.category,
            ...page.stats.flatMap((stat) => [stat.label, stat.value]),
            ...page.toc.map((item) => item.title),
            collectSearchText(page.content),
        ].join(' ');

        const pageEntry: DocSearchEntry = {
            key: page.id,
            pageId: page.id,
            sectionId: null,
            title: page.title,
            subtitle: page.category,
            body: pageBody,
            tokens: normalizeSearchText(`${page.title} ${pageBody}`),
        };

        const sectionEntries = page.toc.map((section) => {
            const body = `${page.title} ${page.summary} ${page.category} ${section.title} ${pageBody}`;

            return {
                key: `${page.id}/${section.id}`,
                pageId: page.id,
                sectionId: section.id,
                title: section.title,
                subtitle: page.title,
                body,
                tokens: normalizeSearchText(body),
            };
        });

        return [pageEntry, ...sectionEntries];
    });
}

function scoreSearchEntry(entry: DocSearchEntry, query: string, queryParts: string[]) {
    const title = normalizeSearchText(entry.title);
    const subtitle = normalizeSearchText(entry.subtitle);
    let score = 0;

    if (title === query) score += 120;
    if (title.startsWith(query)) score += 80;
    if (title.includes(query)) score += 50;
    if (subtitle.includes(query)) score += 25;
    if (entry.tokens.includes(query)) score += 15;

    for (const part of queryParts) {
        if (title.includes(part)) score += 16;
        else if (subtitle.includes(part)) score += 8;
        else if (entry.tokens.includes(part)) score += 4;
    }

    if (!entry.sectionId) score += 5;
    return score;
}

const commandGroups = [
    {
        title: 'Moderation',
        accent: 'text-sky-300',
        commands: [
            { name: 'KICK', args: '{ username: string, reason?: string }', description: 'Remove a player from the active server.' },
            { name: 'BAN', args: '{ username: string, reason?: string }', description: 'Ban a player through the Ro-Link moderation pipeline.' },
            { name: 'UNBAN', args: '{ username: string }', description: 'Revoke a previously issued ban.' },
        ],
    },
    {
        title: 'Server Control',
        accent: 'text-sky-300',
        commands: [
            { name: 'SHUTDOWN', args: '{ job_id?: string }', description: 'Shutdown one server or every active server when job_id is omitted.' },
            { name: 'UPDATE', args: '{}', description: 'Start the update flow for live servers before a release.' },
        ],
    },
    {
        title: 'Player Actions',
        accent: 'text-sky-300',
        commands: [
            { name: 'FLY / NOCLIP / INVISIBLE', args: '{ username: string }', description: 'Core utility actions commonly used during moderation.' },
            { name: 'SET_CHAR', args: '{ username: string, char_user: string }', description: 'Swap a player into another character model.' },
            { name: 'Custom misc actions', args: '{ username: string, ... }', description: 'Your dashboard may expose additional game-specific actions if your integration supports them.' },
        ],
    },
] as const;

const moduleDeveloperFunctions = [
    ['Module', 'table', 'Published marketplace module metadata for the currently running module.'],
    ['Config', 'table', 'Parsed CONFIG schema declared at the top of the uploaded module source.'],
    ['Settings', 'table', 'Per-server settings configured from the dashboard module install page.'],
    ['Services', 'table', 'Whitelisted Roblox services such as Players, HttpService, ReplicatedStorage, RunService, Workspace, Lighting, MessagingService, and ServerScriptService.'],
    ['RegisterCommand(commandName, handler)', 'function', 'Adds a custom command handler. Handlers receive command payload, context, and args.'],
    ['RegisterPanelCommand(definition, handler)', 'function', 'Registers a module command and exposes it in the in-game Cmds panel with title, description, target, and field metadata.'],
    ['OnAdminPanelOpened(handler)', 'function', 'Runs when an authorized user opens the in-game admin panel. Handler receives player, payload, and context.'],
    ['OnCommandBarOpened(handler)', 'function', 'Runs when an authorized user opens the in-game command bar. Handler receives player, payload, and context.'],
    ['SendBotMessage(target, user, channelId, content)', 'function', 'Sends a Discord bot message through Ro-Link after validating the server, channel, or member target.'],
    ['GetDiscordChannels()', 'function', 'Returns sendable Discord channels for the current server.'],
    ['GetUserData(user)', 'function', 'Returns Roblox user data, server role rank, and linked Discord user/member data when the user is linked.'],
    ['GetReports(options)', 'function', 'Reads reports for the current server. options can include status, limit, target, or reporter.'],
    ['GetReport(reportId)', 'function', 'Reads one report from the current server.'],
    ['CreateReport(body)', 'function', 'Creates a pending report for the current server.'],
    ['UpdateReport(reportId, updates)', 'function', 'Edits report status, notes, target, reason, or moderator fields for the current server.'],
    ['CreateUI(target, functionOrTree, props)', 'function', 'Creates Roblox UI for one player, all players, or a target list. Installed modules should pass a function or UI tree table.'],
    ['_G.RoLinkModuleUI.Bind(guiObject, handler, options)', 'function', 'Binds client UI input from CreateUI instances back to server-side module code.'],
    ['FindPlayer(target)', 'function', 'Finds one live Roblox player by Player instance, username, or UserId.'],
    ['GetPlayers()', 'function', 'Returns the current live Players list.'],
    ['Notify(target, message, success)', 'function', 'Shows admin-panel feedback where the Studio package exposes the feedback remote.'],
    ['Log(...)', 'function', 'Prints a namespaced marketplace module log line.'],
] as const;

const docsPages: DocPage[] = [
    {
        id: 'getting-started',
        category: 'Platform',
        eyebrow: 'Platform Overview',
        title: 'Getting Started',
        summary: 'A full walkthrough of the Ro-Link rollout path, the systems involved, and the minimum requirements to get from install to first live command cleanly.',
        icon: Icons.Rocket,
        stats: [
            { label: 'Recommended flow', value: 'Discord -> Dashboard -> Roblox' },
            { label: 'First live test', value: 'After one server is active' },
            { label: 'Primary surfaces', value: 'Dashboard, installer plugin, Open Cloud' },
        ],
        toc: [
            { id: 'overview-platform', title: 'What Ro-Link manages' },
            { id: 'recommended-rollout', title: 'Recommended rollout order' },
            { id: 'prerequisites', title: 'Before you begin' },
            { id: 'working-areas', title: 'Where work happens' },
        ],
        content: (
            <div className="space-y-6">
                <SectionCard
                    id="overview-platform"
                    eyebrow="Overview"
                    title="What Ro-Link manages"
                    description="Ro-Link is not just a bot invite. It is a control surface that connects your Discord staff workflow, your dashboard configuration, and your live Roblox servers into one operational path."
                >
                    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
                        {[
                            { icon: Icons.Server, title: 'Live server visibility', body: 'See active servers, inspect player rosters, and target individual jobs instead of moderating blind.' },
                            { icon: Icons.Shield, title: 'Moderation control', body: 'Issue moderation and utility actions from the dashboard or API without joining the experience manually.' },
                            { icon: Icons.Activity, title: 'Operational logging', body: 'Track what was sent, by whom, and when, so your staff team has an audit trail for reviews and reports.' },
                            { icon: Icons.Users, title: 'Staff workflow', body: 'Keep Discord staff, Roblox runtime, and dashboard configuration aligned around the same server record.' },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                    <div className="inline-flex rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-300">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-slate-400">{item.body}</p>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
                <SectionCard
                    id="recommended-rollout"
                    eyebrow="Rollout"
                    title="Recommended rollout order"
                    description="The cleanest setup sequence is to establish ownership and keys first, install the Ro-Link Studio plugin second, and only then test live commands. That prevents false negatives caused by missing runtime or permission gaps."
                >
                    <div className="grid gap-4 xl:grid-cols-2">
                        {[
                            ['01', 'Connect the Discord side', 'Invite Ro-Link, sign into the dashboard, and confirm you are operating on the correct Discord server before editing any configuration.'],
                            ['02', 'Collect Roblox identifiers', 'Gather the Place ID, Universe ID, and the correct owner-scoped Open Cloud key for the experience you are linking.'],
                            ['03', 'Run the installer plugin', 'Install the RoLink installer plugin in Roblox Studio, paste in your dashboard security key, and let it configure the bridge for you.'],
                            ['04', 'Run a controlled live test', 'Test a low-risk command or lookup first, confirm logging is correct, then move into day-to-day moderation use.'],
                        ].map(([step, title, body]) => (
                            <div key={step} className="rounded-2xl border border-white/10 bg-[#08101f]/70 p-5">
                                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-300">{step}</div>
                                <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-400">{body}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard
                    id="prerequisites"
                    eyebrow="Requirements"
                    title="Before you begin"
                    description="The fastest way to lose time during setup is to start without the correct ownership scope or without a live server available for testing. Make sure the basics below are settled before you continue."
                >
                    <Checklist
                        items={[
                            'A Discord server where Ro-Link is installed and where you have permission to configure it.',
                            'A Roblox experience that you own directly, or a group-owned experience where you can create owner-scoped credentials.',
                            'Access to Roblox Studio so you can run the installer plugin and publish a fresh build.',
                            'At least one runtime server you can start for live delivery testing after installation.',
                            'A plan for which staff roles should have moderation access before the dashboard goes live.',
                            'A release version you want staff and users to see on the landing page when update posts are published.',
                        ]}
                    />
                </SectionCard>

                <SectionCard
                    id="working-areas"
                    eyebrow="Navigation"
                    title="Where work happens"
                    description="Ro-Link operations are split across a few surfaces. Treat each surface as a dedicated job area rather than trying to do everything from one screen."
                >
                    <div className="grid gap-4 xl:grid-cols-3">
                        <ResourceCard href="/dashboard" icon={Icons.Server} title="Dashboard" description="Configure servers, inspect live activity, publish updates, and manage settings." />
                        <ResourceCard href="/posts" icon={Icons.Book} title="Update Posts" description="Review published release notes and verify that public versioning matches the latest rollout." />
                        <ResourceCard href="https://create.roblox.com/dashboard/creations/experiences" icon={Icons.Globe} title="Creator Dashboard" description="Use Roblox Creator Dashboard to collect identifiers and create the correct Open Cloud key." external />
                    </div>

                    <div className="mt-6">
                        <Callout title="Operational advice" tone="info">
                            Use a staging or private server for your first command tests whenever possible. It keeps staff training, version checks, and misc action validation away from public players while you finish the initial setup.
                        </Callout>
                    </div>
                </SectionCard>
            </div>
        ),
    },
    {
        id: 'dashboard-operations',
        category: 'Operations',
        eyebrow: 'Dashboard Operations',
        title: 'Dashboard Guide',
        summary: 'The dashboard is the operational core of Ro-Link. Use it to set up a server record, manage live runtime actions, inspect logs, and control public-facing release information.',
        icon: Icons.Settings,
        stats: [
            { label: 'Main job', value: 'Setup, live ops, release control' },
            { label: 'Best practice', value: 'Verify logs after every rollout' },
            { label: 'Release source', value: 'Update post version drives landing badge' },
        ],
        toc: [
            { id: 'dashboard-sections', title: 'Core dashboard areas' },
            { id: 'dashboard-permissions', title: 'Permissions and access' },
            { id: 'dashboard-release-flow', title: 'Publishing update posts' },
            { id: 'dashboard-playbook', title: 'Operational playbook' },
        ],
        content: (
            <div className="space-y-6">
                <SectionCard
                    id="dashboard-sections"
                    eyebrow="Navigation"
                    title="Core dashboard areas"
                    description="Each tab serves a different operational role. Staff teams work faster when they treat these areas as distinct workflows instead of mixing setup, moderation, and release work together."
                >
                    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                        {[
                            ['Server Setup', 'Store the Roblox-side identifiers and credentials needed for the selected Discord server.'],
                            ['Servers', 'Inspect live jobs, open a server, and act on the current players connected to that runtime.'],
                            ['Players / Misc', 'Run player-level actions and live utilities when your integration exposes them.'],
                            ['Logs', 'Review delivered commands, moderation actions, and operational history after each test or staff action.'],
                            ['Settings', 'Adjust configuration and use the removal controls when Ro-Link needs to be detached from a server.'],
                            ['Posts', 'Publish update posts, set a release version, and keep the landing page version marker aligned with the latest release.'],
                        ].map(([title, body]) => (
                            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <h3 className="text-lg font-semibold text-white">{title}</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-400">{body}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard
                    id="dashboard-permissions"
                    eyebrow="Access Control"
                    title="Permissions and access"
                    description="Ro-Link should not be exposed to every staff member by default. Keep setup permissions narrow, and expand runtime permissions only to the people who actually need them."
                >
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4 text-sm leading-7 text-slate-300">
                            <p>Dashboard access should be limited to trusted Discord accounts that need to operate on the selected server. Separate configuration work from day-to-day moderation where possible.</p>
                            <p>If a staff member can publish updates, they should understand that the <InlineCode>Version</InlineCode> field is not cosmetic. The latest published update version is also what the landing page uses for its public release badge.</p>
                            <p>After permission changes, confirm that the affected user can still open the correct dashboard server and that the pages they should not control are no longer reachable.</p>
                        </div>

                        <Checklist
                            items={[
                                'Restrict setup credentials to owners or senior technical staff.',
                                'Use logs as part of routine moderation review, not only when something breaks.',
                                'Recheck release permissions before giving access to update post publishing.',
                                'When removing Ro-Link from a server, decide separately whether the bot should leave, data should be deleted, or both.',
                            ]}
                        />
                    </div>
                </SectionCard>

                <SectionCard
                    id="dashboard-release-flow"
                    eyebrow="Release Notes"
                    title="Publishing update posts"
                    description="Update posts are both public communication and release metadata. Keeping them structured makes the docs, posts page, and landing page feel consistent."
                >
                    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#08101f]/70 p-5 text-sm leading-7 text-slate-300">
                            <h3 className="text-lg font-semibold text-white">Recommended publishing flow</h3>
                            <ol className="space-y-3">
                                <li>1. Set the version to the exact release you want exposed publicly, for example <InlineCode>V2.01.0</InlineCode>.</li>
                                <li>2. Write the title and summary around the actual release, not an internal task name.</li>
                                <li>3. Split notes into major features, minor updates, QOL changes, and bug fixes so staff and users can scan quickly.</li>
                                <li>4. Publish only after the release is live or your rollout plan is ready for public visibility.</li>
                            </ol>
                        </div>

                        <Callout title="Version behavior" tone="success">
                            The landing page version badge reads from the newest published update post that contains a version. If you publish a post with an older or placeholder version, the public site will reflect that immediately.
                        </Callout>
                    </div>
                </SectionCard>
                <SectionCard
                    id="dashboard-playbook"
                    eyebrow="Operations"
                    title="Operational playbook"
                    description="A few basic habits keep the dashboard reliable during daily staff use and during releases."
                >
                    <Checklist
                        items={[
                            'Run a low-risk live action after any major config change so you know runtime delivery still works.',
                            'Check logs after publishing a release or using bulk moderation actions.',
                            'Use targeted server actions first before global actions when investigating a live issue.',
                            'Keep release versions consistent across update posts, changelogs, and any external announcements.',
                            'Revisit server settings whenever Roblox credentials or game ownership change.',
                            'Remove stale test data from old servers instead of leaving extra records attached forever.',
                        ]}
                    />
                </SectionCard>
            </div>
        ),
    },
    {
        id: 'roblox-configuration',
        category: 'Configuration',
        eyebrow: 'Roblox Configuration',
        title: 'Roblox Setup',
        summary: 'Collect the correct Roblox identifiers and create the right owner-scoped Open Cloud credential before you attempt runtime command delivery.',
        icon: Icons.Globe,
        stats: [
            { label: 'Required identifiers', value: 'Place ID + Universe ID' },
            { label: 'Credential scope', value: 'Owner or group owner' },
            { label: 'Delivery path', value: 'Open Cloud + MessagingService' },
        ],
        toc: [
            { id: 'roblox-identifiers', title: 'Experience identifiers' },
            { id: 'roblox-api-key', title: 'Open Cloud key' },
            { id: 'roblox-permissions', title: 'Required permissions' },
            { id: 'roblox-preflight', title: 'Preflight checks' },
        ],
        content: (
            <div className="space-y-6">
                <SectionCard
                    id="roblox-identifiers"
                    eyebrow="Identifiers"
                    title="Collect the experience identifiers first"
                    description="Ro-Link needs both the starting place and the universe-level experience record. These are not interchangeable, and using the wrong one usually shows up later as a failed lookup or delivery issue."
                >
                    <div className="grid gap-6 xl:grid-cols-2">
                        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#08101f]/70 p-5">
                            <h3 className="text-lg font-semibold text-white">Place ID</h3>
                            <p className="text-sm leading-7 text-slate-400">This is the ID of the starting place or specific place you are targeting from the Roblox game URL.</p>
                            <CodeBlock label="Roblox game URL">{'https://www.roblox.com/games/1234567890/Your-Game'}</CodeBlock>
                            <p className="text-sm leading-7 text-slate-400">In the example above, <InlineCode>1234567890</InlineCode> is the Place ID.</p>
                        </div>

                        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#08101f]/70 p-5">
                            <h3 className="text-lg font-semibold text-white">Universe ID</h3>
                            <p className="text-sm leading-7 text-slate-400">Also called the Experience ID. This is what Open Cloud and many platform-level Roblox services use.</p>
                            <CodeBlock label="Creator Dashboard URL">{'https://create.roblox.com/dashboard/creations/experiences/9876543210/overview'}</CodeBlock>
                            <p className="text-sm leading-7 text-slate-400">In this example, <InlineCode>9876543210</InlineCode> is the Universe ID.</p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    id="roblox-api-key"
                    eyebrow="Credentials"
                    title="Create the Open Cloud key with the correct owner scope"
                    description="Most setup failures happen here. The key has to belong to the real experience owner, not just someone with edit permission."
                >
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4 text-sm leading-7 text-slate-300">
                            <p>Open the Roblox Creator Dashboard credentials screen and switch to the same owner context that owns the target experience. For a personal game, that means your personal owner scope. For a group game, switch to the group owner scope before creating the key.</p>
                            <p>A contributor-generated key with editing access can still fail with permission errors if it is not created under the true owner context. That distinction matters.</p>
                            <ExternalAnchor href="https://create.roblox.com/dashboard/open-cloud">Open Roblox Open Cloud credentials</ExternalAnchor>
                        </div>

                        <Callout title="Common failure mode" tone="warn">
                            If Roblox returns <InlineCode>PermissionDenied</InlineCode> or if actions never reach the game despite valid-looking config, re-check the credential owner scope before investigating anything else.
                        </Callout>
                    </div>
                </SectionCard>

                <SectionCard
                    id="roblox-permissions"
                    eyebrow="Permissions"
                    title="Required Open Cloud permissions"
                    description="Keep the permission set tight, but make sure the services Ro-Link needs are actually granted on the created key."
                >
                    <DataTable
                        headers={['Service', 'Permission', 'Why it matters']}
                        rows={[
                            ['Messaging Service', 'Publish', 'Used to queue commands and signals toward live Roblox servers.'],
                            ['User API', 'Read', 'Used for Roblox-side identity lookups and validation flows.'],
                            ['Universe scope', 'Target experience', 'The key must be restricted to the experience you actually intend to control.'],
                        ]}
                    />
                    <div className="mt-6">
                        <Callout title="Scope carefully" tone="info">
                            Restrict the key to the intended experience instead of creating a broad key for every project you own. It reduces the blast radius if the credential ever has to be rotated.
                        </Callout>
                    </div>
                </SectionCard>

                <SectionCard
                    id="roblox-preflight"
                    eyebrow="Verification"
                    title="Preflight checks before installation"
                    description="Run these checks before you paste any values into the dashboard. It is faster than debugging a full install with one bad identifier."
                >
                    <Checklist
                        items={[
                            'The Place ID opens the correct Roblox game page.',
                            'The Universe ID matches the same experience in Creator Dashboard.',
                            'The Open Cloud key is owner-scoped to the same experience.',
                            'Messaging Service publish permission is present on the credential.',
                            'You know which live server you will use for the first delivery test.',
                            'You have a safe user or staff account ready for a low-risk command test.',
                        ]}
                    />
                </SectionCard>
            </div>
        ),
    },
    {
        id: 'installation',
        category: 'Configuration',
        eyebrow: 'Game Installation',
        title: 'Installer Plugin',
        summary: 'Use the RoLink installer plugin, publish the game, and run a controlled live verification so you know the runtime is really attached before staff start using it.',
        icon: Icons.Book,
        stats: [
            { label: 'Install method', value: 'Roblox Studio plugin' },
            { label: 'Security input', value: 'Dashboard security key' },
            { label: 'Runtime requirement', value: 'Published server build' },
        ],
        toc: [
            { id: 'installation-plugin', title: 'Install the plugin' },
            { id: 'installation-config', title: 'Configuration values' },
            { id: 'installation-publish', title: 'Publish checklist' },
            { id: 'installation-verify', title: 'Live verification' },
        ],
        content: (
            <div className="space-y-6">
                <SectionCard
                    id="installation-plugin"
                    eyebrow="Runtime"
                    title="Install the RoLink Studio plugin"
                    description="Use the installer plugin to place and configure the Ro-Link bridge in Studio instead of wiring the integration by hand."
                >
                    <div className="space-y-5">
                        <ResourceCard
                            href={INSTALLER_PLUGIN_URL}
                            icon={Icons.Book}
                            title="RoLink installer"
                            description="Open the Creator Store listing for the official Ro-Link installer plugin."
                            external
                        />
                        <p className="text-sm leading-7 text-slate-300">
                            After installing it in Studio, open the plugin from the <InlineCode>Plugins</InlineCode> tab and follow its setup flow. The plugin is now the supported installation path for the runtime bridge.
                        </p>
                    </div>
                </SectionCard>

                <SectionCard
                    id="installation-config"
                    eyebrow="Configuration"
                    title="Use the right value in the right field"
                    description="Ro-Link uses a dashboard-generated security key inside the installer plugin. Do not paste the raw Open Cloud credential into random plugin or script fields unless the setup flow explicitly asks for it."
                >
                    <DataTable
                        headers={['Field', 'Source', 'Notes']}
                        rows={[
                            ['Security key', 'Ro-Link dashboard server setup', 'This is the value you paste into the installer plugin when it asks to connect your game.'],
                            ['Plugin setup flow', 'RoLink installer', 'Let the plugin place and configure the runtime bridge instead of creating scripts manually.'],
                            ['Open Cloud key', 'Roblox Creator Dashboard', 'Keep this in server configuration. It is not a replacement for the dashboard security key.'],
                        ]}
                    />
                    <div className="mt-6">
                        <Callout title="Keep credentials separated" tone="warn">
                            The Open Cloud credential and the dashboard security key serve different jobs. Mixing them is a common setup mistake and can expose a more sensitive credential in the wrong place.
                        </Callout>
                    </div>
                </SectionCard>
                <SectionCard
                    id="installation-publish"
                    eyebrow="Deployment"
                    title="Publish checklist"
                    description="Runtime changes do not exist for live servers until you publish. Treat publication as part of the install, not as an optional extra step."
                >
                    <Checklist
                        items={[
                            'Install the official RoLink installer plugin from the Creator Store.',
                            'Open the plugin in Studio and paste the dashboard security key when prompted.',
                            'Let the plugin finish placing and configuring the bridge files for your game.',
                            'Publish the latest Studio build to Roblox.',
                            'Open or restart a test server after publishing so the new plugin-installed bridge actually runs.',
                            'Confirm the dashboard server record contains the correct Place ID, Universe ID, and credentials.',
                            'Enable HTTP Requests and API Services in Game Settings if your Studio/project setup still requires it.',
                        ]}
                    />
                </SectionCard>

                <SectionCard
                    id="installation-verify"
                    eyebrow="Validation"
                    title="Run a live verification pass"
                    description="A successful install is one that can be observed end-to-end: dashboard or API action accepted, live server receives it, and the result appears in logs."
                >
                    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                        <div className="rounded-2xl border border-white/10 bg-[#08101f]/70 p-5">
                            <h3 className="text-lg font-semibold text-white">Suggested first test</h3>
                            <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                                <li>1. Start one controlled server.</li>
                                <li>2. Open the dashboard server view and confirm the live job is visible.</li>
                                <li>3. Run a low-risk action such as a lookup or a harmless misc action.</li>
                                <li>4. Confirm the expected result appears in the game and in dashboard logs.</li>
                                <li>5. Only after that should you move on to broader staff use.</li>
                            </ol>
                        </div>

                        <Callout title="If the command does not land" tone="info">
                            Check three things in order: whether a live server is actually running the latest plugin-installed bridge, whether the server config still matches the correct experience, and whether the Open Cloud key was created under the true owner scope.
                        </Callout>
                    </div>
                </SectionCard>
            </div>
        ),
    },
    {
        id: 'public-api',
        category: 'Developer',
        eyebrow: 'Developer API',
        title: 'Public API',
        summary: 'Use the Ro-Link API to look up Roblox users, resolve verified account mappings, and send server commands from external systems such as control panels or Discord automation.',
        icon: Icons.Terminal,
        stats: [
            { label: 'Auth header', value: 'x-api-key' },
            { label: 'Response model', value: 'Queued, then delivered' },
            { label: 'Best use case', value: 'Controlled external automation' },
        ],
        toc: [
            { id: 'api-auth', title: 'Authentication' },
            { id: 'api-user', title: 'GET /user' },
            { id: 'api-lookup', title: 'GET /lookup' },
            { id: 'api-command', title: 'POST /command' },
            { id: 'api-reference', title: 'Command reference' },
            { id: 'api-limits', title: 'Limits and responses' },
        ],
        content: (
            <div className="space-y-6">
                <SectionCard
                    id="api-auth"
                    eyebrow="Authentication"
                    title="Authenticate every request with your server key"
                    description="External API requests should be treated as privileged actions. Store the key securely, rotate it when needed, and never embed it in public client-side code."
                >
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                            <CodeBlock label="Required header">{'x-api-key: rl_xxxxxxxxxxxxx'}</CodeBlock>
                            <CodeBlock label="Example curl">{'curl -H "x-api-key: rl_xxxxxxxxxxxxx" "https://rolink.cloud/api/v1/user?username=Roblox"'}</CodeBlock>
                        </div>
                        <Callout title="Server-side only" tone="warn">
                            Keep the API key on your backend or secured automation layer. Do not expose it in browser bundles, public repos, or client scripts.
                        </Callout>
                    </div>
                </SectionCard>

                <SectionCard
                    id="api-user"
                    eyebrow="Endpoint"
                    title="GET /user"
                    description="Resolve a Roblox username into player profile details through the Ro-Link API surface."
                >
                    <CodeBlock label="Request">{'GET https://rolink.cloud/api/v1/user?username=Roblox'}</CodeBlock>
                    <div className="mt-6">
                        <DataTable headers={['Parameter', 'Type', 'Required', 'Description']} rows={[['username', 'string', 'Yes', 'The exact Roblox username to resolve.']]} />
                    </div>
                    <div className="mt-6">
                        <CodeBlock label="Example response">
                            {`{
  "id": 1,
  "name": "Roblox",
  "displayName": "Roblox",
  "hasVerifiedBadge": true,
  "isBanned": false,
  "description": "The official Roblox account."
}`}
                        </CodeBlock>
                    </div>
                </SectionCard>

                <SectionCard
                    id="api-lookup"
                    eyebrow="Endpoint"
                    title="GET /lookup"
                    description="Resolve a verified mapping between Discord and Roblox identities. This is useful for support tools, moderation backends, or verification-aware dashboards."
                >
                    <CodeBlock label="Request">{'GET https://rolink.cloud/api/v1/lookup?discordId=123456789'}</CodeBlock>
                    <div className="mt-6">
                        <DataTable
                            headers={['Parameter', 'Type', 'Required', 'Description']}
                            rows={[
                                ['discordId', 'string', 'One of these', 'Find the linked Roblox account for a Discord user.'],
                                ['robloxId', 'string', 'One of these', 'Find the linked Discord account for a Roblox user ID.'],
                                ['robloxUsername', 'string', 'One of these', 'Resolve using a Roblox username instead of a numeric ID.'],
                            ]}
                        />
                    </div>
                    <div className="mt-6">
                        <CodeBlock label="Example response">
                            {`{
  "discordId": "953414442060746854",
  "robloxId": "1234567",
  "robloxUsername": "RobloxPlayer"
}`}
                        </CodeBlock>
                    </div>
                </SectionCard>

                <SectionCard
                    id="api-command"
                    eyebrow="Endpoint"
                    title="POST /command"
                    description="Queue moderation or server actions toward your live runtime. A successful API response means Ro-Link accepted the command, not that the game already finished executing it."
                >
                    <CodeBlock label="Request">{'POST https://rolink.cloud/api/v1/command'}</CodeBlock>
                    <div className="mt-6">
                        <DataTable
                            headers={['Field', 'Type', 'Required', 'Description']}
                            rows={[
                                ['command', 'string', 'Yes', 'The action name. Use the documented command spelling.'],
                                ['args', 'object', 'Yes', 'Command-specific arguments passed to the runtime.'],
                                ['moderator', 'string', 'No', 'Optional actor label stored in logs and moderation history.'],
                            ]}
                        />
                    </div>
                    <div className="mt-6">
                        <CodeBlock label="Example payload">
                            {`{
  "command": "KICK",
  "moderator": "AdminBot",
  "args": {
    "username": "Exploiter123",
    "reason": "Flying detected by anti-cheat"
  }
}`}
                        </CodeBlock>
                    </div>
                </SectionCard>
                <SectionCard
                    id="api-reference"
                    eyebrow="Reference"
                    title="Command reference"
                    description="Use the command matrix below as the baseline. Your dashboard can expose additional game-specific misc actions, but external callers should stay within the documented contract unless your integration explicitly supports more."
                >
                    <div className="space-y-4">
                        {commandGroups.map((group) => (
                            <div key={group.title} className="overflow-hidden rounded-2xl border border-white/10 bg-[#08101f]/70">
                                <div className="border-b border-white/8 px-5 py-4">
                                    <h3 className={cn('text-lg font-semibold', group.accent)}>{group.title}</h3>
                                </div>
                                <div className="divide-y divide-white/8">
                                    {group.commands.map((command) => (
                                        <div key={command.name} className="px-5 py-4">
                                            <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                                                <div>
                                                    <div className="inline-flex rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 font-mono text-xs font-bold tracking-[0.22em] text-sky-300">
                                                        {command.name}
                                                    </div>
                                                    <p className="mt-3 text-sm leading-7 text-slate-300">{command.description}</p>
                                                </div>
                                                <code className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-400">
                                                    args: {command.args}
                                                </code>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard
                    id="api-limits"
                    eyebrow="Responses"
                    title="Limits, delivery, and best practices"
                    description="The API can only move as fast as the Roblox runtime and MessagingService pipeline allow. Design your automation around queued delivery rather than assuming instant execution."
                >
                    <div className="space-y-6">
                        <Callout title="MessagingService throughput" tone="warn">
                            Avoid blasting a large number of commands in a short window. For most workflows, queueing and spacing requests is safer than sending bursts and assuming every command will land immediately.
                        </Callout>

                        <DataTable
                            headers={['HTTP status', 'Meaning', 'Recommended response']}
                            rows={[
                                ['200', 'The request was accepted by Ro-Link.', 'Check logs or runtime effects for the actual execution result.'],
                                ['401', 'The API key is missing or invalid.', 'Verify the server key and confirm the header name is exactly x-api-key.'],
                                ['403', 'The key is valid but not allowed to perform the action.', 'Re-check server configuration and key scope.'],
                                ['404', 'The requested record or route was not found.', 'Validate the endpoint, slug, or identifier you passed.'],
                                ['429', 'You are sending requests too aggressively.', 'Back off, queue locally, and retry more slowly.'],
                            ]}
                        />
                    </div>
                </SectionCard>
            </div>
        ),
    },
    {
        id: 'module-developer-api',
        category: 'Developer',
        eyebrow: 'Module Runtime',
        title: 'Module Developer API',
        summary: 'Use this page to understand what a Ro-Link module file looks like, how dashboard settings reach Roblox, and which context helpers are available for commands, reports, Discord messages, user data, and player UI.',
        icon: Icons.Terminal,
        stats: [
            { label: 'Runtime object', value: 'context' },
            { label: 'Upload surface', value: 'Management portal' },
            { label: 'Loaded by', value: 'Roblox admin panel' },
        ],
        toc: [
            { id: 'module-api-overview', title: 'How modules work' },
            { id: 'module-api-config', title: 'Configuration' },
            { id: 'module-api-functions', title: 'Context functions' },
            { id: 'module-api-command-panel', title: 'Cmds panel commands' },
            { id: 'module-api-reports', title: 'Reports data' },
            { id: 'module-api-discord', title: 'Discord messages' },
            { id: 'module-api-user-data', title: 'Linked users' },
            { id: 'module-api-lifecycle', title: 'Lifecycle hooks' },
            { id: 'module-api-ui', title: 'CreateUI' },
            { id: 'module-api-example', title: 'Full example' },
        ],
        content: (
            <div className="space-y-6">
                <SectionCard
                    id="module-api-overview"
                    eyebrow="Structure"
                    title="How a marketplace module runs"
                    description="A module is uploaded once, reviewed by staff, enabled per Discord server, then installed into Roblox by the Studio plugin. The uploaded Luau returns a table of hooks and commands. Ro-Link provides the context object at runtime."
                >
                    <InfoGrid
                        items={[
                            {
                                meta: 'You upload',
                                title: 'Module source',
                                description: 'The Luau file contains an optional CONFIG table and returns Init, Commands, LiveConfig, and other handlers.',
                            },
                            {
                                meta: 'Server owners set',
                                title: 'Dashboard config',
                                description: 'Each Discord server can save different settings for the same published module from Dashboard > Modules.',
                            },
                            {
                                meta: 'Roblox receives',
                                title: 'Runtime context',
                                description: 'When the admin panel loads the module, Ro-Link passes context, settings, APIs, report helpers, Discord helpers, and UI helpers.',
                            },
                        ]}
                    />

                    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                        <div className="space-y-5">
                            <StepList
                                steps={[
                                    {
                                        title: 'Declare CONFIG only for dashboard fields.',
                                        description: 'CONFIG describes the form Ro-Link should show. It is schema, not live game state.',
                                    },
                                    {
                                        title: 'Return a module table.',
                                        description: 'Put startup work in Init and command handlers in Commands or RegisterPanelCommand.',
                                    },
                                    {
                                        title: 'Use context for every Ro-Link action.',
                                        description: 'The context object is the stable bridge to Discord, reports, players, notifications, and module UI.',
                                    },
                                ]}
                            />
                            <Callout title="Keep these separate" tone="info">
                                <InlineCode>context.Config</InlineCode> is the field schema. <InlineCode>context.Settings</InlineCode> is the saved value for the current Discord server. Use <InlineCode>settings</InlineCode> or <InlineCode>context.Settings</InlineCode> when your module needs an actual configured value.
                            </Callout>
                        </div>
                        <CodeBlock label="Minimal module shape">
                            {`CONFIG = {
    Version = "1.0.0",
    Debug_UI = {
        Short_Description = "Show extra module UI.",
        Type = "Bool",
        Default = true,
        Options = {}
    },
    Theme = {
        Short_Description = "Dashboard-selected module theme.",
        Type = "Dropdown",
        Default = "Sky",
        Options = { "Sky", "Emerald", "Amber" }
    },
    Welcome_Message = {
        Short_Description = "Message shown by the module.",
        Type = "String",
        Default = "Welcome to the server.",
        Options = {}
    },
    Announcement = {
        Short_Description = "Message to send immediately to live servers.",
        Type = "String",
        Default = "",
        LIVE = true,
        ButtonText = "Send",
        Options = {}
    },
    Max_Open_Reports = {
        Short_Description = "Maximum open reports to show in module UI.",
        Type = "Integer",
        Default = 10,
        Options = {}
    }
}

return {
    Init = function(context, settings)
        context.Log("Loaded", context.Module.name, context.Settings.Debug_UI)
    end,

    Commands = {
        hello = function(command, context, args)
            context.Log("Hello command ran", command, args)
        end
    }
}`}
                        </CodeBlock>
                    </div>
                </SectionCard>

                <SectionCard
                    id="module-api-config"
                    eyebrow="Configuration"
                    title="Get module config from Ro-Link"
                    description="A module declares configurable fields with CONFIG. Ro-Link turns that schema into a per-server dashboard form, saves the selected values, then passes those saved values back into Roblox."
                >
                    <InfoGrid
                        columns="md:grid-cols-2"
                        items={[
                            {
                                meta: 'Schema',
                                title: 'CONFIG lives at the top of the file',
                                description: 'Ro-Link reads CONFIG before the module runs so it can build the dashboard form and know which fields are live actions.',
                            },
                            {
                                meta: 'Values',
                                title: 'Settings arrive at runtime',
                                description: 'Saved values are passed to Init as settings and are also available at context.Settings while commands and hooks run.',
                            },
                        ]}
                    />

                    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                        <div className="space-y-5">
                            <Checklist
                                items={[
                                    'Declare a top-level CONFIG table in the uploaded module source.',
                                    'Use Bool, Dropdown, CheckBoxes, Color Wheel, Integer, or String field types.',
                                    'Set LIVE = true on a field when the dashboard should show a send button instead of saving the value.',
                                    'Server managers open Dashboard > Modules, choose the module, select Configure, then save the module config for that Discord server.',
                                    'Read saved values in Roblox from context.Settings or from the second settings argument passed to Init.',
                                    'Use context.Config only for schema metadata such as field type, default value, options, and description.',
                                ]}
                            />
                            <Callout title="Settings are per server" tone="info">
                                The same published module can have different saved config values on different Discord servers. Always read the values from the runtime context instead of hard-coding dashboard choices in the module source.
                            </Callout>
                            <DataTable
                                headers={['Field type', 'Dashboard control', 'Runtime value']}
                                rows={[
                                    ['Bool', 'Toggle', 'true or false'],
                                    ['Dropdown', 'Single select menu', 'Selected option string'],
                                    ['CheckBoxes', 'Multi-select list', 'Array-like table of selected values'],
                                    ['Color Wheel', 'Color picker', 'Selected color value'],
                                    ['Integer', 'Number input', 'Number'],
                                    ['String', 'Text input', 'String'],
                                ]}
                            />
                        </div>
                        <CodeBlock label="Read saved module config">
                            {`return {
    Init = function(context, settings)
        local debugEnabled = settings.Debug_UI
        local theme = context.Settings.Theme

        if debugEnabled then
            context.Log("Debug UI enabled with theme", theme)
        end
    end,

    Commands = {
        theme = function(command, context)
            return context.Notify(command.Player, "Theme: " .. tostring(context.Settings.Theme), true)
        end
    }
}`}
                        </CodeBlock>
                    </div>
                </SectionCard>

                <SectionCard
                    id="module-api-functions"
                    eyebrow="Reference"
                    title="Context functions and fields"
                    description="Every module receives a context table. Treat it as the module API: read settings from it, call helpers from it, and avoid reaching into Ro-Link internals directly."
                >
                    <DataTable
                        headers={['Where you are', 'Arguments you get', 'Use it for']}
                        rows={[
                            ['Init', 'context, settings', 'Startup work, event hooks, panel commands, cached setup.'],
                            ['Commands handler', 'command, context, args', 'Run a command from Roblox and respond with Notify, reports, or Discord messages.'],
                            ['RegisterPanelCommand handler', 'command, commandContext, args', 'Handle a command launched from the in-game Cmds panel.'],
                            ['LiveConfig handler', 'command, context, value', 'React to a live dashboard action without saving the value as a setting.'],
                            ['Lifecycle hook', 'player, payload, hookContext', 'Refresh UI or audit when an admin opens the panel or command bar.'],
                        ]}
                    />
                    <DataTable
                        headers={['Name', 'Type', 'Description']}
                        rows={moduleDeveloperFunctions.map((row) => [...row])}
                    />
                </SectionCard>

                <SectionCard
                    id="module-api-command-panel"
                    eyebrow="Commands"
                    title="Register commands in the in-game Cmds panel"
                    description="Use RegisterPanelCommand when a marketplace module command should be discoverable from the admin command bar. RegisterCommand still works for direct command handling; RegisterPanelCommand adds the UI metadata the command bar needs."
                >
                    <CodeBlock label="RegisterPanelCommand">
                        {`return {
    Init = function(context)
        context.RegisterPanelCommand({
            Name = "flag_report",
            Title = "Flag Report",
            Description = "Add a moderator note to a report.",
            Category = "Reports",
            TargetRequired = false,
            Fields = {
                { id = "reportId", label = "Report ID", required = true },
                { id = "note", label = "Note", required = true, multiline = true }
            }
        }, function(command, commandContext, args)
            return commandContext.UpdateReport(args.reportId, {
                moderatorNote = args.note
            })
        end)
    end
}`}
                    </CodeBlock>
                </SectionCard>

                <SectionCard
                    id="module-api-reports"
                    eyebrow="Reports"
                    title="Read and edit reports for the current server"
                    description="Report helpers call the Ro-Link game-admin API with the configured server key, so modules can only access reports that belong to the Discord server attached to the running Roblox server."
                >
                    <div className="grid gap-6 xl:grid-cols-2">
                        <CodeBlock label="Read reports">
                            {`local ok, reports = context.GetReports({
    status = "PENDING",
    limit = 25,
    target = "PlayerName"
})

if ok then
    for _, report in ipairs(reports) do
        context.Log(report.id, report.reported_roblox_username, report.reason)
    end
end`}
                        </CodeBlock>
                        <CodeBlock label="Update a report">
                            {`local ok, report = context.UpdateReport(reportId, {
    status = "RESOLVED",
    moderatorId = tostring(player.UserId),
    moderatorNote = "Resolved by module command."
})

if ok then
    context.Log("Updated report", report.id)
end`}
                        </CodeBlock>
                        <CodeBlock label="Handle live config actions">
                            {`CONFIG = {
    Announcement = {
        Short_Description = "Send an announcement to live servers.",
        Type = "String",
        Default = "",
        LIVE = true,
        ButtonText = "Send"
    }
}

return {
    LiveConfig = {
        Announcement = function(command, context, value)
            for _, player in ipairs(context.GetPlayers()) do
                context.Notify(player, tostring(value), true)
            end
        end
    }
}`}
                        </CodeBlock>
                    </div>
                </SectionCard>

                <SectionCard
                    id="module-api-discord"
                    eyebrow="Discord"
                    title="Send validated bot messages"
                    description="SendBotMessage routes through Ro-Link so the server API key is checked and channel IDs are validated against the Discord server attached to that Roblox server."
                >
                    <div className="grid gap-6 xl:grid-cols-2">
                        <CodeBlock label="SendBotMessage signature">
                            {`local ok, result = context.SendBotMessage(
    "channel", -- "channel", "serverowner", "user", "dm", or "member"
    nil,       -- Discord user ID or { discordId = "..." } for user/dm/member targets
    "123456789012345678", -- channel ID for channel target
    {
        PlainText = "Plain text is optional when Embed exists",
        Embed = {
            Title = "Optional embed title",
            Content = "Optional embed body",
            media = "https://example.com/image.png",
            Footer = "Footer text",
            icon = "https://example.com/icon.png",
            Color = 0x38bdf8
        }
    }
)`}
                        </CodeBlock>
                        <div className="space-y-4">
                            <DataTable
                                headers={['Target', 'Behavior', 'Validation']}
                                rows={[
                                    ['channel', 'Sends to channelId.', 'Channel must belong to the current Discord server and be sendable by the bot.'],
                                    ['serverowner', 'DMs the Discord server owner.', 'Owner is resolved from Discord for the current server.'],
                                    ['user, dm, member', 'DMs the provided Discord user.', 'User must be a member of the current Discord server.'],
                                ]}
                            />
                            <Callout title="Embed is optional" tone="info">
                                Content can include <InlineCode>PlainText</InlineCode>, <InlineCode>Embed</InlineCode>, or both. The runtime also accepts <InlineCode>Footer</InlineCode> or the misspelled <InlineCode>Footor</InlineCode> for compatibility.
                            </Callout>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    id="module-api-user-data"
                    eyebrow="Users"
                    title="Read linked user data"
                    description="GetUserData resolves a Roblox player, username, UserId, or identity table through Ro-Link and returns the linked Discord user/member and server role rank when available."
                >
                    <CodeBlock label="GetUserData">
                        {`local ok, data = context.GetUserData(player)

if ok then
    context.Log("Roblox user", data.user.robloxUsername, data.user.robloxId)

    if data.linked and data.discordUser then
        context.Log("Discord user", data.discordUser.username, data.discordUser.id)
    end

    if data.serverRank then
        context.Log("Highest role", data.serverRank.highestRole and data.serverRank.highestRole.name or "none")
        context.Log("Role position", data.serverRank.highestPosition)
    end
end`}
                    </CodeBlock>
                </SectionCard>

                <SectionCard
                    id="module-api-lifecycle"
                    eyebrow="Hooks"
                    title="React when admins open the panel or command bar"
                    description="Lifecycle hooks let a module run code when the in-game UI is opened, which is useful for refreshing module state, showing contextual UI, or sending audit messages."
                >
                    <CodeBlock label="Lifecycle hooks">
                        {`return {
    Init = function(context)
        context.OnAdminPanelOpened(function(player, payload, hookContext)
            context.Log(player.Name .. " opened the admin panel")
        end)

        context.OnCommandBarOpened(function(player, payload, hookContext)
            context.Notify(player, "Command bar opened", true)
        end)
    end
}`}
                    </CodeBlock>
                </SectionCard>

                <SectionCard
                    id="module-api-ui"
                    eyebrow="UI"
                    title="Create player UI from a module"
                    description="CreateUI can target a Player instance, username, UserId, all/server/everyone, or a list of targets. Use the UI interaction bridge when created controls need to send button or textbox events back to module code."
                >
                    <div className="grid gap-6 xl:grid-cols-2">
                        <CodeBlock label="CreateUI with interaction">
                            {`context.CreateUI(player, function(ui)
        local frame = ui.Create("Frame", {
            Size = UDim2.new(0, 320, 0, 120),
            BackgroundColor3 = Color3.fromRGB(15, 23, 42)
        })

        ui.Create("TextLabel", {
            Size = UDim2.fromScale(1, 1),
            BackgroundTransparency = 1,
            Text = "Hello from a module",
            TextColor3 = Color3.fromRGB(255, 255, 255)
        }, frame)

        local button = ui.Create("TextButton", {
            Position = UDim2.new(0, 20, 1, -48),
            Size = UDim2.new(0, 160, 0, 36),
            Text = "Send ping"
        }, frame)

        _G.RoLinkModuleUI.Bind(button, function(clickingPlayer, payload)
            context.Notify(clickingPlayer, "Clicked " .. payload.Name, true)
        end, {
            Module = context.Module,
            Events = { "Activated" }
        })

        return frame
end)`}
                        </CodeBlock>
                        <CodeBlock label="CreateUI from tree">
                            {`context.CreateUI("all", {
    ClassName = "ScreenGui",
    Properties = { Name = "ModuleNotice", ResetOnSpawn = false },
    Children = {
        {
            ClassName = "TextLabel",
            Properties = {
                Size = UDim2.new(0, 260, 0, 48),
                Text = "Server module loaded"
            }
        }
    }
})`}
                        </CodeBlock>
                    </div>
                </SectionCard>

                <SectionCard
                    id="module-api-example"
                    eyebrow="Example"
                    title="Complete module example"
                    description="This example registers one command, announces lifecycle activity, reads server channels, and sends a Discord message only to channels that belong to the current server."
                >
                    <CodeBlock label="Marketplace module example">
                        {`return {
    Init = function(context, settings)
        context.OnAdminPanelOpened(function(player)
            context.Notify(player, "Marketplace module ready", true)
        end)

        context.OnCommandBarOpened(function(player)
            context.Log("Command bar opened by", player.Name)
        end)
    end,

    Commands = {
        announce = function(command, context, args)
            local ok, channels = context.GetDiscordChannels()
            if not ok or #channels == 0 then
                return false, "No sendable Discord channels are available."
            end

            local channelId = args.channelId or channels[1].id
            return context.SendBotMessage("channel", nil, channelId, {
                PlainText = args.message or "Announcement from Roblox",
                Embed = {
                    Title = "Ro-Link Module",
                    Content = "This was sent by a marketplace add-on.",
                    Footer = "Server validated"
                }
            })
        end
    }
}`}
                    </CodeBlock>
                </SectionCard>
            </div>
        ),
    },
    {
        id: 'troubleshooting',
        category: 'Developer',
        eyebrow: 'Troubleshooting',
        title: 'Troubleshooting',
        summary: 'Use this page when Ro-Link appears connected but actions fail silently, the dashboard is incomplete, or lookups do not return the result you expect.',
        icon: Icons.Activity,
        stats: [
            { label: 'Check first', value: 'Owner scope, runtime, logs' },
            { label: 'Most common issue', value: 'Wrong credential scope' },
            { label: 'Best evidence', value: 'A reproducible live test' },
        ],
        toc: [
            { id: 'troubleshooting-command-delivery', title: 'Command delivery issues' },
            { id: 'troubleshooting-permissions', title: 'Permission problems' },
            { id: 'troubleshooting-lookups', title: 'Lookup mismatches' },
            { id: 'troubleshooting-support', title: 'Support packet' },
        ],
        content: (
            <div className="space-y-6">
                <SectionCard
                    id="troubleshooting-command-delivery"
                    eyebrow="Runtime Issues"
                    title="Commands are accepted but nothing happens"
                    description="A 200 response from Ro-Link means the gateway accepted your request. It does not prove a live server was running the correct plugin-installed bridge or that Roblox accepted delivery."
                >
                    <Checklist
                        items={[
                            'Confirm at least one live server for the target experience is actually online.',
                            'Make sure the live server was started after the most recent installer-plugin change and publish.',
                            'Re-check the Place ID and Universe ID stored in server configuration.',
                            'Inspect logs to verify the command was issued against the expected server or target.',
                            'If all config looks correct, rotate back to the Open Cloud key owner scope and verify permissions again.',
                        ]}
                    />
                </SectionCard>

                <SectionCard
                    id="troubleshooting-permissions"
                    eyebrow="Authorization"
                    title="Permission and access problems"
                    description="Permission issues show up in two places: Roblox credentials and dashboard-level access. Solve them independently so you do not chase the wrong layer."
                >
                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-[#08101f]/70 p-5">
                            <h3 className="text-lg font-semibold text-white">Roblox-side symptoms</h3>
                            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                                <li>PermissionDenied when calling Roblox services.</li>
                                <li>Command requests accepted by Ro-Link but never reaching the runtime.</li>
                                <li>New credentials working in one experience but not the group-owned target experience.</li>
                            </ul>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-[#08101f]/70 p-5">
                            <h3 className="text-lg font-semibold text-white">Dashboard-side symptoms</h3>
                            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                                <li>Selected tabs are missing for a staff member.</li>
                                <li>The wrong Discord account is signed into the dashboard.</li>
                                <li>A user can open the server record but cannot publish updates or run protected actions.</li>
                            </ul>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    id="troubleshooting-lookups"
                    eyebrow="Identity Resolution"
                    title="Lookups return nothing or the wrong account"
                    description="Identity lookup failures usually come from wrong identifiers or missing verification state, not from the command pipeline."
                >
                    <Checklist
                        items={[
                            'Double-check whether you used a Discord ID, Roblox user ID, or Roblox username and that it matches the expected parameter.',
                            'If you are testing verified account mapping, confirm the user has actually completed the relevant verification flow.',
                            'Use exact usernames when calling /user or /lookup by Roblox username.',
                            'Keep in mind that old cached assumptions are not a substitute for checking the current linked account record.',
                        ]}
                    />
                </SectionCard>

                <SectionCard
                    id="troubleshooting-support"
                    eyebrow="Escalation"
                    title="Build a support packet before escalating"
                    description="A short, complete support packet saves more time than a vague bug report. Gather the minimum evidence below whenever you need a second set of eyes."
                >
                    <Checklist
                        items={[
                            'The exact Discord server and Roblox experience affected.',
                            'The command or lookup you attempted, including target username or IDs.',
                            'Whether a live server was online at the time of the test.',
                            'Any relevant dashboard log entry, error code, or API response body.',
                            'Whether the key is personal-owner or group-owner scoped.',
                            'The last version you published or expected users to be on.',
                        ]}
                    />
                </SectionCard>
            </div>
        ),
    },
];

const categoryOrder: DocCategory[] = ['Platform', 'Operations', 'Configuration', 'Developer'];

export default function DocsClientPage() {
    const [activePageId, setActivePageId] = useState(docsPages[0].id);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(docsPages[0].toc[0]?.id ?? null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
    const [copiedPageLink, setCopiedPageLink] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const mainContentRef = useRef<HTMLElement>(null);

    const activePage = docsPages.find((page) => page.id === activePageId) || docsPages[0];
    const ActivePageIcon = activePage.icon;
    const activePageIndex = docsPages.findIndex((page) => page.id === activePage.id);
    const previousPage = activePageIndex > 0 ? docsPages[activePageIndex - 1] : null;
    const nextPage = activePageIndex >= 0 && activePageIndex < docsPages.length - 1 ? docsPages[activePageIndex + 1] : null;
    const pagerPages = [previousPage, nextPage].filter((page): page is DocPage => Boolean(page));
    const searchEntries = useMemo(() => buildSearchEntries(docsPages), []);
    const searchResults = useMemo(() => {
        const query = normalizeSearchText(searchQuery);
        if (!query) return searchEntries.slice(0, 8).map((entry) => ({ ...entry, score: 0 }));

        const queryParts = query.split(' ').filter(Boolean);
        return searchEntries
            .map((entry) => ({ ...entry, score: scoreSearchEntry(entry, query, queryParts) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
            .slice(0, 8);
    }, [searchEntries, searchQuery]);

    useEffect(() => {
        function syncFromHash() {
            const rawHash = window.location.hash.replace(/^#/, '').trim();
            if (!rawHash) return;

            const [pageId, sectionId] = rawHash.split('/');
            const matchingPage = docsPages.find((page) => page.id === pageId);
            if (!matchingPage) return;

            setActivePageId(matchingPage.id);
            setActiveSectionId(sectionId || matchingPage.toc[0]?.id || null);
            setPendingSectionId(sectionId || null);
        }

        syncFromHash();
        window.addEventListener('hashchange', syncFromHash);
        return () => window.removeEventListener('hashchange', syncFromHash);
    }, []);

    useEffect(() => {
        function handleSearchShortcut(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSearchOpen(true);
            }

            if (event.key === 'Escape') {
                setSearchOpen(false);
            }
        }

        window.addEventListener('keydown', handleSearchShortcut);
        return () => window.removeEventListener('keydown', handleSearchShortcut);
    }, []);

    useEffect(() => {
        if (!searchOpen) return;

        const timeout = window.setTimeout(() => searchInputRef.current?.focus(), 0);
        return () => window.clearTimeout(timeout);
    }, [searchOpen]);

    useEffect(() => {
        if (!pendingSectionId) return;

        const timeout = window.setTimeout(() => {
            document.getElementById(pendingSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setPendingSectionId(null);
        }, 60);

        return () => window.clearTimeout(timeout);
    }, [activePageId, pendingSectionId]);

    function scrollMainContentToTop() {
        mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function openPage(pageId: string) {
        const targetPage = docsPages.find((page) => page.id === pageId);
        if (!targetPage) return;

        setActivePageId(pageId);
        setActiveSectionId(targetPage.toc[0]?.id || null);
        setMobileMenuOpen(false);
        setPendingSectionId(null);
        window.history.replaceState(null, '', `#${pageId}`);
        scrollMainContentToTop();
    }

    function openSection(sectionId: string) {
        setActiveSectionId(sectionId);
        setPendingSectionId(sectionId);
        window.history.replaceState(null, '', `#${activePageId}/${sectionId}`);
    }

    function openSearchResult(result: DocSearchResult) {
        const targetPage = docsPages.find((page) => page.id === result.pageId);
        if (!targetPage) return;

        const targetSectionId = result.sectionId || targetPage.toc[0]?.id || null;

        setActivePageId(targetPage.id);
        setActiveSectionId(targetSectionId);
        setMobileMenuOpen(false);
        setSearchOpen(false);
        setSearchQuery('');

        if (result.sectionId) {
            setPendingSectionId(result.sectionId);
            window.history.replaceState(null, '', `#${targetPage.id}/${result.sectionId}`);
        } else {
            setPendingSectionId(null);
            window.history.replaceState(null, '', `#${targetPage.id}`);
            scrollMainContentToTop();
        }
    }

    function copyCurrentPageLink() {
        const currentUrl = new URL(window.location.href);
        currentUrl.hash = activeSectionId ? `${activePageId}/${activeSectionId}` : activePageId;
        navigator.clipboard.writeText(currentUrl.toString());
        setCopiedPageLink(true);
        window.setTimeout(() => setCopiedPageLink(false), 1500);
    }

    return (
        <div className="min-h-screen bg-[#181818] text-slate-100 selection:bg-sky-400/20">
            <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-[#181818]/92 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-2 text-sky-300">
                            <Icons.Book className="h-4 w-4" />
                        </div>
                        <span className="text-lg font-semibold text-white">Ro-Link</span>
                    </Link>

                    <div className="hidden items-center gap-4 lg:flex">
                        <button
                            type="button"
                            onClick={() => setSearchOpen(true)}
                            className="flex min-w-[230px] items-center gap-3 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-left text-sm text-slate-400"
                        >
                            <Icons.Search className="h-4 w-4" />
                            <span className="flex-1">Search...</span>
                            <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Ctrl K</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen((current) => !current)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-300 lg:hidden"
                    >
                        {mobileMenuOpen ? <Icons.X className="h-5 w-5" /> : <Icons.Menu className="h-5 w-5" />}
                    </button>
                </div>
            </header>

            {searchOpen && (
                <div className="fixed inset-0 z-50 bg-black/65 px-4 py-20 backdrop-blur-sm" onMouseDown={() => setSearchOpen(false)}>
                    <div
                        className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#181818] shadow-2xl shadow-black/40"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
                            <Icons.Search className="h-5 w-5 shrink-0 text-slate-500" />
                            <input
                                ref={searchInputRef}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && searchResults[0]) {
                                        event.preventDefault();
                                        openSearchResult(searchResults[0]);
                                    }
                                }}
                                placeholder="Search docs..."
                                className="h-11 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                            />
                            <button
                                type="button"
                                onClick={() => setSearchOpen(false)}
                                className="rounded-lg border border-white/10 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-white"
                            >
                                Esc
                            </button>
                        </div>

                        <div className="max-h-[min(520px,65vh)] overflow-y-auto p-2">
                            {searchResults.length > 0 ? (
                                <div className="space-y-1">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.key}
                                            type="button"
                                            onClick={() => openSearchResult(result)}
                                            className="group flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                                        >
                                            <div className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-sky-300">
                                                <Icons.Book className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-white group-hover:text-sky-200">{result.title}</p>
                                                <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                                    {result.sectionId ? `${result.subtitle} / Section` : result.subtitle}
                                                </p>
                                            </div>
                                            <Icons.ChevronRight className="mt-2 h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-200" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="px-4 py-10 text-center">
                                    <p className="text-sm font-semibold text-white">No results found</p>
                                    <p className="mt-2 text-sm text-slate-500">Try a page name, setup step, API route, or command.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-16">
                <aside
                    className={cn(
                        'fixed bottom-0 left-0 top-16 z-30 flex w-[280px] flex-col overflow-hidden border-r border-white/8 bg-[#181818]/98 px-5 py-8 backdrop-blur-xl transition-transform duration-300',
                        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
                        'lg:translate-x-0',
                    )}
                >
                    <div className="space-y-8">
                        {categoryOrder.map((category) => {
                            const pages = docsPages.filter((page) => page.category === category);
                            if (pages.length === 0) return null;

                            return (
                                <div key={category}>
                                    <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{category}</p>
                                    <div className="space-y-1">
                                        {pages.map((page) => (
                                            <NavButton key={page.id} active={activePageId === page.id} icon={page.icon} onClick={() => openPage(page.id)}>
                                                {page.title}
                                            </NavButton>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </aside>

                {mobileMenuOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-20 bg-black/50 lg:hidden" />}

                <aside className="fixed bottom-0 right-0 top-16 hidden w-[270px] overflow-hidden border-l border-white/8 bg-[#181818] px-7 py-10 2xl:block">
                    <nav className="space-y-1">
                        {activePage.toc.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => openSection(item.id)}
                                className={cn(
                                    'block w-full rounded-xl px-4 py-3 text-left text-sm leading-6 transition-colors',
                                    activeSectionId === item.id ? 'bg-sky-500/12 text-sky-200' : 'text-sky-100/90 hover:text-white',
                                )}
                            >
                                {item.title}
                            </button>
                        ))}
                    </nav>
                </aside>

                <main ref={mainContentRef} className="custom-scrollbar h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain lg:pl-[280px] 2xl:pr-[270px]">
                    <div className="mx-auto max-w-[1080px] px-6 py-10 sm:px-10">
                        <div className="flex flex-col gap-6 border-b border-white/8 pb-10 sm:flex-row sm:items-start sm:justify-between">
                            <div className="max-w-3xl">
                                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-400">{activePage.category}</p>
                                <div className="mt-4 flex items-center gap-4">
                                    <ActivePageIcon className="h-10 w-10 text-slate-500" />
                                    <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">{activePage.title}</h1>
                                </div>
                                <p className="mt-6 text-lg leading-9 text-slate-200">{activePage.summary}</p>
                                <div className="mt-6 flex flex-wrap gap-2">
                                    {activePage.stats.map((stat) => (
                                        <PageStat key={stat.label} {...stat} />
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={copyCurrentPageLink}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                            >
                                {copiedPageLink ? <Icons.Check className="h-4 w-4 text-emerald-400" /> : <Icons.Copy className="h-4 w-4" />}
                                {copiedPageLink ? 'Copied' : 'Copy'}
                            </button>
                        </div>

                        <article className="space-y-12 pt-10">{activePage.content}</article>

                        <div className="mt-14 border-t border-white/8 pt-10">
                            <div className={cn('grid gap-4', pagerPages.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
                                {previousPage && (
                                    <button
                                        type="button"
                                        onClick={() => openPage(previousPage.id)}
                                        className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5 text-left transition-colors hover:bg-white/[0.04]"
                                    >
                                        <div>
                                            <p className="text-sm text-slate-500">Previous</p>
                                            <p className="mt-1 text-2xl font-semibold text-white">{previousPage.title}</p>
                                        </div>
                                        <Icons.ChevronRight className="h-5 w-5 rotate-180 text-slate-600 transition-transform group-hover:-translate-x-0.5 group-hover:text-white" />
                                    </button>
                                )}

                                {nextPage && (
                                    <button
                                        type="button"
                                        onClick={() => openPage(nextPage.id)}
                                        className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5 text-left transition-colors hover:bg-white/[0.04]"
                                    >
                                        <div>
                                            <p className="text-sm text-slate-500">Next</p>
                                            <p className="mt-1 text-2xl font-semibold text-white">{nextPage.title}</p>
                                        </div>
                                        <Icons.ChevronRight className="h-5 w-5 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                                    </button>
                                )}
                            </div>

                            <p className="mt-8 text-sm text-slate-500">Last updated April 16, 2026</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
