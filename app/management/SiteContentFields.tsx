'use client';

export function EditorField({ label, value, onChange, multiline = false, maxLength, placeholder, required = true }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; placeholder?: string; required?: boolean }) {
    const classes = 'rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500';
    return (
        <label className="grid gap-2 text-sm font-semibold text-slate-300">
            {label}
            {multiline ? (
                <textarea required={required} rows={4} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${classes} resize-y`} />
            ) : (
                <input required={required} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={classes} />
            )}
        </label>
    );
}

export function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-300">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-500" />
            <span>{label}{description && <span className="mt-0.5 block text-xs font-normal text-slate-500">{description}</span>}</span>
        </label>
    );
}

export function StatusMessage({ message }: { message: { type: 'error' | 'success'; text: string } | null }) {
    if (!message) return null;
    return <div role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'border-red-500/25 bg-red-500/10 text-red-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}>{message.text}</div>;
}

export function LoadingState() {
    return <div className="flex min-h-56 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /></div>;
}
