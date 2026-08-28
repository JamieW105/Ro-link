'use client';

import { AlertTriangle, Check, ChevronRight, Code2, FileCode2, FileJson, Folder, Image as ImageIcon, PlugZap, Save, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import ModuleIdeEditor from '@/components/dashboard/ModuleIdeEditor';
import { runModuleReviewChecks } from '@/lib/moduleReviewChecks';

type ModuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
type ProjectFile = { id: string; path: string; name: string; kind: 'folder' | 'server_script' | 'client_script' | 'shared_module' | 'ui' | 'manifest'; sourceCode: string | null; revision: number };
type ReviewProject = {
    module: { id: string; slug: string; name: string; description: string; thumbnailUrl: string; thumbnailUrls: string[]; version: string; status: ModuleStatus };
    project: { revision: number; manifest: { entrypoints: { server?: string; client?: string } }; requiredRuntimeVersion: string };
    files: ProjectFile[];
    moderationEdits: Array<{ id: string; edit_type: string; target: string; reason: string; moderator_discord_id: string; created_at: string }>;
    disputes: Array<{ id: string; reason: string; status: string; moderator_response: string; created_at: string }>;
    auditAvailable: boolean;
};

function fileIcon(file: ProjectFile) {
    if (file.kind === 'folder') return <Folder className="h-3.5 w-3.5 text-sky-300" />;
    if (file.kind === 'manifest') return <FileJson className="h-3.5 w-3.5 text-amber-300" />;
    return <FileCode2 className="h-3.5 w-3.5 text-slate-400" />;
}

function statusTone(status: ModuleStatus) {
    if (status === 'PUBLISHED') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
    if (status === 'PENDING_REVIEW') return 'border-amber-400/25 bg-amber-400/10 text-amber-300';
    if (status === 'REJECTED') return 'border-red-400/25 bg-red-400/10 text-red-300';
    return 'border-white/10 bg-white/[0.03] text-slate-400';
}

async function readPayload(response: Response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload.error || 'Request failed.'));
    return payload;
}

export default function ManagementModuleReviewPage() {
    const params = useParams();
    const router = useRouter();
    const moduleId = Array.isArray(params.id) ? params.id[0] : String(params.id || '');
    const [data, setData] = useState<ReviewProject | null>(null);
    const [activeFileId, setActiveFileId] = useState('');
    const [draft, setDraft] = useState('');
    const [codeReason, setCodeReason] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([]);
    const [metadataReason, setMetadataReason] = useState('');
    const [decisionReason, setDecisionReason] = useState('');
    const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
    const [studioSession, setStudioSession] = useState<{ place_name?: string; place_id?: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [rightTab, setRightTab] = useState<'moderate' | 'history' | 'disputes'>('moderate');

    const load = useCallback(async () => {
        if (!moduleId) return;
        setLoading(true); setError('');
        try {
            const payload = await readPayload(await fetch(`/api/management/modules/${moduleId}/review`, { cache: 'no-store' })) as ReviewProject;
            setData(payload); setTitle(payload.module.name); setDescription(payload.module.description); setThumbnailUrls(payload.module.thumbnailUrls || []);
            const firstFile = payload.files.find((file) => file.kind !== 'folder') || null;
            setActiveFileId((current) => payload.files.some((file) => file.id === current) ? current : firstFile?.id || '');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to load review project.'); }
        finally { setLoading(false); }
    }, [moduleId]);

    useEffect(() => { void load(); }, [load]);
    const activeFile = useMemo(() => data?.files.find((file) => file.id === activeFileId) || null, [activeFileId, data]);
    useEffect(() => { setDraft(activeFile?.sourceCode || ''); setCodeReason(''); }, [activeFile?.id, activeFile?.revision, activeFile?.sourceCode]);

    useEffect(() => {
        if (!moduleId || !pairing || studioSession || new Date(pairing.expiresAt).getTime() <= Date.now()) return;
        let cancelled = false;
        const check = async () => {
            try {
                const payload = await readPayload(await fetch(`/api/management/modules/${moduleId}/review/studio`, { cache: 'no-store' }));
                if (!cancelled && payload.session) setStudioSession(payload.session);
            } catch { /* a later poll can recover */ }
        };
        void check();
        const timer = window.setInterval(check, 5000);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [moduleId, pairing, studioSession]);

    const reviewChecks = useMemo(() => {
        if (!data) return [];
        const serverPath = data.project.manifest.entrypoints.server;
        const serverFile = data.files.find((file) => file.path === serverPath);
        return runModuleReviewChecks({ name: title, slug: data.module.slug, description, version: data.module.version, category: 'module', isOfficial: false, sourceCode: activeFile?.path === serverPath ? draft : serverFile?.sourceCode || '', moderationNote: decisionReason, configSchema: {} });
    }, [activeFile?.path, data, decisionReason, description, draft, title]);

    const dirtyCode = Boolean(activeFile && draft !== (activeFile.sourceCode || ''));
    const titleDirty = Boolean(data && title !== data.module.name);
    const descriptionDirty = Boolean(data && description !== data.module.description);
    const thumbnailsDirty = Boolean(data && JSON.stringify(thumbnailUrls) !== JSON.stringify(data.module.thumbnailUrls));

    async function saveCode() {
        if (!activeFile || !dirtyCode) return;
        setSaving(true); setError(''); setNotice('');
        try {
            await readPayload(await fetch(`/api/management/modules/${moduleId}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'file', fileId: activeFile.id, sourceCode: draft, expectedRevision: activeFile.revision, reason: codeReason }) }));
            setNotice(`Saved ${activeFile.path}. The reason was added to the moderation audit.`); await load();
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to save code.'); }
        finally { setSaving(false); }
    }

    async function saveMetadata(field: 'title' | 'description' | 'thumbnails') {
        setSaving(true); setError(''); setNotice('');
        try {
            const value = field === 'title' ? title : field === 'description' ? description : thumbnailUrls;
            await readPayload(await fetch(`/api/management/modules/${moduleId}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'metadata', field, value, reason: metadataReason }) }));
            setNotice(`${field === 'title' ? 'Title' : field === 'description' ? 'Description' : 'Thumbnails'} updated with an audit reason.`); await load();
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to save metadata.'); }
        finally { setSaving(false); }
    }

    async function decide(status: 'PUBLISHED' | 'REJECTED') {
        if (status === 'REJECTED' && decisionReason.trim().length < 20) { setError('Give the uploader a specific denial reason of at least 20 characters.'); return; }
        setSaving(true); setError(''); setNotice('');
        try {
            await readPayload(await fetch(`/api/management/modules/${moduleId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, moderationNote: decisionReason.trim() }) }));
            const list = await readPayload(await fetch('/api/management/modules', { cache: 'no-store' })) as Array<{ id: string; status: ModuleStatus }>;
            const next = list.find((item) => item.id !== moduleId && item.status === 'PENDING_REVIEW');
            if (next) router.push(`/management/modules/${next.id}`);
            else { setNotice(status === 'PUBLISHED' ? 'Module approved and published.' : 'Module denied. Its owner can still test, dispute, edit, and resubmit it.'); await load(); }
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to record decision.'); }
        finally { setSaving(false); }
    }

    async function connectStudio() {
        setError(''); setNotice('');
        try { const payload = await readPayload(await fetch(`/api/management/modules/${moduleId}/review/studio`, { method: 'POST' })); setPairing(payload); setStudioSession(null); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to create review code.'); }
    }

    async function resolveDispute(disputeId: string, status: 'UPHELD' | 'OVERTURNED') {
        const response = window.prompt(status === 'OVERTURNED'
            ? 'Explain why the denial is being overturned and the module reopened.'
            : 'Explain why the original denial is being upheld.')?.trim() || '';
        if (!response) return;
        setSaving(true); setError(''); setNotice('');
        try {
            await readPayload(await fetch(`/api/management/modules/${moduleId}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dispute', disputeId, status, reason: response }) }));
            setNotice(status === 'OVERTURNED' ? 'Dispute accepted and the module reopened for review.' : 'Dispute resolved with the denial upheld.');
            await load();
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to resolve dispute.'); }
        finally { setSaving(false); }
    }

    if (loading && !data) return <div className="flex min-h-[70vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" /></div>;
    if (!data) return <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-5 text-red-200">{error || 'Module not found.'}</div>;
    const expiresIn = pairing ? Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - Date.now()) / 60000)) : 0;
    const editableFiles = data.files.filter((file) => file.kind !== 'folder');

    return <div className="-mx-4 -my-6 flex h-[calc(100vh-3.5rem)] min-h-[720px] flex-col overflow-hidden bg-[#070a0f] text-slate-200 sm:-mx-6 lg:-mx-8">
        <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b border-white/8 bg-[#0c1119] px-4">
            <Link href="/management/modules" className="text-xs font-semibold text-slate-500 hover:text-white">Modules</Link><ChevronRight className="h-3.5 w-3.5 text-slate-700" /><ShieldCheck className="h-4 w-4 text-sky-300" />
            <div className="hidden min-w-0 sm:block"><p className="truncate text-sm font-bold text-white">{data.module.name}</p><p className="text-[10px] text-slate-600">Moderation Review IDE · v{data.module.version}</p></div>
            <span className={`ml-2 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest ${statusTone(data.module.status)}`}>{data.module.status.replaceAll('_', ' ')}</span>
            <div className="ml-auto flex shrink-0 items-center gap-2"><span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold md:flex ${studioSession ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 text-slate-500'}`}><PlugZap className="h-3.5 w-3.5" />{studioSession ? `Testing ${studioSession.place_name || studioSession.place_id || 'game'}` : 'Studio offline'}</span><button onClick={() => void connectStudio()} className="whitespace-nowrap rounded-md border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-400/15">Install in test game</button></div>
        </header>
        {pairing && !studioSession && <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-b border-sky-400/15 bg-sky-400/[0.06] px-4 py-2 text-xs"><PlugZap className="h-4 w-4 text-sky-300" /><span>Enter this review code in the moderation plugin:</span><code className="rounded bg-black/40 px-3 py-1 font-mono text-lg font-black tracking-[0.25em] text-white">{pairing.code}</code><span className="text-slate-500">expires in about {expiresIn} min</span><button onClick={() => setPairing(null)} aria-label="Dismiss code"><X className="h-4 w-4" /></button></div>}
        {!data.auditAvailable && <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs text-amber-200">Read-only locally: configure the server service-role key to save private moderation audit records.</div>}
        {(error || notice) && <div className={`shrink-0 border-b px-4 py-2 text-xs ${error ? 'border-red-400/20 bg-red-400/10 text-red-200' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'}`}>{error || notice}</div>}
        <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid h-full min-w-[920px] grid-cols-[220px_minmax(360px,1fr)_340px]">
            <aside className="min-h-0 overflow-y-auto border-r border-white/8 bg-[#0b1017] p-2">
                <div className="mb-2 flex items-center gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500"><Code2 className="h-3.5 w-3.5" /> Submitted project</div>
                {data.files.map((file) => <button key={file.id} disabled={file.kind === 'folder'} onClick={() => setActiveFileId(file.id)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${activeFileId === file.id ? 'bg-sky-400/10 text-sky-100' : file.kind === 'folder' ? 'mt-1 font-bold text-slate-400' : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'}`} style={{ paddingLeft: `${8 + (file.path.split('/').length - 1) * 12}px` }}>{fileIcon(file)}<span className="truncate">{file.name}</span>{file.kind !== 'folder' && <span className="ml-auto text-[9px] text-slate-700">r{file.revision}</span>}</button>)}
                <div className="mt-4 border-t border-white/8 pt-3"><p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Automatic checks</p>{reviewChecks.map((check) => <div key={check.id} className="mt-2 flex gap-2 px-2 text-[11px]"><span className={check.status === 'pass' ? 'text-emerald-300' : 'text-red-300'}>{check.status === 'pass' ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}</span><span className="text-slate-500">{check.title}</span></div>)}</div>
            </aside>
            <main className="flex min-h-0 min-w-0 flex-col bg-[#090d14]">
                {activeFile ? <><div className="flex h-10 shrink-0 items-center gap-3 border-b border-white/8 px-3 text-xs"><span className="text-slate-300">{activeFile.path}</span><span className="text-[10px] text-slate-600">revision {activeFile.revision}</span><button onClick={() => void saveCode()} disabled={!dirtyCode || saving || codeReason.trim().length < 10 || activeFile.kind === 'manifest'} className="ml-auto flex items-center gap-1.5 rounded border border-sky-400/25 px-2.5 py-1.5 font-bold text-sky-200 disabled:opacity-30"><Save className="h-3.5 w-3.5" />Save minor edit</button></div><div className="min-h-0 flex-1"><ModuleIdeEditor value={draft} path={activeFile.path} language={activeFile.kind === 'manifest' ? 'json' : 'luau'} projectPaths={editableFiles.map((file) => file.path)} onChange={setDraft} onSave={() => void saveCode()} onDiagnostics={() => undefined} /></div><div className="shrink-0 border-t border-white/8 bg-[#0d131c] p-3"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500" htmlFor="code-edit-reason">Required justification for code edit</label><input id="code-edit-reason" value={codeReason} onChange={(event) => setCodeReason(event.target.value)} placeholder="Explain the specific defect or safety issue this minor edit corrects…" className="mt-2 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-sky-400/40" /></div></> : <div className="flex flex-1 items-center justify-center text-sm text-slate-600">Select a submitted file.</div>}
            </main>
            <aside className="min-h-0 overflow-y-auto border-l border-white/8 bg-[#0b1017]">
                <div className="flex h-10 border-b border-white/8">{(['moderate', 'history', 'disputes'] as const).map((tab) => <button key={tab} onClick={() => setRightTab(tab)} className={`flex-1 border-b-2 text-[9px] font-bold uppercase tracking-wider ${rightTab === tab ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-600'}`}>{tab}{tab === 'disputes' && data.disputes.length ? ` (${data.disputes.length})` : ''}</button>)}</div>
                {rightTab === 'moderate' && <div className="space-y-5 p-4">
                    <section><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500" htmlFor="review-title">Title</label><input id="review-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="mt-2 w-full rounded border border-white/10 bg-black/25 px-3 py-2 text-sm text-white" /><button disabled={!titleDirty || saving || metadataReason.trim().length < 10} onClick={() => void saveMetadata('title')} className="mt-2 text-[10px] font-bold text-sky-300 disabled:opacity-30">Save title edit</button></section>
                    <section><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500" htmlFor="review-description">Description</label><textarea id="review-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={5} className="mt-2 w-full resize-y rounded border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-white" /><button disabled={!descriptionDirty || saving || metadataReason.trim().length < 10} onClick={() => void saveMetadata('description')} className="mt-2 text-[10px] font-bold text-sky-300 disabled:opacity-30">Save description edit</button></section>
                    <section><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500"><ImageIcon className="h-3.5 w-3.5" /> Thumbnails</p><div className="mt-2 grid grid-cols-2 gap-2">{data.module.thumbnailUrls.map((url) => { const kept = thumbnailUrls.includes(url); return <button key={url} onClick={() => setThumbnailUrls((current) => kept ? current.filter((item) => item !== url) : [...current, url])} className={`relative overflow-hidden rounded border ${kept ? 'border-sky-400/40' : 'border-red-400/30 opacity-40'}`}><img src={url} alt="Submitted module thumbnail" className="aspect-video w-full object-cover" /><span className="absolute right-1 top-1 rounded bg-black/70 p-1">{kept ? <Check className="h-3 w-3 text-emerald-300" /> : <X className="h-3 w-3 text-red-300" />}</span></button>; })}</div><button disabled={!thumbnailsDirty || saving || metadataReason.trim().length < 10} onClick={() => void saveMetadata('thumbnails')} className="mt-2 text-[10px] font-bold text-sky-300 disabled:opacity-30">Save thumbnail moderation</button></section>
                    <section><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500" htmlFor="metadata-reason">Required metadata edit reason</label><textarea id="metadata-reason" value={metadataReason} onChange={(event) => setMetadataReason(event.target.value)} rows={3} placeholder="Explain why this title, description, or thumbnail change is justified…" className="mt-2 w-full rounded border border-white/10 bg-black/25 px-3 py-2 text-xs text-white" /></section>
                    <section className="border-t border-white/8 pt-4"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500" htmlFor="decision-reason">Decision reason</label><textarea id="decision-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} rows={4} placeholder="Required for denial; visible to the uploader…" className="mt-2 w-full rounded border border-white/10 bg-black/25 px-3 py-2 text-xs text-white" /><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => void decide('PUBLISHED')} disabled={saving} className="rounded bg-emerald-500 px-3 py-2 text-xs font-black text-emerald-950 disabled:opacity-40">Approve</button><button onClick={() => void decide('REJECTED')} disabled={saving || decisionReason.trim().length < 20} className="rounded bg-red-500 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Deny</button></div><p className="mt-2 text-[10px] leading-4 text-slate-600">Denial removes public listing only. The owner keeps test installs and may dispute, revise, or resubmit.</p></section>
                </div>}
                {rightTab === 'history' && <div className="space-y-3 p-4">{data.moderationEdits.map((edit) => <article key={edit.id} className="rounded border border-white/8 bg-black/20 p-3"><div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider"><span className="text-sky-300">{edit.edit_type}</span><span className="text-slate-700">{new Date(edit.created_at).toLocaleString()}</span></div><p className="mt-2 break-all text-[10px] text-slate-500">{edit.target}</p><p className="mt-2 text-xs leading-5 text-slate-300">{edit.reason}</p><p className="mt-2 text-[9px] text-slate-700">Moderator {edit.moderator_discord_id}</p></article>)}{data.moderationEdits.length === 0 && <p className="text-xs text-slate-600">No moderator edits have been made.</p>}</div>}
                {rightTab === 'disputes' && <div className="space-y-3 p-4">{data.disputes.map((dispute) => <article key={dispute.id} className="rounded border border-amber-400/15 bg-amber-400/[0.04] p-3"><div className="flex justify-between text-[9px] font-bold uppercase tracking-wider"><span className="text-amber-300">{dispute.status}</span><span className="text-slate-700">{new Date(dispute.created_at).toLocaleString()}</span></div><p className="mt-2 text-xs leading-5 text-slate-300">{dispute.reason}</p>{dispute.moderator_response && <p className="mt-2 border-t border-white/8 pt-2 text-xs text-slate-500">{dispute.moderator_response}</p>}{dispute.status === 'OPEN' && <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => void resolveDispute(dispute.id, 'UPHELD')} className="rounded border border-red-400/25 px-2 py-1.5 text-[10px] font-bold text-red-300 disabled:opacity-40">Uphold denial</button><button disabled={saving} onClick={() => void resolveDispute(dispute.id, 'OVERTURNED')} className="rounded border border-emerald-400/25 px-2 py-1.5 text-[10px] font-bold text-emerald-300 disabled:opacity-40">Overturn</button></div>}</article>)}{data.disputes.length === 0 && <p className="text-xs text-slate-600">The uploader has not disputed this decision.</p>}</div>}
            </aside>
        </div>
        </div>
        <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-white/8 bg-[#0b1017] px-3 text-[10px] font-semibold text-slate-600"><span>Review IDE</span><span>Runtime {data.project.requiredRuntimeVersion}</span><span>{data.files.length} project items</span><span className="ml-auto">Project revision {data.project.revision}</span></footer>
    </div>;
}
