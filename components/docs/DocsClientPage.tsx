'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode, type SVGProps } from 'react';

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
        <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#111827]">
            <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.02] px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</span>
                <button
                    type="button"
                    onClick={copyToClipboard}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-white"
                >
                    {copied ? <Icons.Check className="h-3.5 w-3.5 text-emerald-400" /> : <Icons.Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre id={codeId} className="overflow-x-auto p-4 text-sm leading-7 text-slate-300">
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

    const activePage = docsPages.find((page) => page.id === activePageId) || docsPages[0];
    const ActivePageIcon = activePage.icon;
    const activePageIndex = docsPages.findIndex((page) => page.id === activePage.id);
    const previousPage = activePageIndex > 0 ? docsPages[activePageIndex - 1] : null;
    const nextPage = activePageIndex >= 0 && activePageIndex < docsPages.length - 1 ? docsPages[activePageIndex + 1] : null;
    const pagerPages = [previousPage, nextPage].filter((page): page is DocPage => Boolean(page));

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
        if (!pendingSectionId) return;

        const timeout = window.setTimeout(() => {
            document.getElementById(pendingSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setPendingSectionId(null);
        }, 60);

        return () => window.clearTimeout(timeout);
    }, [activePageId, pendingSectionId]);

    function openPage(pageId: string) {
        const targetPage = docsPages.find((page) => page.id === pageId);
        if (!targetPage) return;

        setActivePageId(pageId);
        setActiveSectionId(targetPage.toc[0]?.id || null);
        setMobileMenuOpen(false);
        setPendingSectionId(null);
        window.history.replaceState(null, '', `#${pageId}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function openSection(sectionId: string) {
        setActiveSectionId(sectionId);
        setPendingSectionId(sectionId);
        window.history.replaceState(null, '', `#${activePageId}/${sectionId}`);
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

            <div className="pt-16">
                <aside
                    className={cn(
                        'custom-scrollbar fixed inset-y-16 left-0 z-30 flex w-[280px] flex-col overflow-y-auto border-r border-white/8 bg-[#181818]/98 px-5 py-8 backdrop-blur-xl transition-transform duration-300',
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

                <aside className="custom-scrollbar fixed inset-y-16 right-0 hidden w-[270px] overflow-y-auto border-l border-white/8 bg-[#181818] px-7 py-10 xl:block">
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

                <main className="lg:pl-[280px] xl:pr-[270px]">
                    <div className="mx-auto max-w-[880px] px-6 py-10 sm:px-10">
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
