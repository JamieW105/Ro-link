'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
    AlertTriangle, Boxes, Braces, Cable, Check, ChevronDown, ChevronRight, Code2,
    Copy, File, FileCode2, FileJson, Folder, FolderOpen, GitCompare, Library,
    PanelRightClose, PanelRightOpen, Play, Plus, PlugZap, Radio, RefreshCw, Save, Search,
    Server, Settings2, Trash2, Unplug, X, Zap,
} from 'lucide-react';

import ModuleIdeEditor, { type IdeDiagnostic } from '@/components/dashboard/ModuleIdeEditor';
import { moduleApiMetadata } from '@/lib/moduleApiMetadata';

type ModuleFileKind = 'folder' | 'server_script' | 'client_script' | 'shared_module' | 'ui' | 'manifest';
type ModuleSummary = { id: string; slug: string; name: string; description: string; version: string; status: string; updated_at: string; published_at?: string | null };
type ProjectFile = { id: string; path: string; name: string; kind: ModuleFileKind; sourceCode: string | null; uiTree: unknown; revision: number; createdAt: string; updatedAt: string };
type ProjectRemote = { id: string; name: string; remoteType: 'event' | 'function'; direction: 'client_to_server' | 'server_to_client' | 'bidirectional'; schema: Record<string, unknown> };
type ProjectProblem = { severity: 'error' | 'warning'; file?: string; line?: number; column?: number; message: string; code: string };
type ProjectResponse = {
    module: { id: string; slug: string; name: string; description: string; version: string; status: string; createdAt: string; updatedAt: string; publishedAt: string | null };
    project: { formatVersion: number; revision: number; publishedRevision: number | null; requiredRuntimeVersion: string; manifest: Record<string, unknown>; createdAt: string; updatedAt: string };
    files: ProjectFile[];
    remotes: ProjectRemote[];
};
type Draft = { value: string; revision: number; dirty: boolean; status: 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict' };
type StudioNode = { id: string; parentId?: string; name: string; className: string; path: string; hasChildren?: boolean; isScript?: boolean; children?: StudioNode[] };
type StudioScript = { instanceId: string; path: string; name: string; className: string; source: string; revision: string; dirty: boolean; saving?: boolean };
type SyncLog = { id: string; time: string; message: string; channel: 'output' | 'studio'; tone?: 'error' | 'success' | 'normal' };
type BridgeEvent = { id: number; type: string; requestId?: string; revision?: string; payload: Record<string, unknown> };
type VersionRow = { id: string; version: string; project_revision: number; format_version: number; package_hash: string; created_at: string };
type PublishCheck = { ready: boolean; problems: ProjectProblem[]; summary: { scripts: number; remotes: number; uiRoots: number; warnings: number; errors: number } };
type Conflict = { kind: 'project' | 'studio'; title: string; fileId?: string; browserSource: string; serverSource: string; serverRevision: number | string };

class ApiError extends Error {
    status: number;
    payload: Record<string, unknown>;
    constructor(message: string, status: number, payload: Record<string, unknown>) {
        super(message);
        this.status = status;
        this.payload = payload;
    }
}

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new ApiError(String(payload.error || `Request failed (${response.status})`), response.status, payload);
    return payload as T;
};

const dirname = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
function fileIcon(file: ProjectFile, open = false) {
    if (file.kind === 'folder') return open ? <FolderOpen className="h-3.5 w-3.5 text-amber-300" /> : <Folder className="h-3.5 w-3.5 text-amber-300" />;
    if (file.kind === 'manifest') return <FileJson className="h-3.5 w-3.5 text-amber-200" />;
    if (file.kind === 'ui') return <Boxes className="h-3.5 w-3.5 text-fuchsia-300" />;
    if (file.kind === 'server_script') return <Server className="h-3.5 w-3.5 text-sky-300" />;
    if (file.kind === 'client_script') return <Play className="h-3.5 w-3.5 text-emerald-300" />;
    return <FileCode2 className="h-3.5 w-3.5 text-cyan-300" />;
}

function mergeStudioNode(roots: StudioNode[], event: BridgeEvent) {
    const incoming = event.payload as unknown as StudioNode;
    const remove = (items: StudioNode[]): StudioNode[] => items.filter((item) => item.id !== incoming.id).map((item) => ({ ...item, children: item.children ? remove(item.children) : item.children }));
    const attach = (items: StudioNode[]): StudioNode[] => items.map((item) => item.id === incoming.parentId
        ? { ...item, hasChildren: true, children: [...(item.children || []).filter((child) => child.id !== incoming.id), incoming] }
        : { ...item, children: item.children ? attach(item.children) : item.children });
    if (event.type === 'tree.instanceDeleted') return remove(roots);
    if (event.type === 'tree.instanceCreated' || event.type === 'tree.instanceMoved') return incoming.parentId ? attach(remove(roots)) : [...remove(roots), incoming];
    const walk = (items: StudioNode[]): StudioNode[] => items.map((item) => item.id === incoming.id ? { ...item, ...incoming, children: incoming.children ?? item.children } : { ...item, children: item.children ? walk(item.children) : item.children });
    return walk(roots);
}

function replaceStudioChildren(roots: StudioNode[], id: string, children: StudioNode[]): StudioNode[] {
    return roots.map((item) => item.id === id ? { ...item, children } : { ...item, children: item.children ? replaceStudioChildren(item.children, id, children) : item.children });
}

function StudioTreeNode({ node, onOpen, onExpand }: { node: StudioNode; onOpen: (node: StudioNode) => void; onExpand: (node: StudioNode) => void }) {
    const [open, setOpen] = useState(Boolean(node.children?.length));
    const toggle = () => {
        if (node.hasChildren && !open && !node.children) onExpand(node);
        setOpen((value) => !value);
    };
    return <div className="select-none text-xs">
        <button type="button" onDoubleClick={() => node.isScript && onOpen(node)} onClick={toggle} className="flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-left text-slate-300 outline-none hover:bg-white/[0.05] hover:text-white focus-visible:ring-1 focus-visible:ring-sky-400">
            {node.hasChildren ? (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <span className="w-3" />}
            {node.isScript ? <Code2 className="h-3.5 w-3.5 text-sky-300" /> : open ? <FolderOpen className="h-3.5 w-3.5 text-amber-300" /> : <Folder className="h-3.5 w-3.5 text-amber-300" />}
            <span className="truncate">{node.name}</span><span className="ml-auto truncate text-[9px] uppercase tracking-wider text-slate-600">{node.className}</span>
        </button>
        {open && node.children && <div className="ml-3 border-l border-white/8 pl-1">{node.children.map((child) => <StudioTreeNode key={child.id} node={child} onOpen={onOpen} onExpand={onExpand} />)}</div>}
    </div>;
}

function UiTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
    if (!value || typeof value !== 'object') return null;
    const node = value as { name?: string; className?: string; children?: unknown[]; properties?: Record<string, unknown> };
    return <div className={depth ? 'ml-4 border-l border-white/8 pl-2' : ''}>
        <div className="flex h-7 items-center gap-2 text-xs text-slate-300"><Boxes className="h-3.5 w-3.5 text-fuchsia-300" /><span>{node.name || 'UI object'}</span><span className="text-[9px] uppercase tracking-wider text-slate-600">{node.className || 'Instance'}</span></div>
        {(node.children || []).map((child, index) => <UiTree key={index} value={child} depth={depth + 1} />)}
    </div>;
}

export default function ModuleIdeClient() {
    const [modules, setModules] = useState<ModuleSummary[]>([]);
    const [moduleId, setModuleId] = useState('');
    const [project, setProjectState] = useState<ProjectResponse | null>(null);
    const projectRef = useRef<ProjectResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [tabs, setTabs] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('');
    const [drafts, setDraftsState] = useState<Record<string, Draft>>({});
    const draftsRef = useRef<Record<string, Draft>>({});
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['Server', 'Client', 'Shared', 'UI']));
    const [selectedFileId, setSelectedFileId] = useState('');
    const [fileSearch, setFileSearch] = useState('');
    const [newItem, setNewItem] = useState<{ kind: ModuleFileKind; name: string } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: ProjectFile } | null>(null);
    const [diagnostics, setDiagnostics] = useState<Record<string, IdeDiagnostic[]>>({});
    const [serverProblems, setServerProblems] = useState<ProjectProblem[]>([]);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [bottomTab, setBottomTab] = useState<'problems' | 'output' | 'studio'>('problems');
    const [rightTab, setRightTab] = useState<'inspector' | 'docs' | 'remotes' | 'versions'>('inspector');
    const [rightVisible, setRightVisible] = useState(true);
    const [compactLayout, setCompactLayout] = useState(false);
    const [compactPanelOpen, setCompactPanelOpen] = useState(false);
    const [leftWidth, setLeftWidth] = useState(286);
    const [rightWidth, setRightWidth] = useState(300);
    const [bottomHeight, setBottomHeight] = useState(190);
    const [error, setError] = useState('');
    const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
    const [connected, setConnected] = useState(false);
    const [studioRoots, setStudioRoots] = useState<StudioNode[]>([]);
    const [studioScript, setStudioScript] = useState<StudioScript | null>(null);
    const [conflict, setConflict] = useState<Conflict | null>(null);
    const [publishCheck, setPublishCheck] = useState<PublishCheck | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [versions, setVersions] = useState<VersionRow[]>([]);
    const [quickMode, setQuickMode] = useState<'files' | 'commands' | null>(null);
    const [quickQuery, setQuickQuery] = useState('');
    const [createModuleOpen, setCreateModuleOpen] = useState(false);
    const [createModuleName, setCreateModuleName] = useState('');
    const [remoteForm, setRemoteForm] = useState({ name: '', remoteType: 'event' as 'event' | 'function', direction: 'bidirectional' as ProjectRemote['direction'], schema: '{}', id: '' });
    const cursorRef = useRef(0);
    const pendingOpenRef = useRef<Map<string, StudioNode>>(new Map());
    const activeTabRef = useRef(activeTab);
    const tabsRef = useRef(tabs);
    const studioScriptRef = useRef(studioScript);

    const setProject = useCallback((next: ProjectResponse | null | ((current: ProjectResponse | null) => ProjectResponse | null)) => {
        setProjectState((current) => {
            const value = typeof next === 'function' ? next(current) : next;
            projectRef.current = value;
            return value;
        });
    }, []);
    const setDrafts = useCallback((next: Record<string, Draft> | ((current: Record<string, Draft>) => Record<string, Draft>)) => {
        setDraftsState((current) => {
            const value = typeof next === 'function' ? next(current) : next;
            draftsRef.current = value;
            return value;
        });
    }, []);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
    useEffect(() => { tabsRef.current = tabs; }, [tabs]);
    useEffect(() => { studioScriptRef.current = studioScript; }, [studioScript]);

    const log = useCallback((message: string, channel: SyncLog['channel'] = 'output', tone: SyncLog['tone'] = 'normal') => {
        setLogs((items) => [...items.slice(-150), { id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), message, channel, tone }]);
    }, []);

    const loadModules = useCallback(async () => {
        const result = await api<{ modules: ModuleSummary[] }>('/api/dashboard/modules/ide');
        setModules(result.modules);
        return result.modules;
    }, []);

    const openProjectFile = useCallback((file: ProjectFile) => {
        if (file.kind === 'folder') {
            setExpanded((current) => { const next = new Set(current); if (next.has(file.path)) next.delete(file.path); else next.add(file.path); return next; });
            return;
        }
        const key = `project:${file.id}`;
        setTabs((current) => current.includes(key) ? current : [...current, key]);
        setActiveTab(key);
        setSelectedFileId(file.id);
        if (file.kind !== 'ui') setDrafts((current) => current[file.id] ? current : { ...current, [file.id]: { value: file.sourceCode || '', revision: file.revision, dirty: false, status: 'saved' } });
    }, [setDrafts]);

    const loadProject = useCallback(async (id = moduleId, preserveDirty = true) => {
        if (!id) { setProject(null); setLoading(false); return; }
        setLoading(true);
        try {
            const result = await api<ProjectResponse>(`/api/dashboard/modules/ide/${id}`);
            setProject(result);
            setDrafts((current) => {
                const next: Record<string, Draft> = {};
                for (const file of result.files) {
                    if (file.kind === 'folder' || file.kind === 'ui') continue;
                    const existing = current[file.id];
                    next[file.id] = preserveDirty && existing?.dirty ? existing : { value: file.sourceCode || '', revision: file.revision, dirty: false, status: 'saved' };
                }
                return next;
            });
            const storedTabs = JSON.parse(localStorage.getItem(`rolink-ide-tabs:${id}`) || '[]') as string[];
            const valid = new Set(result.files.filter((file) => file.kind !== 'folder').map((file) => `project:${file.id}`));
            const restored = storedTabs.filter((key) => valid.has(key));
            if (!tabsRef.current.length && !activeTabRef.current) {
                const first = result.files.find((file) => file.path === (result.project.manifest.entrypoints as { server?: string })?.server)
                    || result.files.find((file) => file.path === 'module.json');
                if (restored.length) { setTabs(restored); setActiveTab(restored[0]); }
                else if (first) openProjectFile(first);
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Module project failed to load.');
        } finally {
            setLoading(false);
        }
    }, [moduleId, openProjectFile, setDrafts, setProject]);

    useEffect(() => {
        const preferences = JSON.parse(localStorage.getItem('rolink-module-ide-preferences') || '{}') as Record<string, unknown>;
        if (typeof preferences.leftWidth === 'number') setLeftWidth(Math.min(420, Math.max(220, preferences.leftWidth)));
        if (typeof preferences.rightWidth === 'number') setRightWidth(Math.min(440, Math.max(240, preferences.rightWidth)));
        if (typeof preferences.bottomHeight === 'number') setBottomHeight(Math.min(360, Math.max(120, preferences.bottomHeight)));
        if (typeof preferences.rightVisible === 'boolean') setRightVisible(preferences.rightVisible);
        void loadModules().then((rows) => {
            const query = new URLSearchParams(window.location.search);
            const queryId = query.get('module');
            const savedId = localStorage.getItem('rolink-module-ide-last-module');
            setModuleId([queryId, savedId].find((id) => id && rows.some((row) => row.id === id)) || rows[0]?.id || '');
            if (query.get('new') === '1') setCreateModuleOpen(true);
        }).catch((reason) => setError(reason.message));
    }, [loadModules]);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 980px)');
        const update = () => {
            setCompactLayout(media.matches);
            if (!media.matches) setCompactPanelOpen(false);
        };
        update(); media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        localStorage.setItem('rolink-module-ide-preferences', JSON.stringify({ leftWidth, rightWidth, bottomHeight, rightVisible }));
    }, [bottomHeight, leftWidth, rightVisible, rightWidth]);
    useEffect(() => {
        if (!moduleId) return;
        localStorage.setItem('rolink-module-ide-last-module', moduleId);
        setTabs([]); setActiveTab(''); setDiagnostics({}); setServerProblems([]); setStudioScript(null);
        void loadProject(moduleId, false);
    }, [loadProject, moduleId]);
    useEffect(() => {
        if (!moduleId) return;
        localStorage.setItem(`rolink-ide-tabs:${moduleId}`, JSON.stringify(tabs.filter((key) => key.startsWith('project:'))));
    }, [moduleId, tabs]);

    const selectedModule = modules.find((item) => item.id === moduleId);
    const selectedFile = project?.files.find((file) => file.id === selectedFileId) || null;
    const activeProjectId = activeTab.startsWith('project:') ? activeTab.slice(8) : '';
    const activeFile = project?.files.find((file) => file.id === activeProjectId) || null;
    const activeDraft = activeFile ? drafts[activeFile.id] : null;
    const hasDirty = Object.values(drafts).some((draft) => draft.dirty) || Boolean(studioScript?.dirty);

    useEffect(() => {
        const protect = (event: BeforeUnloadEvent) => { if (hasDirty) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', protect);
        return () => window.removeEventListener('beforeunload', protect);
    }, [hasDirty]);

    const saveProjectFile = useCallback(async (fileId: string) => {
        const currentProject = projectRef.current;
        const file = currentProject?.files.find((item) => item.id === fileId);
        const draft = draftsRef.current[fileId];
        if (!currentProject || !file || !draft?.dirty || draft.status === 'saving') return true;
        const value = draft.value;
        setDrafts((current) => ({ ...current, [fileId]: { ...current[fileId], status: 'saving' } }));
        try {
            let nextFileRevision = draft.revision + 1;
            let projectRevision = currentProject.project.revision;
            if (file.kind === 'manifest') {
                let manifest: Record<string, unknown>;
                try { manifest = JSON.parse(value) as Record<string, unknown>; }
                catch { throw new Error('module.json is not valid JSON. Fix it before saving.'); }
                const result = await api<{ manifest: Record<string, unknown>; projectRevision: number }>(`/api/dashboard/modules/ide/${moduleId}/manifest`, { method: 'PATCH', body: JSON.stringify({ manifest, expectedRevision: currentProject.project.revision }) });
                projectRevision = result.projectRevision;
                setProject((current) => current ? { ...current, module: { ...current.module, name: String(result.manifest.name || current.module.name), version: String(result.manifest.version || current.module.version), description: String(result.manifest.description || current.module.description) }, project: { ...current.project, manifest: result.manifest, revision: result.projectRevision }, files: current.files.map((item) => item.id === fileId ? { ...item, sourceCode: value, revision: nextFileRevision } : item) } : current);
                void loadModules().catch(() => undefined);
            } else {
                const result = await api<{ file: { revision?: number }; projectRevision: number }>(`/api/dashboard/modules/ide/${moduleId}/files`, { method: 'POST', body: JSON.stringify({ action: 'update', id: fileId, expectedRevision: draft.revision, sourceCode: value }) });
                nextFileRevision = Number(result.file?.revision || nextFileRevision);
                projectRevision = Number(result.projectRevision || projectRevision);
                setProject((current) => current ? { ...current, project: { ...current.project, revision: projectRevision }, files: current.files.map((item) => item.id === fileId ? { ...item, sourceCode: value, revision: nextFileRevision, updatedAt: new Date().toISOString() } : item) } : current);
            }
            setDrafts((current) => ({ ...current, [fileId]: { ...current[fileId], revision: nextFileRevision, dirty: current[fileId]?.value !== value, status: current[fileId]?.value === value ? 'saved' : 'dirty' } }));
            log(`${file.path} saved as draft.`, 'output', 'success');
            return true;
        } catch (reason) {
            if (reason instanceof ApiError && reason.status === 409) {
                const current = reason.payload.conflict as Record<string, unknown> | undefined;
                const returnedProject = reason.payload.project as ProjectResponse | undefined;
                const serverFile = returnedProject?.files.find((item) => item.id === fileId);
                setConflict({ kind: 'project', title: file.path, fileId, browserSource: value, serverSource: String(current?.source_code ?? serverFile?.sourceCode ?? ''), serverRevision: Number(current?.revision ?? serverFile?.revision ?? draft.revision) });
                setDrafts((items) => ({ ...items, [fileId]: { ...items[fileId], status: 'conflict' } }));
                log(`${file.path} has a server revision conflict.`, 'output', 'error');
            } else {
                const message = reason instanceof Error ? reason.message : 'File save failed.';
                setDrafts((items) => ({ ...items, [fileId]: { ...items[fileId], status: 'failed' } }));
                setError(message);
                log(`${file.path}: ${message}`, 'output', 'error');
            }
            return false;
        }
    }, [loadModules, log, moduleId, setDrafts, setProject]);

    const saveAll = useCallback(async () => {
        for (const [id, draft] of Object.entries(draftsRef.current)) if (draft.dirty && !await saveProjectFile(id)) return false;
        return true;
    }, [saveProjectFile]);

    useEffect(() => {
        if (!activeFile || !activeDraft?.dirty || activeDraft.status === 'conflict') return;
        const timer = window.setTimeout(() => { void saveProjectFile(activeFile.id); }, 900);
        return () => window.clearTimeout(timer);
    }, [activeDraft?.value, activeDraft?.dirty, activeDraft?.status, activeFile, saveProjectFile]);

    const sendEvents = useCallback(async (events: Array<{ type: string; requestId?: string; revision?: string; payload?: Record<string, unknown> }>) => {
        if (!moduleId) return;
        await api(`/api/dashboard/modules/ide/${moduleId}/studio/events`, { method: 'POST', body: JSON.stringify({ events }) });
    }, [moduleId]);

    const processEvents = useCallback(async (events: BridgeEvent[]) => {
        for (const event of events) {
            if (event.type === 'studio.connected') log('Connected to Studio.', 'studio', 'success');
            else if (event.type === 'tree.snapshot') { setStudioRoots((event.payload.roots || []) as StudioNode[]); log(`Received Explorer snapshot (${String(event.payload.totalNodes || 0)} nodes).`, 'studio'); }
            else if (event.type === 'tree.children') setStudioRoots((roots) => replaceStudioChildren(roots, String(event.payload.instanceId || ''), (event.payload.children || []) as StudioNode[]));
            else if (event.type.startsWith('tree.instance')) setStudioRoots((roots) => mergeStudioNode(roots, event));
            else if (event.type === 'script.contents') {
                const node = pendingOpenRef.current.get(event.requestId || '');
                const next = { instanceId: String(event.payload.instanceId || node?.id || ''), path: String(event.payload.path || node?.path || ''), name: String(event.payload.name || node?.name || 'Studio Script'), className: String(event.payload.className || node?.className || 'Script'), source: String(event.payload.source || ''), revision: String(event.revision || ''), dirty: false };
                setStudioScript(next); setTabs((current) => current.includes(`studio:${next.instanceId}`) ? current : [...current, `studio:${next.instanceId}`]); setActiveTab(`studio:${next.instanceId}`);
                log(`Opened ${next.path}.`, 'studio');
            } else if (event.type === 'script.updated') {
                setStudioScript((current) => current ? { ...current, revision: String(event.revision || current.revision), dirty: false, saving: false } : current);
                log('Studio script updated safely.', 'studio', 'success');
            } else if (event.type === 'script.conflict') {
                setStudioScript((current) => current ? { ...current, saving: false } : current);
                const openedScript = studioScriptRef.current;
                setConflict({ kind: 'studio', title: String(event.payload.path || openedScript?.path || 'Studio script'), browserSource: openedScript?.source || '', serverSource: String(event.payload.source || ''), serverRevision: String(event.revision || '') });
                log('Studio rejected a stale script update.', 'studio', 'error');
            } else if (event.type === 'ui.import') {
                const roots = (event.payload.roots || []) as Array<{ name?: string }>;
                let imported = 0;
                try {
                    for (const root of roots) {
                        const name = String(root.name || 'ImportedUI').replace(/[^A-Za-z0-9_.-]/g, '-');
                        let path = `UI/${name}`; let suffix = 2;
                        while (projectRef.current?.files.some((file) => file.path === path)) { path = `UI/${name}-${suffix}`; suffix += 1; }
                        await api(`/api/dashboard/modules/ide/${moduleId}/files`, { method: 'POST', body: JSON.stringify({ action: 'create', path, kind: 'ui', uiTree: root }) });
                        imported += 1;
                    }
                    await sendEvents([{ type: 'ui.importResult', requestId: event.requestId, payload: { ok: true, imported } }]);
                    await loadProject(moduleId, true);
                    log(`Imported ${imported} UI root${imported === 1 ? '' : 's'} into UI/.`, 'studio', 'success');
                } catch (reason) {
                    const message = reason instanceof Error ? reason.message : 'UI import failed.';
                    await sendEvents([{ type: 'ui.importResult', requestId: event.requestId, payload: { ok: false, imported, message } }]).catch(() => undefined);
                    setError(message); log(message, 'studio', 'error');
                }
            } else if (event.type === 'sync.error') { const message = String(event.payload.message || 'Studio sync failed.'); setError(message); log(message, 'studio', 'error'); }
        }
    }, [loadProject, log, moduleId, sendEvents]);

    useEffect(() => {
        if (!moduleId) return;
        let cancelled = false;
        cursorRef.current = 0; setConnected(false); setStudioRoots([]);
        const poll = async () => {
            while (!cancelled) {
                try {
                    const payload = await api<{ connected: boolean; events: BridgeEvent[]; cursor: number }>(`/api/dashboard/modules/ide/${moduleId}/studio/events?cursor=${cursorRef.current}`);
                    if (cancelled) return;
                    setConnected(payload.connected); cursorRef.current = payload.cursor; await processEvents(payload.events || []);
                } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Studio polling failed.'); }
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
            }
        };
        void poll();
        return () => { cancelled = true; };
    }, [moduleId, processEvents]);

    const openStudioScript = useCallback(async (node: StudioNode) => {
        const requestId = crypto.randomUUID(); pendingOpenRef.current.set(requestId, node);
        await sendEvents([{ type: 'script.request', requestId, payload: { instanceId: node.id } }]);
        log(`Requested ${node.path} from Studio.`, 'studio');
    }, [log, sendEvents]);
    const expandStudioNode = useCallback(async (node: StudioNode) => {
        await sendEvents([{ type: 'tree.children', requestId: crypto.randomUUID(), payload: { instanceId: node.id } }]);
    }, [sendEvents]);
    const saveStudioScript = useCallback(async (forceRevision?: string) => {
        if (!studioScript?.dirty || studioScript.saving) return;
        setStudioScript({ ...studioScript, saving: true });
        await sendEvents([{ type: 'script.update', requestId: crypto.randomUUID(), revision: forceRevision || studioScript.revision, payload: { instanceId: studioScript.instanceId, source: studioScript.source } }]);
        log(`Sent ${studioScript.path} to Studio with a revision check.`, 'studio');
    }, [log, sendEvents, studioScript]);

    const performFileAction = useCallback(async (body: Record<string, unknown>) => {
        if (!moduleId) return;
        try {
            await api(`/api/dashboard/modules/ide/${moduleId}/files`, { method: 'POST', body: JSON.stringify(body) });
            await loadProject(moduleId, true); log(`Explorer ${String(body.action)} completed.`, 'output', 'success');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Explorer operation failed.'); }
    }, [loadProject, log, moduleId]);

    const createItem = useCallback(async () => {
        if (!newItem || !project) return;
        const baseParent = selectedFile?.kind === 'folder' ? selectedFile.path : selectedFile ? dirname(selectedFile.path) : newItem.kind === 'server_script' ? 'Server' : newItem.kind === 'client_script' ? 'Client' : newItem.kind === 'shared_module' ? 'Shared' : '';
        let name = newItem.name.trim().replace(/[\\/]/g, '-');
        if (!name) return;
        if (newItem.kind === 'server_script' && !name.endsWith('.luau')) name += '.server.luau';
        if (newItem.kind === 'client_script' && !name.endsWith('.luau')) name += '.client.luau';
        if (newItem.kind === 'shared_module' && !name.endsWith('.luau')) name += '.luau';
        const path = baseParent ? `${baseParent}/${name}` : name;
        const sourceCode = newItem.kind === 'folder' ? null : newItem.kind === 'server_script' ? 'return {\n\tInit = function(context, settings)\n\t\t-- Server startup\n\tend,\n}\n' : newItem.kind === 'client_script' ? 'return {\n\tInit = function(context, settings)\n\t\t-- Client startup\n\tend,\n}\n' : 'local Module = {}\n\nreturn Module\n';
        await performFileAction({ action: 'create', path, kind: newItem.kind, sourceCode }); setNewItem(null); setExpanded((current) => new Set(current).add(baseParent));
    }, [newItem, performFileAction, project, selectedFile]);

    const renameFile = useCallback((file: ProjectFile) => {
        const name = window.prompt(`Rename ${file.name}`, file.name)?.trim();
        if (!name || name === file.name) return;
        const parent = dirname(file.path); void performFileAction({ action: 'rename', id: file.id, path: parent ? `${parent}/${name}` : name });
    }, [performFileAction]);
    const duplicateFile = useCallback((file: ProjectFile) => {
        const extensionIndex = file.name.indexOf('.');
        const suggested = extensionIndex > 0 ? `${file.name.slice(0, extensionIndex)} Copy${file.name.slice(extensionIndex)}` : `${file.name} Copy`;
        const name = window.prompt(`Duplicate ${file.name} as`, suggested)?.trim();
        if (!name) return;
        const parent = dirname(file.path); void performFileAction({ action: 'duplicate', id: file.id, path: parent ? `${parent}/${name}` : name });
    }, [performFileAction]);
    const deleteFile = useCallback((file: ProjectFile) => {
        if (!window.confirm(`Delete ${file.path}${file.kind === 'folder' ? ' and everything inside it' : ''}?`)) return;
        setTabs((current) => current.filter((key) => key !== `project:${file.id}`)); void performFileAction({ action: 'delete', path: file.path });
    }, [performFileAction]);

    const flatFiles = useMemo(() => {
        if (!project) return [] as Array<{ file: ProjectFile; depth: number }>;
        if (fileSearch.trim()) return project.files.filter((file) => file.path.toLowerCase().includes(fileSearch.toLowerCase())).map((file) => ({ file, depth: Math.min(4, file.path.split('/').length - 1) }));
        const byParent = new Map<string, ProjectFile[]>();
        for (const file of project.files) { const parent = dirname(file.path); byParent.set(parent, [...(byParent.get(parent) || []), file]); }
        const result: Array<{ file: ProjectFile; depth: number }> = [];
        const walk = (parent: string, depth: number) => {
            const children = (byParent.get(parent) || []).sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.name.localeCompare(b.name));
            for (const file of children) { result.push({ file, depth }); if (file.kind === 'folder' && expanded.has(file.path)) walk(file.path, depth + 1); }
        };
        walk('', 0); return result;
    }, [expanded, fileSearch, project]);

    const closeTab = useCallback((key: string) => {
        if (key.startsWith('project:')) {
            const id = key.slice(8); if (draftsRef.current[id]?.dirty && !window.confirm('This file has unsaved changes. Close it anyway?')) return;
        } else if (studioScript?.dirty && !window.confirm('This Studio script has unsaved changes. Close it anyway?')) return;
        setTabs((current) => { const index = current.indexOf(key); const next = current.filter((item) => item !== key); if (activeTabRef.current === key) setActiveTab(next[Math.max(0, index - 1)] || ''); return next; });
    }, [studioScript?.dirty]);

    const preparePublish = useCallback(async () => {
        if (!await saveAll()) return;
        try {
            const check = await api<PublishCheck>(`/api/dashboard/modules/ide/${moduleId}/validate`); setServerProblems(check.problems); setPublishCheck(check); setBottomTab('problems');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Validation failed.'); }
    }, [moduleId, saveAll]);
    const publish = useCallback(async () => {
        setPublishing(true);
        try {
            const result = await api<{ version: string; packageHash: string }>(`/api/dashboard/modules/ide/${moduleId}/publish`, { method: 'POST' });
            log(`Published immutable version ${result.version} (${result.packageHash.slice(0, 12)}…).`, 'output', 'success'); setPublishCheck(null); await Promise.all([loadProject(moduleId, false), loadModules()]);
        } catch (reason) { if (reason instanceof ApiError && Array.isArray(reason.payload.problems)) setServerProblems(reason.payload.problems as ProjectProblem[]); setError(reason instanceof Error ? reason.message : 'Publish failed.'); }
        finally { setPublishing(false); }
    }, [loadModules, loadProject, log, moduleId]);

    const saveRemote = useCallback(async () => {
        try {
            const schema = JSON.parse(remoteForm.schema) as Record<string, unknown>;
            await api(`/api/dashboard/modules/ide/${moduleId}/remotes`, { method: 'POST', body: JSON.stringify({ action: remoteForm.id ? 'update' : 'create', id: remoteForm.id || undefined, name: remoteForm.name, remoteType: remoteForm.remoteType, direction: remoteForm.direction, schema }) });
            setRemoteForm({ name: '', remoteType: 'event', direction: 'bidirectional', schema: '{}', id: '' }); await loadProject(moduleId, true); log('Remote definition saved.', 'output', 'success');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Remote save failed.'); }
    }, [loadProject, log, moduleId, remoteForm]);
    const deleteRemote = useCallback(async (remote: ProjectRemote) => {
        if (!window.confirm(`Delete remote ${remote.name}?`)) return;
        try { await api(`/api/dashboard/modules/ide/${moduleId}/remotes`, { method: 'POST', body: JSON.stringify({ action: 'delete', id: remote.id }) }); await loadProject(moduleId, true); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Remote delete failed.'); }
    }, [loadProject, moduleId]);
    const loadVersions = useCallback(async () => {
        try { const result = await api<{ versions: VersionRow[] }>(`/api/dashboard/modules/ide/${moduleId}/versions`); setVersions(result.versions); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Versions failed to load.'); }
    }, [moduleId]);

    useEffect(() => { if (rightTab === 'versions' && moduleId) void loadVersions(); }, [loadVersions, moduleId, rightTab]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            if (event.key.toLowerCase() === 'p') { event.preventDefault(); setQuickMode(event.shiftKey ? 'commands' : 'files'); setQuickQuery(''); }
            if (event.key.toLowerCase() === 's') { event.preventDefault(); if (activeFile) void saveProjectFile(activeFile.id); else if (studioScript) void saveStudioScript(); }
        };
        window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    }, [activeFile, saveProjectFile, saveStudioScript, studioScript]);

    const switchModule = (id: string) => { if (hasDirty && !window.confirm('Switch modules and discard the remaining unsaved changes?')) return; setModuleId(id); window.history.replaceState(null, '', `/dashboard/modules/ide?module=${encodeURIComponent(id)}`); };
    const beginResize = (kind: 'left' | 'right' | 'bottom', event: ReactPointerEvent) => {
        event.preventDefault(); const startX = event.clientX; const startY = event.clientY; const initial = kind === 'left' ? leftWidth : kind === 'right' ? rightWidth : bottomHeight;
        const move = (pointer: PointerEvent) => { if (kind === 'left') setLeftWidth(Math.min(440, Math.max(210, initial + pointer.clientX - startX))); else if (kind === 'right') setRightWidth(Math.min(460, Math.max(230, initial - pointer.clientX + startX))); else setBottomHeight(Math.min(380, Math.max(110, initial - pointer.clientY + startY))); };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    };

    const allProblems = useMemo(() => [...Object.values(diagnostics).flat(), ...serverProblems], [diagnostics, serverProblems]);
    const saveLabel = activeDraft?.status === 'saving' ? 'Saving…' : activeDraft?.status === 'failed' ? 'Save failed' : activeDraft?.status === 'conflict' ? 'Conflict' : hasDirty ? 'Unsaved' : 'Saved';
    const expiresIn = pairing ? Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - Date.now()) / 60000)) : 0;
    const quickFiles = project?.files.filter((file) => file.kind !== 'folder' && file.path.toLowerCase().includes(quickQuery.toLowerCase())).slice(0, 20) || [];
    const showRightPanel = rightVisible && !compactLayout;
    const rightPanelShown = showRightPanel || (compactLayout && compactPanelOpen);
    const toggleRightPanel = () => compactLayout ? setCompactPanelOpen((value) => !value) : setRightVisible((value) => !value);
    const openRightPanel = (tab: 'inspector' | 'docs' | 'remotes' | 'versions') => {
        setRightTab(tab);
        if (compactLayout) setCompactPanelOpen(true);
        else setRightVisible(true);
    };
    const commands = [
        { label: 'Save all files', run: () => void saveAll() }, { label: 'Publish module', run: () => void preparePublish() },
        { label: 'Create server script', run: () => setNewItem({ kind: 'server_script', name: '' }) }, { label: 'Create client script', run: () => setNewItem({ kind: 'client_script', name: '' }) },
        { label: rightPanelShown ? 'Hide inspector' : 'Show inspector', run: toggleRightPanel }, { label: 'Connect Roblox Studio', run: () => void api<{ code: string; expiresAt: string }>(`/api/dashboard/modules/ide/${moduleId}/studio/pair`, { method: 'POST' }).then(setPairing) },
    ].filter((command) => command.label.toLowerCase().includes(quickQuery.toLowerCase()));

    return <div className="relative flex h-screen min-h-[640px] flex-col overflow-hidden bg-[#0b0f17] text-slate-100">
        <div className="fixed inset-0 z-[100] hidden items-center justify-center bg-[#0b0f17] p-8 text-center max-[560px]:flex"><div><Braces className="mx-auto h-10 w-10 text-sky-300" /><p className="mt-4 font-bold">Ro-Link Module IDE is best used on a desktop display.</p><Link href="/dashboard/creator/modules" className="mt-4 inline-block text-sm text-sky-300 underline">Return to Modules</Link></div></div>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 bg-[#111722] px-3">
            <Link href="/dashboard/creator/modules" className="flex items-center gap-2 font-black tracking-tight text-white"><Braces className="h-5 w-5 text-sky-300" /><span className="hidden lg:inline">Ro-Link</span></Link>
            <select aria-label="Module" value={moduleId} onChange={(event) => switchModule(event.target.value)} className="w-44 min-w-0 max-w-64 rounded-lg border border-white/10 bg-[#0b0f17] px-3 py-2 text-sm outline-none focus:border-sky-400/60 max-[700px]:w-32">
                {!modules.length && <option value="">No modules</option>}{modules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="button" onClick={() => setCreateModuleOpen(true)} className="rounded-md border border-white/10 p-2 text-slate-400 hover:text-white" aria-label="Create module"><Plus className="h-4 w-4" /></button>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 max-[980px]:hidden">{selectedModule?.status || 'No module'}</span>
            {project?.project.publishedRevision != null && project.project.publishedRevision !== project.project.revision && <span className="hidden text-[10px] font-semibold text-amber-300 lg:inline">Unpublished changes</span>}
            <div className="ml-auto flex items-center gap-2">
                <span title={connected ? 'Paired Studio session is active' : 'Studio is not connected'} className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold lg:flex ${connected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 text-slate-400'}`}>{connected ? <PlugZap className="h-3.5 w-3.5" /> : <Unplug className="h-3.5 w-3.5" />} Studio {connected ? 'Connected' : 'Disconnected'}</span>
                <button type="button" disabled={!moduleId} onClick={() => api<{ code: string; expiresAt: string }>(`/api/dashboard/modules/ide/${moduleId}/studio/pair`, { method: 'POST' }).then((value) => { setPairing(value); log('Created a one-time Studio pairing code.', 'studio'); }).catch((reason) => setError(reason.message))} className="rounded-lg border border-sky-400/30 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-400/10 disabled:opacity-40">Connect Studio</button>
                <button type="button" onClick={() => void saveAll()} disabled={!hasDirty} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-40"><Save className="h-3.5 w-3.5" /><span className="max-[980px]:hidden">{saveLabel}</span></button>
                <button type="button" onClick={() => void preparePublish()} disabled={!project || publishing} className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-400 disabled:opacity-40">Publish</button>
                <button type="button" onClick={toggleRightPanel} className="rounded-md border border-white/10 p-2 text-slate-400 hover:text-white" aria-label={rightPanelShown ? 'Hide inspector' : 'Show inspector'}>{rightPanelShown ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}</button>
            </div>
        </header>
        {pairing && !connected && <div className="flex shrink-0 items-center justify-center gap-4 border-b border-sky-400/15 bg-sky-400/[0.06] px-4 py-2 text-sm"><Cable className="h-4 w-4 text-sky-300" /><span>Enter this one-time code in the standalone Studio plugin:</span><code className="rounded-md bg-black/35 px-3 py-1 font-mono text-lg font-bold tracking-[0.25em] text-white">{pairing.code}</code><span className="text-xs text-slate-400">expires in about {expiresIn} min</span><button onClick={() => setPairing(null)} aria-label="Dismiss pairing code"><X className="h-4 w-4" /></button></div>}
        {error && <button type="button" onClick={() => setError('')} className="flex shrink-0 items-center gap-2 border-b border-red-400/15 bg-red-400/[0.06] px-4 py-2 text-left text-xs text-red-200"><AlertTriangle className="h-4 w-4" />{error}<span className="ml-auto">Dismiss</span></button>}

        <main className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `${compactLayout ? Math.min(leftWidth, 230) : leftWidth}px 4px minmax(0,1fr) ${showRightPanel ? `4px ${rightWidth}px` : '0 0'}` }}>
            <aside className="min-h-0 overflow-y-auto bg-[#0e141e]">
                <div className="sticky top-0 z-10 border-b border-white/8 bg-[#0e141e] p-2">
                    <div className="flex items-center justify-between px-1 py-1"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Module Explorer</span><div className="flex"><button onClick={() => setNewItem({ kind: 'shared_module', name: '' })} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="New script"><File className="h-3.5 w-3.5" /></button><button onClick={() => setNewItem({ kind: 'folder', name: '' })} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="New folder"><Folder className="h-3.5 w-3.5" /></button><button onClick={() => void loadProject(moduleId, true)} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Refresh project"><RefreshCw className="h-3.5 w-3.5" /></button></div></div>
                    <label className="flex items-center gap-2 rounded-md border border-white/8 bg-black/15 px-2"><Search className="h-3.5 w-3.5 text-slate-600" /><input value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="Search project" className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-600" /></label>
                    {newItem && <div className="mt-2 rounded-md border border-sky-400/20 bg-sky-400/[0.04] p-2"><select value={newItem.kind} onChange={(event) => setNewItem({ ...newItem, kind: event.target.value as ModuleFileKind })} className="mb-2 w-full rounded border border-white/10 bg-[#0b0f17] p-1.5 text-xs"><option value="folder">Folder</option><option value="server_script">Server script</option><option value="client_script">Client script</option><option value="shared_module">Shared module</option></select><form onSubmit={(event) => { event.preventDefault(); void createItem(); }} className="flex gap-1"><input autoFocus value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} placeholder="Name" className="min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-2 text-xs outline-none" /><button className="rounded bg-sky-500 px-2 text-xs font-bold">Add</button><button type="button" onClick={() => setNewItem(null)} className="rounded border border-white/10 p-1"><X className="h-3.5 w-3.5" /></button></form></div>}
                </div>
                <div className="p-2">
                    {loading && !project ? <div className="space-y-2 p-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-7 animate-pulse rounded bg-white/[0.04]" />)}</div> : flatFiles.map(({ file, depth }) => {
                        const isOpen = expanded.has(file.path); const draft = drafts[file.id]; const selected = selectedFileId === file.id;
                        return <button key={file.id} type="button" draggable={!['Server', 'Client', 'Shared', 'UI', 'module.json'].includes(file.path)} onDragStart={(event) => event.dataTransfer.setData('text/rolink-file', file.id)} onDragOver={(event) => { if (file.kind === 'folder') event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('text/rolink-file'); const moving = project?.files.find((item) => item.id === id); if (moving && file.kind === 'folder' && moving.id !== file.id) void performFileAction({ action: 'move', id: moving.id, path: `${file.path}/${moving.name}` }); }} onContextMenu={(event) => { event.preventDefault(); setSelectedFileId(file.id); setContextMenu({ x: event.clientX, y: event.clientY, file }); }} onClick={() => { setSelectedFileId(file.id); if (file.kind === 'folder') openProjectFile(file); }} onDoubleClick={() => file.kind !== 'folder' && openProjectFile(file)} style={{ paddingLeft: 6 + depth * 14 }} className={`group flex h-7 w-full items-center gap-1.5 rounded pr-1.5 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${selected ? 'bg-sky-400/10 text-sky-100' : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'}`}>
                            {file.kind === 'folder' ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <span className="w-3" />}{fileIcon(file, isOpen)}<span className="truncate">{file.name}</span>{draft?.dirty && <span title="Unsaved" className="ml-auto h-2 w-2 rounded-full bg-amber-300" />}{draft?.status === 'conflict' && <AlertTriangle className="ml-auto h-3.5 w-3.5 text-red-300" />}
                        </button>;
                    })}
                    {project && !flatFiles.length && <p className="p-4 text-xs text-slate-500">No project files match the search.</p>}
                    <button type="button" onClick={() => openRightPanel('remotes')} className="mt-2 flex h-8 w-full items-center gap-2 rounded border-t border-white/8 px-2 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-white"><Radio className="h-3.5 w-3.5 text-rose-300" />Remotes <span className="ml-auto text-[10px]">{project?.remotes.length || 0}</span></button>
                </div>
                <div className="border-t border-white/8 p-2"><div className="mb-2 flex items-center justify-between px-1"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Studio Explorer</span><button disabled={!connected} onClick={() => void sendEvents([{ type: 'tree.snapshot', payload: {} }])} className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30"><RefreshCw className="h-3.5 w-3.5" /></button></div>{studioRoots.length ? studioRoots.map((root) => <StudioTreeNode key={root.id} node={root} onOpen={openStudioScript} onExpand={expandStudioNode} />) : <p className="rounded border border-dashed border-white/10 p-3 text-xs leading-5 text-slate-500">Connect Roblox Studio to browse your live game hierarchy.</p>}</div>
            </aside>
            <div onPointerDown={(event) => beginResize('left', event)} className="cursor-col-resize bg-white/[0.04] hover:bg-sky-400/50" />

            <section className="grid min-h-0" style={{ gridTemplateRows: `minmax(0,1fr) 4px ${bottomHeight}px` }}>
                <div className="flex min-h-0 flex-col bg-[#090d14]">
                    <div className="flex h-10 shrink-0 overflow-x-auto border-b border-white/8 bg-[#111722]">
                        {tabs.map((key) => { const file = key.startsWith('project:') ? project?.files.find((item) => item.id === key.slice(8)) : null; const isStudio = key.startsWith('studio:'); const label = isStudio ? studioScript?.name || 'Studio Script' : file?.name || 'Deleted file'; const dirty = isStudio ? studioScript?.dirty : file ? drafts[file.id]?.dirty : false; return <button key={key} onClick={() => setActiveTab(key)} className={`group flex min-w-28 max-w-52 items-center gap-2 border-r border-white/8 px-3 text-xs ${activeTab === key ? 'border-t-2 border-t-sky-400 bg-[#090d14] text-white' : 'text-slate-500 hover:text-slate-200'}`}>{isStudio ? <PlugZap className="h-3 w-3 text-emerald-300" /> : file ? fileIcon(file) : <File className="h-3 w-3" />}<span className="truncate">{label}</span>{dirty ? <span className="ml-auto h-2 w-2 rounded-full bg-amber-300" /> : <X onClick={(event) => { event.stopPropagation(); closeTab(key); }} className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100" />}</button>; })}
                        {!tabs.length && <span className="flex items-center px-4 text-xs text-slate-600">No file open</span>}
                    </div>
                    {activeFile && activeDraft ? <>
                        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-white/6 px-3 text-[10px] text-slate-500">{activeFile.path.split('/').map((part, index) => <span key={`${part}-${index}`} className="flex items-center gap-1">{index > 0 && <ChevronRight className="h-3 w-3" />}{part}</span>)}<span className="ml-auto capitalize">{activeDraft.status}</span></div>
                        <div className="min-h-0 flex-1"><ModuleIdeEditor value={activeDraft.value} path={activeFile.path} language={activeFile.kind === 'manifest' ? 'json' : 'luau'} projectPaths={project?.files.map((file) => file.path) || []} onChange={(value) => setDrafts((current) => ({ ...current, [activeFile.id]: { ...current[activeFile.id], value, dirty: value !== activeFile.sourceCode, status: value !== activeFile.sourceCode ? 'dirty' : 'saved' } }))} onSave={() => void saveProjectFile(activeFile.id)} onDiagnostics={(items) => setDiagnostics((current) => ({ ...current, [activeFile.path]: items }))} /></div>
                    </> : activeFile?.kind === 'ui' ? <div className="grid min-h-0 flex-1 grid-cols-2"><div className="overflow-auto border-r border-white/8 p-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">UI hierarchy preview</p><UiTree value={activeFile.uiTree} /></div><pre className="overflow-auto p-4 text-[11px] leading-5 text-slate-400">{JSON.stringify(activeFile.uiTree, null, 2)}</pre></div>
                    : activeTab.startsWith('studio:') && studioScript ? <><div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/6 px-3 text-[10px] text-slate-500"><span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-bold text-emerald-300">LIVE STUDIO</span><span className="truncate">{studioScript.path}</span><button onClick={() => void saveStudioScript()} disabled={!studioScript.dirty || studioScript.saving} className="ml-auto flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-slate-300 disabled:opacity-30"><Save className="h-3 w-3" />{studioScript.saving ? 'Sending…' : 'Save to Studio'}</button></div><div className="min-h-0 flex-1"><ModuleIdeEditor value={studioScript.source} path={`Studio/${studioScript.path}`} projectPaths={project?.files.map((file) => file.path) || []} onChange={(value) => setStudioScript({ ...studioScript, source: value, dirty: true })} onSave={() => void saveStudioScript()} onDiagnostics={(items) => setDiagnostics((current) => ({ ...current, [`Studio/${studioScript.path}`]: items }))} /></div></>
                    : <div className="flex flex-1 items-center justify-center"><div className="max-w-md text-center"><Braces className="mx-auto h-10 w-10 text-slate-700" /><p className="mt-4 text-sm font-semibold text-slate-300">{project ? project.module.name : 'Open or create a module to start developing.'}</p><p className="mt-2 text-xs leading-5 text-slate-500">Open a project script, define a remote, import UI from Studio, or press Ctrl/Cmd + P to navigate.</p></div></div>}
                </div>
                <div onPointerDown={(event) => beginResize('bottom', event)} className="cursor-row-resize bg-white/[0.04] hover:bg-sky-400/50" />
                <div className="min-h-0 bg-[#0e141e]"><div className="flex h-9 items-center gap-1 border-b border-white/8 px-2">{(['problems', 'output', 'studio'] as const).map((tab) => <button key={tab} onClick={() => setBottomTab(tab)} className={`h-full border-b-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] ${bottomTab === tab ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-500'}`}>{tab === 'problems' ? `Problems (${allProblems.length})` : tab === 'studio' ? 'Studio Sync' : 'Output'}</button>)}<span className="ml-auto text-[10px] text-slate-600">Project revision {project?.project.revision || '—'}</span></div><div className="h-[calc(100%-2.25rem)] overflow-y-auto p-2 font-mono text-[11px] leading-5">{bottomTab === 'problems' ? (allProblems.length ? allProblems.map((problem, index) => <button key={`${problem.code}-${index}`} onClick={() => { const file = project?.files.find((item) => item.path === problem.file); if (file) openProjectFile(file); }} className={`flex w-full gap-3 rounded px-2 py-1 text-left hover:bg-white/[0.04] ${problem.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}><span>{problem.severity === 'error' ? 'error' : 'warn'}</span><span className="min-w-32 text-slate-500">{problem.file || 'project'}{problem.line ? `:${problem.line}:${problem.column || 1}` : ''}</span><span>{problem.message}</span></button>) : <p className="p-2 text-slate-600">No problems detected in opened files.</p>) : (logs.filter((item) => bottomTab === 'studio' ? item.channel === 'studio' : item.channel === 'output').length ? logs.filter((item) => bottomTab === 'studio' ? item.channel === 'studio' : item.channel === 'output').map((item) => <div key={item.id} className={item.tone === 'error' ? 'text-red-300' : item.tone === 'success' ? 'text-emerald-300' : 'text-slate-400'}><span className="mr-3 text-slate-600">{item.time}</span>{item.message}</div>) : <p className="p-2 text-slate-600">No {bottomTab === 'studio' ? 'Studio sync' : 'output'} events yet.</p>)}</div></div>
            </section>

            <div onPointerDown={(event) => beginResize('right', event)} className={`cursor-col-resize bg-white/[0.04] hover:bg-sky-400/50 ${showRightPanel ? '' : 'hidden'}`} />
            {compactLayout && compactPanelOpen && <button type="button" aria-label="Close inspector" onClick={() => setCompactPanelOpen(false)} className="fixed inset-0 z-20 bg-black/50" />}
            <aside style={compactLayout ? { width: Math.min(rightWidth, 360) } : undefined} className={`min-h-0 overflow-y-auto border-l border-white/8 bg-[#0e141e] ${rightPanelShown ? '' : 'hidden'} ${compactLayout && compactPanelOpen ? 'fixed inset-y-0 right-0 z-30 shadow-2xl' : ''}`}>
                <div className="sticky top-0 z-10 flex h-10 border-b border-white/8 bg-[#0e141e]">{(['inspector', 'docs', 'remotes', 'versions'] as const).map((tab) => <button key={tab} onClick={() => setRightTab(tab)} className={`flex-1 text-[9px] font-bold uppercase tracking-wider ${rightTab === tab ? 'border-b-2 border-sky-400 text-sky-300' : 'text-slate-500'}`}>{tab}</button>)}{compactLayout && <button type="button" onClick={() => setCompactPanelOpen(false)} className="px-3 text-slate-500 hover:text-white" aria-label="Close inspector"><X className="h-4 w-4" /></button>}</div>
                {rightTab === 'inspector' && <div className="p-4">{selectedFile ? <><div className="mb-4 flex items-center gap-3">{fileIcon(selectedFile)}<div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedFile.name}</p><p className="truncate text-[10px] text-slate-500">{selectedFile.path}</p></div></div><dl className="grid grid-cols-[90px_1fr] gap-y-2 text-xs"><dt className="text-slate-500">Type</dt><dd>{selectedFile.kind.replaceAll('_', ' ')}</dd><dt className="text-slate-500">Revision</dt><dd>{selectedFile.revision}</dd><dt className="text-slate-500">Updated</dt><dd>{new Date(selectedFile.updatedAt).toLocaleString()}</dd></dl><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(selectedFile.path)} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1.5 text-xs"><Copy className="h-3 w-3" /> Copy path</button>{!['Server', 'Client', 'Shared', 'UI', 'module.json'].includes(selectedFile.path) && <><button onClick={() => renameFile(selectedFile)} className="rounded border border-white/10 px-2 py-1.5 text-xs">Rename</button><button onClick={() => deleteFile(selectedFile)} className="rounded border border-red-400/20 px-2 py-1.5 text-xs text-red-300">Delete</button></>}</div></> : <p className="text-xs leading-5 text-slate-500">Select a project file to inspect its path, type, revision, and actions.</p>}</div>}
                {rightTab === 'docs' && <div className="p-3"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Ro-Link Module API</p>{moduleApiMetadata.map((entry) => <details key={entry.name} className="border-b border-white/8 py-2"><summary className="cursor-pointer font-mono text-xs text-sky-300">{entry.signature}</summary><p className="mt-2 text-xs leading-5 text-slate-400">{entry.description}</p>{entry.parameters?.map((parameter) => <p key={parameter.name} className="mt-1 text-[11px] text-slate-500"><code className="text-slate-300">{parameter.name}: {parameter.type}</code> — {parameter.description}</p>)}</details>)}<Link href="/docs#module-developer-api" className="mt-4 flex items-center gap-2 text-xs text-sky-300 hover:underline"><Library className="h-3.5 w-3.5" /> Full Module Developer API</Link></div>}
                {rightTab === 'remotes' && <div className="p-3"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Namespaced remotes</p><Zap className="h-4 w-4 text-rose-300" /></div><div className="space-y-2">{project?.remotes.map((remote) => <button key={remote.id} onClick={() => setRemoteForm({ id: remote.id, name: remote.name, remoteType: remote.remoteType, direction: remote.direction, schema: JSON.stringify(remote.schema, null, 2) })} className="w-full rounded-md border border-white/8 p-2 text-left hover:border-white/15"><div className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-rose-300" /><span className="text-xs font-semibold">{remote.name}</span><button onClick={(event) => { event.stopPropagation(); void deleteRemote(remote); }} className="ml-auto text-slate-600 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button></div><p className="mt-1 text-[10px] text-slate-500">{remote.remoteType} · {remote.direction.replaceAll('_', ' ')}</p></button>)}</div><div className="mt-4 space-y-2 border-t border-white/8 pt-4"><input value={remoteForm.name} onChange={(event) => setRemoteForm({ ...remoteForm, name: event.target.value })} placeholder="Remote name" className="w-full rounded border border-white/10 bg-black/20 p-2 text-xs outline-none" /><div className="grid grid-cols-2 gap-2"><select value={remoteForm.remoteType} onChange={(event) => setRemoteForm({ ...remoteForm, remoteType: event.target.value as 'event' | 'function' })} className="rounded border border-white/10 bg-[#0b0f17] p-2 text-xs"><option value="event">RemoteEvent</option><option value="function">RemoteFunction</option></select><select value={remoteForm.direction} onChange={(event) => setRemoteForm({ ...remoteForm, direction: event.target.value as ProjectRemote['direction'] })} className="rounded border border-white/10 bg-[#0b0f17] p-2 text-xs"><option value="bidirectional">Bidirectional</option><option value="client_to_server">Client → Server</option><option value="server_to_client">Server → Client</option></select></div><textarea value={remoteForm.schema} onChange={(event) => setRemoteForm({ ...remoteForm, schema: event.target.value })} rows={5} spellCheck={false} className="w-full resize-y rounded border border-white/10 bg-black/20 p-2 font-mono text-[11px] outline-none" /><div className="flex gap-2"><button onClick={() => void saveRemote()} className="rounded bg-sky-500 px-3 py-2 text-xs font-bold">{remoteForm.id ? 'Update remote' : 'Add remote'}</button>{remoteForm.id && <button onClick={() => setRemoteForm({ name: '', remoteType: 'event', direction: 'bidirectional', schema: '{}', id: '' })} className="rounded border border-white/10 px-3 text-xs">Cancel</button>}</div><p className="text-[10px] leading-4 text-slate-500">Runtime remotes are isolated by module ID and validate payload size and schema server-side.</p></div></div>}
                {rightTab === 'versions' && <div className="p-3"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Immutable releases</p>{versions.length ? versions.map((version) => <div key={version.id} className="mb-2 rounded border border-white/8 p-3"><div className="flex items-center"><span className="font-mono text-sm text-sky-300">v{version.version}</span><span className="ml-auto text-[10px] text-slate-500">revision {version.project_revision}</span></div><p className="mt-2 truncate font-mono text-[9px] text-slate-600">sha256 {version.package_hash}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(version.created_at).toLocaleString()}</p></div>) : <p className="text-xs text-slate-500">No published Module Project v2 versions yet.</p>}</div>}
            </aside>
        </main>
        <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-white/8 bg-sky-600 px-3 text-[10px] font-semibold text-white"><span>Module Project v2</span><span>Runtime {project?.project.requiredRuntimeVersion || '2.2.0'}</span><span>{connected ? 'Studio linked' : 'Studio offline'}</span><span className="ml-auto">Ctrl+P Quick Open · Ctrl+Shift+P Commands</span></footer>

        {contextMenu && <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); }}><div style={{ left: contextMenu.x, top: contextMenu.y }} className="absolute w-44 rounded-md border border-white/10 bg-[#151d29] p-1 text-xs shadow-2xl"><button onClick={() => openProjectFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Open</button>{contextMenu.file.kind === 'folder' && <button onClick={() => { setSelectedFileId(contextMenu.file.id); setNewItem({ kind: 'shared_module', name: '' }); }} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">New child…</button>}<button onClick={() => void navigator.clipboard.writeText(contextMenu.file.path)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Copy path</button>{!['Server', 'Client', 'Shared', 'UI', 'module.json'].includes(contextMenu.file.path) && <><button onClick={() => renameFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Rename…</button><button onClick={() => duplicateFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Duplicate…</button><button onClick={() => deleteFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left text-red-300 hover:bg-red-400/10">Delete</button></>}</div></div>}
        {quickMode && <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-[12vh]" onMouseDown={() => setQuickMode(null)}><div onMouseDown={(event) => event.stopPropagation()} className="w-[min(620px,90vw)] overflow-hidden rounded-lg border border-white/12 bg-[#111722] shadow-2xl"><div className="flex items-center gap-3 border-b border-white/8 px-4"><Search className="h-4 w-4 text-slate-500" /><input autoFocus value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setQuickMode(null); }} placeholder={quickMode === 'files' ? 'Go to file…' : 'Run a command…'} className="h-12 flex-1 bg-transparent text-sm outline-none" /><kbd className="text-[10px] text-slate-600">ESC</kbd></div><div className="max-h-96 overflow-y-auto p-2">{quickMode === 'files' ? quickFiles.map((file) => <button key={file.id} onClick={() => { openProjectFile(file); setQuickMode(null); }} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.05]">{fileIcon(file)}<span>{file.name}</span><span className="ml-auto text-xs text-slate-600">{file.path}</span></button>) : commands.map((command) => <button key={command.label} onClick={() => { command.run(); setQuickMode(null); }} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.05]"><Settings2 className="h-4 w-4 text-sky-300" />{command.label}</button>)}</div></div></div>}
        {conflict && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><div className="w-[min(1000px,95vw)] rounded-lg border border-red-400/20 bg-[#111722] shadow-2xl"><div className="flex items-center gap-3 border-b border-white/8 p-4"><GitCompare className="h-5 w-5 text-amber-300" /><div><p className="font-semibold">Revision conflict: {conflict.title}</p><p className="text-xs text-slate-500">Compare both versions before choosing which source should continue.</p></div></div><div className="grid max-h-[60vh] grid-cols-2 divide-x divide-white/8"><div className="min-w-0"><p className="border-b border-white/8 px-4 py-2 text-xs font-bold text-sky-300">Browser version</p><pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-300">{conflict.browserSource}</pre></div><div className="min-w-0"><p className="border-b border-white/8 px-4 py-2 text-xs font-bold text-emerald-300">{conflict.kind === 'studio' ? 'Studio version' : 'Server version'}</p><pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-300">{conflict.serverSource}</pre></div></div><div className="flex justify-end gap-2 border-t border-white/8 p-4"><button onClick={() => { if (conflict.kind === 'project' && conflict.fileId) { const id = conflict.fileId; setDrafts((current) => ({ ...current, [id]: { value: conflict.serverSource, revision: Number(conflict.serverRevision), dirty: false, status: 'saved' } })); setProject((current) => current ? { ...current, files: current.files.map((file) => file.id === id ? { ...file, sourceCode: conflict.serverSource, revision: Number(conflict.serverRevision) } : file) } : current); } else setStudioScript((current) => current ? { ...current, source: conflict.serverSource, revision: String(conflict.serverRevision), dirty: false } : current); setConflict(null); }} className="rounded border border-white/10 px-3 py-2 text-xs">Use {conflict.kind === 'studio' ? 'Studio' : 'server'} version</button><button onClick={() => { if (conflict.kind === 'project' && conflict.fileId) { const id = conflict.fileId; setDrafts((current) => ({ ...current, [id]: { ...current[id], revision: Number(conflict.serverRevision), dirty: true, status: 'dirty' } })); } else { setStudioScript((current) => current ? { ...current, revision: String(conflict.serverRevision), dirty: true } : current); window.setTimeout(() => void saveStudioScript(String(conflict.serverRevision)), 0); } setConflict(null); }} className="rounded bg-sky-500 px-3 py-2 text-xs font-bold">Keep browser version</button></div></div></div>}
        {publishCheck && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><div className="w-[min(560px,94vw)] rounded-lg border border-white/10 bg-[#111722] shadow-2xl"><div className="flex items-center gap-3 border-b border-white/8 p-5">{publishCheck.ready ? <Check className="h-6 w-6 text-emerald-300" /> : <AlertTriangle className="h-6 w-6 text-red-300" />}<div><p className="font-semibold">{publishCheck.ready ? 'Ready to Publish' : 'Publishing is blocked'}</p><p className="text-xs text-slate-500">Validation never publishes automatically.</p></div></div><div className="space-y-2 p-5 text-sm"><p className="text-emerald-300">✓ {publishCheck.summary.scripts} scripts checked</p><p className="text-emerald-300">✓ {publishCheck.summary.remotes} remotes configured</p><p className="text-emerald-300">✓ {publishCheck.summary.uiRoots} UI roots bundled</p><p className={publishCheck.summary.errors ? 'text-red-300' : 'text-emerald-300'}>{publishCheck.summary.errors ? '✕' : '✓'} {publishCheck.summary.errors} errors</p><p className={publishCheck.summary.warnings ? 'text-amber-300' : 'text-emerald-300'}>⚠ {publishCheck.summary.warnings} warnings</p>{publishCheck.problems.slice(0, 6).map((problem, index) => <p key={index} className="border-t border-white/6 pt-2 text-xs text-slate-400">{problem.file ? `${problem.file}: ` : ''}{problem.message}</p>)}</div><div className="flex justify-end gap-2 border-t border-white/8 p-4"><button onClick={() => setPublishCheck(null)} className="rounded border border-white/10 px-4 py-2 text-xs">Cancel</button><button onClick={() => void publish()} disabled={!publishCheck.ready || publishing} className="rounded bg-sky-500 px-4 py-2 text-xs font-bold disabled:opacity-40">{publishing ? 'Publishing…' : `Publish v${String(project?.project.manifest.version || project?.module.version || '')}`}</button></div></div></div>}
        {createModuleOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><form onSubmit={(event) => { event.preventDefault(); void api<{ module: ModuleSummary }>('/api/dashboard/modules/ide', { method: 'POST', body: JSON.stringify({ name: createModuleName }) }).then(async ({ module }) => { await loadModules(); setCreateModuleOpen(false); setCreateModuleName(''); switchModule(module.id); }).catch((reason) => setError(reason.message)); }} className="w-[min(440px,94vw)] rounded-lg border border-white/10 bg-[#111722] p-5"><p className="font-semibold">Create Module Project</p><p className="mt-1 text-xs text-slate-500">A draft with Server, Client, Shared, UI, and module.json roots will be created.</p><input autoFocus value={createModuleName} onChange={(event) => setCreateModuleName(event.target.value)} placeholder="Module name" className="mt-4 w-full rounded border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-sky-400" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCreateModuleOpen(false)} className="rounded border border-white/10 px-4 py-2 text-xs">Cancel</button><button disabled={!createModuleName.trim()} className="rounded bg-sky-500 px-4 py-2 text-xs font-bold disabled:opacity-40">Create and open</button></div></form></div>}
    </div>;
}
