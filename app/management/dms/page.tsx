'use client';

import { useEffect, useMemo, useState } from 'react';

const TARGET_OPTIONS = [
    {
        value: 'verified-linked-users',
        label: 'Verified linked users',
        description: 'Discord users with a saved Roblox account link.',
    },
    {
        value: 'server-owners-all',
        label: 'Server owners (all)',
        description: 'Owners of current Discord servers where the bot is present.',
    },
    {
        value: 'server-owners-setup',
        label: 'Server owners with setup',
        description: 'Owners of current bot servers that also have Ro-Link setup saved.',
    },
    {
        value: 'server-owners-without-setup',
        label: 'Server owners without setup',
        description: 'Owners of current bot servers that have not completed setup.',
    },
] as const;

type TargetValue = typeof TARGET_OPTIONS[number]['value'];

type EmbedField = {
    name: string;
    value: string;
    inline: boolean;
};

type SendResult = {
    attempted: number;
    sent: number;
    failed: number;
    failures?: Array<{ userId: string; error: string }>;
    counts?: Record<TargetValue, number>;
};

const DEFAULT_COLOR = '#38bdf8';
const RO_LINK_ICON = '/Media/Ro-LinkIcon.png';

function emptyField(): EmbedField {
    return {
        name: '',
        value: '',
        inline: false,
    };
}

function parseHexColor(value: string) {
    return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_COLOR;
}

export default function ManagementDmsPage() {
    const [target, setTarget] = useState<TargetValue>('verified-linked-users');
    const [counts, setCounts] = useState<Record<TargetValue, number>>({
        'verified-linked-users': 0,
        'server-owners-all': 0,
        'server-owners-setup': 0,
        'server-owners-without-setup': 0,
    });
    const [plainText, setPlainText] = useState('');
    const [embedTitle, setEmbedTitle] = useState('');
    const [color, setColor] = useState(DEFAULT_COLOR);
    const [removeSetColor, setRemoveSetColor] = useState(false);
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState<EmbedField[]>([emptyField()]);
    const [footerText, setFooterText] = useState('');
    const [footerIconUrl, setFooterIconUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [loadingCounts, setLoadingCounts] = useState(true);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<SendResult | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadCounts() {
            setLoadingCounts(true);
            setError('');

            try {
                const response = await fetch('/api/management/dms', { cache: 'no-store' });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load DM targets.');
                }

                if (!cancelled && data.counts) {
                    setCounts(data.counts);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load DM targets.');
                }
            } finally {
                if (!cancelled) {
                    setLoadingCounts(false);
                }
            }
        }

        loadCounts();
        setMounted(true);

        return () => {
            cancelled = true;
        };
    }, []);

    const selectedCount = counts[target] || 0;
    const cleanFields = useMemo(
        () => fields.filter((field) => field.name.trim() && field.value.trim()),
        [fields],
    );
    const hasEmbedContent = Boolean(
        embedTitle.trim()
        || description.trim()
        || cleanFields.length
        || footerText.trim()
        || imageUrl.trim()
        || thumbnailUrl.trim(),
    );
    const activeFooterText = useMemo(() => {
        if (footerText.trim()) {
            return footerText;
        }

        const sendingTypes: Record<string, string> = {
            'verified-linked-users': 'Verified Linked Users',
            'server-owners-all': 'Server Owners (All)',
            'server-owners-setup': 'Server Owners with Setup',
            'server-owners-without-setup': 'Server Owners without Setup',
        };
        const sendingType = sendingTypes[target] || 'Verified Linked Users';
        
        const date = mounted ? new Date() : new Date('2026-05-20T14:45:25+12:00');
        const timestamp = date.toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
        return `Sent by Ro-Link Staff to all ${sendingType}. | ${timestamp}`;
    }, [footerText, target, mounted]);
    const canSend = Boolean(plainText.trim() || hasEmbedContent) && selectedCount > 0 && !sending;

    function updateField(index: number, patch: Partial<EmbedField>) {
        setFields((current) => current.map((field, fieldIndex) => (
            fieldIndex === index ? { ...field, ...patch } : field
        )));
    }

    function removeField(index: number) {
        setFields((current) => current.length <= 1 ? [emptyField()] : current.filter((_, fieldIndex) => fieldIndex !== index));
    }

    async function sendMessage() {
        if (!canSend) return;

        const confirmed = window.confirm(`Send this DM to ${selectedCount} recipient${selectedCount === 1 ? '' : 's'}?`);
        if (!confirmed) return;

        setSending(true);
        setNotice('');
        setError('');
        setResult(null);

        try {
            const response = await fetch('/api/management/dms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target,
                    plainText,
                    embedTitle,
                    color,
                    removeSetColor,
                    description,
                    fields: cleanFields,
                    footerText,
                    footerIconUrl,
                    imageUrl,
                    thumbnailUrl,
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send DMs.');
            }

            setResult(data);
            if (data.counts) {
                setCounts(data.counts);
            }
            setNotice(`Sent ${data.sent} of ${data.attempted} DMs.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send DMs.');
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">DM Builder</h1>
                    <p className="mt-1 text-slate-400">Send Ro-Link direct messages to verified users or server-owner groups.</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm">
                    <span className="text-slate-500">Selected recipients</span>
                    <span className="ml-3 font-mono text-lg font-bold text-sky-300">{loadingCounts ? '...' : selectedCount}</span>
                </div>
            </header>

            {(notice || error) && (
                <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                    {error || notice}
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Target</h2>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {TARGET_OPTIONS.map((option) => {
                                const isSelected = option.value === target;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setTarget(option.value)}
                                        className={`rounded-xl border p-4 text-left transition-all ${isSelected ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-bold text-white">{option.label}</p>
                                                <p className="mt-1 text-xs leading-relaxed text-slate-400">{option.description}</p>
                                            </div>
                                            <span className={`rounded-lg px-2 py-1 font-mono text-xs font-bold ${isSelected ? 'bg-sky-400/15 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>
                                                {loadingCounts ? '...' : counts[option.value] || 0}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Plaintext</h2>
                        <textarea
                            value={plainText}
                            onChange={(event) => setPlainText(event.target.value)}
                            maxLength={2000}
                            placeholder="Message content..."
                            className="mt-4 h-32 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-sky-500"
                        />
                        <p className="mt-2 text-right font-mono text-[11px] text-slate-500">{plainText.length}/2000</p>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Embed</h2>
                                <p className="mt-1 text-sm text-slate-400">Author name and image are always set to Ro-Link.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={removeSetColor}
                                        onChange={(event) => setRemoveSetColor(event.target.checked)}
                                        className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                                    />
                                    Remove setColor()
                                </label>
                                <input
                                    type="color"
                                    value={parseHexColor(color)}
                                    onChange={(event) => setColor(event.target.value)}
                                    className="h-10 w-12 rounded-lg border border-slate-700 bg-slate-950 p-1"
                                    aria-label="Embed color"
                                    disabled={removeSetColor}
                                />
                                <input
                                    value={color}
                                    onChange={(event) => setColor(event.target.value)}
                                    placeholder="#38bdf8"
                                    className="w-28 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-sky-500"
                                    disabled={removeSetColor}
                                />
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4">
                            <input
                                value={embedTitle}
                                onChange={(event) => setEmbedTitle(event.target.value)}
                                maxLength={256}
                                placeholder="Embed title"
                                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                            />
                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                maxLength={4096}
                                placeholder="Embed description"
                                className="h-32 resize-none rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                            />
                            <div className="grid gap-4 md:grid-cols-2">
                                <input
                                    value={imageUrl}
                                    onChange={(event) => setImageUrl(event.target.value)}
                                    placeholder="Main image URL"
                                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                                />
                                <input
                                    value={thumbnailUrl}
                                    onChange={(event) => setThumbnailUrl(event.target.value)}
                                    placeholder="Thumbnail image URL"
                                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <input
                                    value={footerText}
                                    onChange={(event) => setFooterText(event.target.value)}
                                    maxLength={2048}
                                    placeholder="Footer text"
                                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                                />
                                <input
                                    value={footerIconUrl}
                                    onChange={(event) => setFooterIconUrl(event.target.value)}
                                    placeholder="Footer icon URL"
                                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Fields</h2>
                            <button
                                type="button"
                                onClick={() => setFields((current) => current.length >= 25 ? current : [...current, emptyField()])}
                                disabled={fields.length >= 25}
                                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Add Field
                            </button>
                        </div>
                        <div className="mt-4 space-y-3">
                            {fields.map((field, index) => (
                                <div key={index} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
                                    <input
                                        value={field.name}
                                        onChange={(event) => updateField(index, { name: event.target.value })}
                                        maxLength={256}
                                        placeholder="Field name"
                                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                                    />
                                    <input
                                        value={field.value}
                                        onChange={(event) => updateField(index, { value: event.target.value })}
                                        maxLength={1024}
                                        placeholder="Field value"
                                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
                                    />
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                            <input
                                                type="checkbox"
                                                checked={field.inline}
                                                onChange={(event) => updateField(index, { inline: event.target.checked })}
                                                className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                                            />
                                            Inline
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => removeField(index)}
                                            className="rounded-lg p-2 text-red-400 transition-all hover:bg-red-400/10"
                                            title="Remove field"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6 6 18" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Preview</h2>
                        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                            {plainText.trim() && (
                                <p className="whitespace-pre-wrap break-words text-sm text-slate-200">{plainText}</p>
                            )}
                            {(plainText.trim() || hasEmbedContent) && (
                                <div
                                    className={`mt-3 bg-slate-900/80 p-4 ${removeSetColor ? 'rounded-xl' : 'rounded-r-xl border-l-4'}`}
                                    style={removeSetColor ? undefined : { borderColor: parseHexColor(color) }}
                                >
                                    <div className="mb-3 flex items-center gap-2">
                                        <img src={RO_LINK_ICON} alt="" className="h-5 w-5 rounded" />
                                        <span className="text-xs font-bold text-white">Ro-Link</span>
                                    </div>
                                    {embedTitle.trim() && <h3 className="break-words text-sm font-bold text-white">{embedTitle}</h3>}
                                    {description.trim() && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{description}</p>}
                                    {thumbnailUrl.trim() && <p className="mt-3 truncate text-xs text-sky-300">Thumbnail: {thumbnailUrl}</p>}
                                    {imageUrl.trim() && <p className="mt-2 truncate text-xs text-sky-300">Image: {imageUrl}</p>}
                                    {cleanFields.length > 0 && (
                                        <div className="mt-3 grid gap-2">
                                            {cleanFields.map((field, index) => (
                                                <div key={`${field.name}-${index}`}>
                                                    <p className="break-words text-xs font-bold text-white">{field.name}</p>
                                                    <p className="break-words text-xs text-slate-400">{field.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
                                        <img src={footerIconUrl.trim() || RO_LINK_ICON} alt="" className="h-4 w-4 rounded" />
                                        <span className="break-words">{activeFooterText}</span>
                                    </div>
                                </div>
                            )}
                            {!plainText.trim() && !hasEmbedContent && (
                                <p className="text-sm text-slate-500">Build a plaintext message, embed, or both.</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={sendMessage}
                        disabled={!canSend}
                        className="w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {sending ? 'Sending...' : `Send to ${selectedCount} recipient${selectedCount === 1 ? '' : 's'}`}
                    </button>

                    {result && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm">
                            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Result</h2>
                            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                                <div className="rounded-xl bg-slate-950 p-3">
                                    <p className="font-mono text-lg font-bold text-slate-200">{result.attempted}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Attempted</p>
                                </div>
                                <div className="rounded-xl bg-slate-950 p-3">
                                    <p className="font-mono text-lg font-bold text-emerald-300">{result.sent}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Sent</p>
                                </div>
                                <div className="rounded-xl bg-slate-950 p-3">
                                    <p className="font-mono text-lg font-bold text-red-300">{result.failed}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Failed</p>
                                </div>
                            </div>
                            {result.failures && result.failures.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {result.failures.map((failure) => (
                                        <p key={failure.userId} className="break-words rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                                            {failure.userId}: {failure.error}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
