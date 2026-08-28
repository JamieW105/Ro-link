'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
    AlertTriangle, Boxes, Braces, Cable, Check, ChevronDown, ChevronRight, Code2,
    File, FileCode2, FileJson, Folder, FolderOpen, GitCompare, Play, PlugZap,
    ImagePlus, RefreshCw, Save, Search, Server, Settings2, Trash2, Unplug, X,
} from 'lucide-react';

import ModuleIdeEditor, { type IdeDiagnostic } from '@/components/dashboard/ModuleIdeEditor';

type ModuleFileKind = 'folder' | 'server_script' | 'client_script' | 'shared_module' | 'ui' | 'manifest';
type ModuleSummary = { id: string; slug: string; name: string; description: string; thumbnail_url?: string; thumbnail_urls?: unknown; version: string; status: string; updated_at: string; published_at?: string | null };
type ProjectFile = { id: string; path: string; name: string; kind: ModuleFileKind; sourceCode: string | null; uiTree: unknown; revision: number; createdAt: string; updatedAt: string };
type ProjectProblem = { severity: 'error' | 'warning'; file?: string; line?: number; column?: number; message: string; code: string };
type ProjectResponse = {
    module: { id: string; slug: string; name: string; description: string; thumbnailUrl: string; thumbnailUrls: string[]; version: string; status: string; createdAt: string; updatedAt: string; publishedAt: string | null };
    project: { formatVersion: number; revision: number; publishedRevision: number | null; requiredRuntimeVersion: string; manifest: Record<string, unknown>; createdAt: string; updatedAt: string };
    files: ProjectFile[];
};
type Draft = { value: string; revision: number; dirty: boolean; status: 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict' };
type StudioNode = { id: string; parentId?: string; name: string; className: string; path: string; hasChildren?: boolean; isScript?: boolean; children?: StudioNode[] };
type StudioScript = { instanceId: string; path: string; name: string; className: string; source: string; revision: string; dirty: boolean; saving?: boolean };
type SyncLog = { id: string; time: string; message: string; channel: 'output' | 'studio'; tone?: 'error' | 'success' | 'normal' };
type BridgeEvent = { id: number; type: string; requestId?: string; revision?: string; payload: Record<string, unknown> };
type PublishCheck = { ready: boolean; problems: ProjectProblem[]; summary: { scripts: number; uiRoots: number; warnings: number; errors: number } };
type Conflict = { kind: 'project' | 'studio'; title: string; fileId?: string; browserSource: string; serverSource: string; serverRevision: number | string };
type ModuleThumbnailDraft = { id: string; url: string; file?: File };

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
    const saveOperationsRef = useRef<Map<string, Promise<boolean>>>(new Map());
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['Server', 'Client', 'Shared', 'UI']));
    const [selectedFileId, setSelectedFileId] = useState('');
    const [fileSearch, setFileSearch] = useState('');
    const [newItem, setNewItem] = useState<{ kind: ModuleFileKind; name: string } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: ProjectFile } | null>(null);
    const [diagnostics, setDiagnostics] = useState<Record<string, IdeDiagnostic[]>>({});
    const [serverProblems, setServerProblems] = useState<ProjectProblem[]>([]);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [bottomTab, setBottomTab] = useState<'problems' | 'output' | 'studio'>('problems');
    const [compactLayout, setCompactLayout] = useState(false);
    const [leftWidth, setLeftWidth] = useState(286);
    const [bottomHeight, setBottomHeight] = useState(190);
    const [error, setError] = useState('');
    const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
    const [connected, setConnected] = useState(false);
    const [studioRoots, setStudioRoots] = useState<StudioNode[]>([]);
    const [studioScript, setStudioScript] = useState<StudioScript | null>(null);
    const [conflict, setConflict] = useState<Conflict | null>(null);
    const [publishCheck, setPublishCheck] = useState<PublishCheck | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [quickMode, setQuickMode] = useState<'files' | 'commands' | null>(null);
    const [quickQuery, setQuickQuery] = useState('');
    const [moduleInfoOpen, setModuleInfoOpen] = useState(false);
    const [moduleInfo, setModuleInfo] = useState({ title: '', description: '' });
    const [moduleThumbnails, setModuleThumbnails] = useState<ModuleThumbnailDraft[]>([]);
    const [moduleThumbnailsDirty, setModuleThumbnailsDirty] = useState(false);
    const [moduleInfoError, setModuleInfoError] = useState('');
    const moduleThumbnailInputRef = useRef<HTMLInputElement | null>(null);
    const moduleThumbnailBlobUrlsRef = useRef<Set<string>>(new Set());
    const [moduleInfoSaving, setModuleInfoSaving] = useState(false);
    const [moduleName, setModuleNameState] = useState('');
    const [moduleNameStatus, setModuleNameStatus] = useState<'saved' | 'dirty' | 'saving' | 'failed'>('saved');
    const moduleNameRef = useRef('');
    const moduleNameSaveRef = useRef<Promise<boolean> | null>(null);
    const cursorRef = useRef(0);
    const pendingOpenRef = useRef<Map<string, StudioNode>>(new Map());
    const activeTabRef = useRef(activeTab);
    const tabsRef = useRef(tabs);
    const studioScriptRef = useRef(studioScript);

    const setProject = useCallback((next: ProjectResponse | null | ((current: ProjectResponse | null) => ProjectResponse | null)) => {
        const value = typeof next === 'function' ? next(projectRef.current) : next;
        projectRef.current = value;
        setProjectState(value);
    }, []);
    const setDrafts = useCallback((next: Record<string, Draft> | ((current: Record<string, Draft>) => Record<string, Draft>)) => {
        const value = typeof next === 'function' ? next(draftsRef.current) : next;
        draftsRef.current = value;
        setDraftsState(value);
    }, []);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
    useEffect(() => { tabsRef.current = tabs; }, [tabs]);
    useEffect(() => { studioScriptRef.current = studioScript; }, [studioScript]);
    useEffect(() => () => {
        moduleThumbnailBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        moduleThumbnailBlobUrlsRef.current.clear();
    }, []);

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
            moduleNameRef.current = result.module.name;
            setModuleNameState(result.module.name);
            setModuleNameStatus('saved');
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
        if (typeof preferences.bottomHeight === 'number') setBottomHeight(Math.min(360, Math.max(120, preferences.bottomHeight)));
        void loadModules().then((rows) => {
            const query = new URLSearchParams(window.location.search);
            const queryId = query.get('module');
            const savedId = localStorage.getItem('rolink-module-ide-last-module');
            setModuleId([queryId, savedId].find((id) => id && rows.some((row) => row.id === id)) || rows[0]?.id || '');
        }).catch((reason) => setError(reason.message));
    }, [loadModules]);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 980px)');
        const update = () => setCompactLayout(media.matches);
        update(); media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        localStorage.setItem('rolink-module-ide-preferences', JSON.stringify({ leftWidth, bottomHeight }));
    }, [bottomHeight, leftWidth]);
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

    const saveProjectFileOnce = useCallback(async (fileId: string) => {
        const currentProject = projectRef.current;
        const file = currentProject?.files.find((item) => item.id === fileId);
        const draft = draftsRef.current[fileId];
        if (!currentProject || !file || !draft?.dirty) return true;
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

    const saveProjectFile = useCallback((fileId: string) => {
        const activeSave = saveOperationsRef.current.get(fileId);
        if (activeSave) return activeSave;

        const operation = (async () => {
            // Keep one request per file in flight. If the user types while that
            // request is running, save the newer value with the revision returned
            // by the first request instead of sending two stale revisions at once.
            while (draftsRef.current[fileId]?.dirty) {
                if (!await saveProjectFileOnce(fileId)) return false;
            }
            return true;
        })();

        saveOperationsRef.current.set(fileId, operation);
        void operation.finally(() => {
            if (saveOperationsRef.current.get(fileId) === operation) saveOperationsRef.current.delete(fileId);
        });
        return operation;
    }, [saveProjectFileOnce]);

    const saveAll = useCallback(async () => {
        for (const [id, draft] of Object.entries(draftsRef.current)) if (draft.dirty && !await saveProjectFile(id)) return false;
        return true;
    }, [saveProjectFile]);

    const saveModuleName = useCallback(() => {
        if (moduleNameSaveRef.current) return moduleNameSaveRef.current;

        const operation = (async () => {
            while (projectRef.current && moduleNameRef.current.trim() !== projectRef.current.module.name) {
                const title = moduleNameRef.current.trim();
                if (!title) return false;
                setModuleNameStatus('saving');
                if (!await saveAll()) {
                    setModuleNameStatus('failed');
                    return false;
                }

                const currentProject = projectRef.current;
                if (!currentProject) return false;
                try {
                    const result = await api<{ manifest: Record<string, unknown>; projectRevision: number }>(`/api/dashboard/modules/ide/${moduleId}/manifest`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            manifest: { ...currentProject.project.manifest, name: title },
                            expectedRevision: currentProject.project.revision,
                        }),
                    });
                    const manifestFile = currentProject.files.find((file) => file.kind === 'manifest');
                    const manifestSource = JSON.stringify(result.manifest, null, 2) + '\n';
                    setProject((current) => current ? {
                        ...current,
                        module: { ...current.module, name: String(result.manifest.name) },
                        project: { ...current.project, manifest: result.manifest, revision: result.projectRevision },
                        files: current.files.map((file) => file.id === manifestFile?.id ? { ...file, sourceCode: manifestSource, revision: file.revision + 1, updatedAt: new Date().toISOString() } : file),
                    } : current);
                    if (manifestFile) setDrafts((current) => ({ ...current, [manifestFile.id]: { value: manifestSource, revision: manifestFile.revision + 1, dirty: false, status: 'saved' } }));
                    setModules((current) => current.map((item) => item.id === moduleId ? { ...item, name: String(result.manifest.name) } : item));
                    setModuleNameStatus(moduleNameRef.current.trim() === title ? 'saved' : 'dirty');
                    log(`Module renamed to ${title}.`, 'output', 'success');
                } catch (reason) {
                    setModuleNameStatus('failed');
                    setError(reason instanceof Error ? reason.message : 'Module name failed to save.');
                    return false;
                }
            }
            return true;
        })();

        moduleNameSaveRef.current = operation;
        void operation.finally(() => {
            if (moduleNameSaveRef.current === operation) moduleNameSaveRef.current = null;
        });
        return operation;
    }, [log, moduleId, saveAll, setDrafts, setProject]);

    useEffect(() => {
        if (!project || !moduleName.trim() || moduleName.trim() === project.module.name) return;
        const timer = window.setTimeout(() => { void saveModuleName(); }, 800);
        return () => window.clearTimeout(timer);
    }, [moduleName, project, saveModuleName]);

    const openModuleInfo = useCallback(() => {
        const currentModule = projectRef.current?.module;
        if (!currentModule) return;
        setModuleInfo({ title: currentModule.name, description: currentModule.description });
        const thumbnailUrls = currentModule.thumbnailUrls?.length ? currentModule.thumbnailUrls : currentModule.thumbnailUrl ? [currentModule.thumbnailUrl] : [];
        setModuleThumbnails(thumbnailUrls.map((url) => ({ id: url, url })));
        setModuleThumbnailsDirty(false);
        setModuleInfoError('');
        setModuleInfoOpen(true);
    }, []);

    const chooseModuleThumbnails = useCallback((files: File[]) => {
        if (!files.length) return;
        if (moduleThumbnails.length + files.length > 5) {
            setModuleInfoError('Modules can have up to 5 thumbnails.');
            return;
        }
        if (files.some((file) => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
            setModuleInfoError('Use a PNG, JPEG, or WebP image.');
            return;
        }
        if (files.some((file) => file.size > 5 * 1024 * 1024)) {
            setModuleInfoError('Each thumbnail must be no larger than 5 MB.');
            return;
        }
        setModuleInfoError('');
        const additions = files.map((file) => {
            const url = URL.createObjectURL(file);
            moduleThumbnailBlobUrlsRef.current.add(url);
            return { id: crypto.randomUUID(), url, file };
        });
        setModuleThumbnails((current) => [...current, ...additions]);
        setModuleThumbnailsDirty(true);
    }, [moduleThumbnails.length]);

    const saveModuleInfo = useCallback(async () => {
        const title = moduleInfo.title.trim();
        if (!title || moduleInfoSaving) return;
        setModuleInfoSaving(true);
        setModuleInfoError('');
        try {
            if (!await saveAll()) return;
            const currentProject = projectRef.current;
            if (!currentProject) return;
            const result = await api<{ manifest: Record<string, unknown>; projectRevision: number }>(`/api/dashboard/modules/ide/${moduleId}/manifest`, {
                method: 'PATCH',
                body: JSON.stringify({
                    manifest: { ...currentProject.project.manifest, name: title, description: moduleInfo.description },
                    expectedRevision: currentProject.project.revision,
                }),
            });
            const manifestFile = currentProject.files.find((file) => file.kind === 'manifest');
            const manifestSource = JSON.stringify(result.manifest, null, 2) + '\n';
            setProject((current) => current ? {
                ...current,
                module: { ...current.module, name: String(result.manifest.name), description: String(result.manifest.description || '') },
                project: { ...current.project, manifest: result.manifest, revision: result.projectRevision },
                files: current.files.map((file) => file.id === manifestFile?.id ? { ...file, sourceCode: manifestSource, revision: file.revision + 1, updatedAt: new Date().toISOString() } : file),
            } : current);
            if (manifestFile) setDrafts((current) => ({ ...current, [manifestFile.id]: { value: manifestSource, revision: manifestFile.revision + 1, dirty: false, status: 'saved' } }));

            let thumbnailUrl = currentProject.module.thumbnailUrl || '';
            let thumbnailUrls = currentProject.module.thumbnailUrls || (thumbnailUrl ? [thumbnailUrl] : []);
            if (moduleThumbnailsDirty) {
                const thumbnailBody = new FormData();
                thumbnailBody.set('retainedThumbnailUrls', JSON.stringify(moduleThumbnails.filter((thumbnail) => !thumbnail.file).map((thumbnail) => thumbnail.url)));
                moduleThumbnails.forEach((thumbnail) => { if (thumbnail.file) thumbnailBody.append('thumbnails', thumbnail.file); });
                const thumbnailResponse = await fetch(`/api/dashboard/modules/ide/${moduleId}/thumbnail`, { method: 'POST', body: thumbnailBody });
                const thumbnailPayload = await thumbnailResponse.json().catch(() => ({})) as Record<string, unknown>;
                if (!thumbnailResponse.ok) throw new Error(String(thumbnailPayload.error || 'Thumbnail upload failed.'));
                thumbnailUrl = String(thumbnailPayload.thumbnailUrl || '');
                thumbnailUrls = Array.isArray(thumbnailPayload.thumbnailUrls) ? thumbnailPayload.thumbnailUrls.map(String) : thumbnailUrl ? [thumbnailUrl] : [];
            }
            setProject((current) => current ? { ...current, module: { ...current.module, thumbnailUrl, thumbnailUrls } } : current);
            void loadModules().catch(() => undefined);
            setModuleInfoOpen(false);
            log('Module info saved.', 'output', 'success');
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : 'Module info failed to save.';
            setModuleInfoError(message);
            setError(message);
        } finally {
            setModuleInfoSaving(false);
        }
    }, [loadModules, log, moduleId, moduleInfo, moduleInfoSaving, moduleThumbnails, moduleThumbnailsDirty, saveAll, setDrafts, setProject]);

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

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            if (event.key.toLowerCase() === 'p') { event.preventDefault(); setQuickMode(event.shiftKey ? 'commands' : 'files'); setQuickQuery(''); }
            if (event.key.toLowerCase() === 's') { event.preventDefault(); if (activeFile) void saveProjectFile(activeFile.id); else if (studioScript) void saveStudioScript(); }
        };
        window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    }, [activeFile, saveProjectFile, saveStudioScript, studioScript]);

    const beginResize = (kind: 'left' | 'bottom', event: ReactPointerEvent) => {
        event.preventDefault(); const startX = event.clientX; const startY = event.clientY; const initial = kind === 'left' ? leftWidth : bottomHeight;
        const move = (pointer: PointerEvent) => { if (kind === 'left') setLeftWidth(Math.min(440, Math.max(210, initial + pointer.clientX - startX))); else setBottomHeight(Math.min(380, Math.max(110, initial - pointer.clientY + startY))); };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    };

    const allProblems = useMemo(() => [...Object.values(diagnostics).flat(), ...serverProblems], [diagnostics, serverProblems]);
    const saveLabel = activeDraft?.status === 'saving' ? 'Saving…' : activeDraft?.status === 'failed' ? 'Save failed' : activeDraft?.status === 'conflict' ? 'Conflict' : hasDirty ? 'Unsaved' : 'Saved';
    const expiresIn = pairing ? Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - Date.now()) / 60000)) : 0;
    const quickFiles = project?.files.filter((file) => file.kind !== 'folder' && file.path.toLowerCase().includes(quickQuery.toLowerCase())).slice(0, 20) || [];
    const commands = [
        { label: 'Save all files', run: () => void saveAll() }, { label: 'Publish module', run: () => void preparePublish() },
        { label: 'Edit module info', run: openModuleInfo },
        { label: 'Create server script', run: () => setNewItem({ kind: 'server_script', name: '' }) }, { label: 'Create client script', run: () => setNewItem({ kind: 'client_script', name: '' }) },
        { label: 'Connect Roblox Studio', run: () => void api<{ code: string; expiresAt: string }>(`/api/dashboard/modules/ide/${moduleId}/studio/pair`, { method: 'POST' }).then(setPairing) },
    ].filter((command) => command.label.toLowerCase().includes(quickQuery.toLowerCase()));

    return <div className="rl-public-page rl-module-ide relative flex h-screen min-h-[640px] flex-col overflow-hidden text-slate-100">
        <div className="rl-module-ide-mobile-gate fixed inset-0 z-[100] hidden items-center justify-center p-8 text-center max-[560px]:flex"><div><Braces className="mx-auto h-10 w-10 text-sky-300" /><p className="mt-4 font-bold">Ro-Link Module IDE is best used on a desktop display.</p><Link href="/dashboard/creator/modules" className="rl-button mt-4">Return to Modules</Link></div></div>
        <header className="rl-module-ide-toolbar flex h-14 shrink-0 items-center gap-3 px-3">
            <Link href="/dashboard/creator/modules" className="rl-brand" aria-label="Back to Ro-Link modules">
                <span className="rl-brand-mark"><Image src="/Media/Ro-LinkIcon.png" alt="" width={25} height={25} /></span>
                <span>Ro-Link</span>
            </Link>
            <label className="relative min-w-0" title="Module name saves automatically">
                <span className="sr-only">Module name</span>
                <input
                    aria-label="Module name"
                    maxLength={120}
                    disabled={!project}
                    value={moduleName}
                    onChange={(event) => {
                        moduleNameRef.current = event.target.value;
                        setModuleNameState(event.target.value);
                        setModuleNameStatus(event.target.value.trim() === projectRef.current?.module.name ? 'saved' : 'dirty');
                    }}
                    onBlur={() => { if (moduleName.trim()) void saveModuleName(); }}
                    className="rl-module-ide-select h-9 w-44 min-w-0 max-w-64 px-3 pr-8 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-600 disabled:opacity-50 max-[700px]:w-32"
                    placeholder="Module name"
                />
                {moduleNameStatus === 'saving'
                    ? <RefreshCw aria-label="Saving module name" className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-sky-300" />
                    : moduleNameStatus === 'saved' && project
                        ? <Check aria-label="Module name saved" className="absolute right-2.5 top-2.5 h-4 w-4 text-emerald-300" />
                        : <span aria-label={moduleNameStatus === 'failed' ? 'Module name save failed' : 'Module name has unsaved changes'} className={`absolute right-3 top-3 h-2 w-2 rounded-full ${moduleNameStatus === 'failed' ? 'bg-red-400' : 'bg-amber-300'}`} />}
            </label>
            <button type="button" onClick={openModuleInfo} disabled={!project} className="rl-module-ide-icon-button p-2" aria-label="Edit module info" title="Edit module info"><Settings2 className="h-4 w-4" /></button>
            <span className="rl-module-ide-status px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] max-[980px]:hidden">{selectedModule?.status || 'No module'}</span>
            {project?.project.publishedRevision != null && project.project.publishedRevision !== project.project.revision && <span className="hidden text-[10px] font-semibold text-amber-300 lg:inline">Unpublished changes</span>}
            <div className="ml-auto flex items-center gap-2">
                <span title={connected ? 'Paired Studio session is active' : 'Studio is not connected'} className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold lg:flex ${connected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 text-slate-400'}`}>{connected ? <PlugZap className="h-3.5 w-3.5" /> : <Unplug className="h-3.5 w-3.5" />} Studio {connected ? 'Connected' : 'Disconnected'}</span>
                <button type="button" disabled={!moduleId} onClick={() => api<{ code: string; expiresAt: string }>(`/api/dashboard/modules/ide/${moduleId}/studio/pair`, { method: 'POST' }).then((value) => { setPairing(value); log('Created a one-time Studio pairing code.', 'studio'); }).catch((reason) => setError(reason.message))} className="rl-button">Connect Studio</button>
                <button type="button" onClick={() => void saveAll()} disabled={!hasDirty} className="rl-button"><Save className="h-3.5 w-3.5" /><span className="max-[980px]:hidden">{saveLabel}</span></button>
                <button type="button" onClick={() => void preparePublish()} disabled={!project || publishing} className="rl-button rl-button-primary">Publish</button>
            </div>
        </header>
        {pairing && !connected && <div className="flex shrink-0 items-center justify-center gap-4 border-b border-sky-400/15 bg-sky-400/[0.06] px-4 py-2 text-sm"><Cable className="h-4 w-4 text-sky-300" /><span>Enter this one-time code in the standalone Studio plugin:</span><code className="rounded-md bg-black/35 px-3 py-1 font-mono text-lg font-bold tracking-[0.25em] text-white">{pairing.code}</code><span className="text-xs text-slate-400">expires in about {expiresIn} min</span><button onClick={() => setPairing(null)} aria-label="Dismiss pairing code"><X className="h-4 w-4" /></button></div>}
        {error && <button type="button" onClick={() => setError('')} className="flex shrink-0 items-center gap-2 border-b border-red-400/15 bg-red-400/[0.06] px-4 py-2 text-left text-xs text-red-200"><AlertTriangle className="h-4 w-4" />{error}<span className="ml-auto">Dismiss</span></button>}

        <main className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `${compactLayout ? Math.min(leftWidth, 230) : leftWidth}px 4px minmax(0,1fr)` }}>
            <aside className="rl-module-ide-sidebar min-h-0 overflow-y-auto">
                <div className="rl-module-ide-sidebar-head sticky top-0 z-10 p-2">
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
                </div>
                <div className="border-t border-white/8 p-2"><div className="mb-2 flex items-center justify-between px-1"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Studio Explorer</span><button disabled={!connected} onClick={() => void sendEvents([{ type: 'tree.snapshot', payload: {} }])} className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30"><RefreshCw className="h-3.5 w-3.5" /></button></div>{studioRoots.length ? studioRoots.map((root) => <StudioTreeNode key={root.id} node={root} onOpen={openStudioScript} onExpand={expandStudioNode} />) : <p className="rounded border border-dashed border-white/10 p-3 text-xs leading-5 text-slate-500">Connect Roblox Studio to browse your live game hierarchy.</p>}</div>
            </aside>
            <div onPointerDown={(event) => beginResize('left', event)} className="cursor-col-resize bg-white/[0.04] hover:bg-sky-400/50" />

            <section className="rl-module-ide-workspace grid min-h-0" style={{ gridTemplateRows: `minmax(0,1fr) 4px ${bottomHeight}px` }}>
                <div className="rl-module-ide-editor flex min-h-0 flex-col">
                    <div className="rl-module-ide-tabs flex h-10 shrink-0 overflow-x-auto">
                        {tabs.map((key) => { const file = key.startsWith('project:') ? project?.files.find((item) => item.id === key.slice(8)) : null; const isStudio = key.startsWith('studio:'); const label = isStudio ? studioScript?.name || 'Studio Script' : file?.name || 'Deleted file'; const dirty = isStudio ? studioScript?.dirty : file ? drafts[file.id]?.dirty : false; return <button key={key} onClick={() => setActiveTab(key)} className={`group flex min-w-28 max-w-52 items-center gap-2 border-r border-white/8 px-3 text-xs ${activeTab === key ? 'border-t-2 border-t-sky-400 bg-[#090d14] text-white' : 'text-slate-500 hover:text-slate-200'}`}>{isStudio ? <PlugZap className="h-3 w-3 text-emerald-300" /> : file ? fileIcon(file) : <File className="h-3 w-3" />}<span className="truncate">{label}</span>{dirty ? <span className="ml-auto h-2 w-2 rounded-full bg-amber-300" /> : <X onClick={(event) => { event.stopPropagation(); closeTab(key); }} className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100" />}</button>; })}
                        {!tabs.length && <span className="flex items-center px-4 text-xs text-slate-600">No file open</span>}
                    </div>
                    {activeFile && activeDraft ? <>
                        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-white/6 px-3 text-[10px] text-slate-500">{activeFile.path.split('/').map((part, index) => <span key={`${part}-${index}`} className="flex items-center gap-1">{index > 0 && <ChevronRight className="h-3 w-3" />}{part}</span>)}<span className="ml-auto capitalize">{activeDraft.status}</span></div>
                        <div className="min-h-0 flex-1"><ModuleIdeEditor value={activeDraft.value} path={activeFile.path} language={activeFile.kind === 'manifest' ? 'json' : 'luau'} projectPaths={project?.files.map((file) => file.path) || []} onChange={(value) => setDrafts((current) => ({ ...current, [activeFile.id]: { ...current[activeFile.id], value, dirty: value !== activeFile.sourceCode, status: value !== activeFile.sourceCode ? 'dirty' : 'saved' } }))} onSave={() => void saveProjectFile(activeFile.id)} onDiagnostics={(items) => setDiagnostics((current) => ({ ...current, [activeFile.path]: items }))} /></div>
                    </> : activeFile?.kind === 'ui' ? <div className="grid min-h-0 flex-1 grid-cols-2"><div className="overflow-auto border-r border-white/8 p-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">UI hierarchy preview</p><UiTree value={activeFile.uiTree} /></div><pre className="overflow-auto p-4 text-[11px] leading-5 text-slate-400">{JSON.stringify(activeFile.uiTree, null, 2)}</pre></div>
                    : activeTab.startsWith('studio:') && studioScript ? <><div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/6 px-3 text-[10px] text-slate-500"><span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-bold text-emerald-300">LIVE STUDIO</span><span className="truncate">{studioScript.path}</span><button onClick={() => void saveStudioScript()} disabled={!studioScript.dirty || studioScript.saving} className="ml-auto flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-slate-300 disabled:opacity-30"><Save className="h-3 w-3" />{studioScript.saving ? 'Sending…' : 'Save to Studio'}</button></div><div className="min-h-0 flex-1"><ModuleIdeEditor value={studioScript.source} path={`Studio/${studioScript.path}`} projectPaths={project?.files.map((file) => file.path) || []} onChange={(value) => setStudioScript({ ...studioScript, source: value, dirty: true })} onSave={() => void saveStudioScript()} onDiagnostics={(items) => setDiagnostics((current) => ({ ...current, [`Studio/${studioScript.path}`]: items }))} /></div></>
                    : <div className="flex flex-1 items-center justify-center"><div className="max-w-md text-center"><Braces className="mx-auto h-10 w-10 text-slate-700" /><p className="mt-4 text-sm font-semibold text-slate-300">{project ? project.module.name : 'Open a module to start developing.'}</p><p className="mt-2 text-xs leading-5 text-slate-500">Open a project script, import UI from Studio, or press Ctrl/Cmd + P to navigate.</p></div></div>}
                </div>
                <div onPointerDown={(event) => beginResize('bottom', event)} className="cursor-row-resize bg-white/[0.04] hover:bg-sky-400/50" />
                <div className="min-h-0 bg-[#0e141e]"><div className="flex h-9 items-center gap-1 border-b border-white/8 px-2">{(['problems', 'output', 'studio'] as const).map((tab) => <button key={tab} onClick={() => setBottomTab(tab)} className={`h-full border-b-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] ${bottomTab === tab ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-500'}`}>{tab === 'problems' ? `Problems (${allProblems.length})` : tab === 'studio' ? 'Studio Sync' : 'Output'}</button>)}<span className="ml-auto text-[10px] text-slate-600">Project revision {project?.project.revision || '—'}</span></div><div className="h-[calc(100%-2.25rem)] overflow-y-auto p-2 font-mono text-[11px] leading-5">{bottomTab === 'problems' ? (allProblems.length ? allProblems.map((problem, index) => <button key={`${problem.code}-${index}`} onClick={() => { const file = project?.files.find((item) => item.path === problem.file); if (file) openProjectFile(file); }} className={`flex w-full gap-3 rounded px-2 py-1 text-left hover:bg-white/[0.04] ${problem.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}><span>{problem.severity === 'error' ? 'error' : 'warn'}</span><span className="min-w-32 text-slate-500">{problem.file || 'project'}{problem.line ? `:${problem.line}:${problem.column || 1}` : ''}</span><span>{problem.message}</span></button>) : <p className="p-2 text-slate-600">No problems detected in opened files.</p>) : (logs.filter((item) => bottomTab === 'studio' ? item.channel === 'studio' : item.channel === 'output').length ? logs.filter((item) => bottomTab === 'studio' ? item.channel === 'studio' : item.channel === 'output').map((item) => <div key={item.id} className={item.tone === 'error' ? 'text-red-300' : item.tone === 'success' ? 'text-emerald-300' : 'text-slate-400'}><span className="mr-3 text-slate-600">{item.time}</span>{item.message}</div>) : <p className="p-2 text-slate-600">No {bottomTab === 'studio' ? 'Studio sync' : 'output'} events yet.</p>)}</div></div>
            </section>

        </main>
        <footer className="rl-module-ide-footer flex h-7 shrink-0 items-center gap-4 px-3 text-[10px] font-semibold"><span>Module Project v2</span><span>Runtime {project?.project.requiredRuntimeVersion || '2.2.0'}</span><span>{connected ? 'Studio linked' : 'Studio offline'}</span><span className="ml-auto">Ctrl+P Quick Open · Ctrl+Shift+P Commands</span></footer>

        {contextMenu && <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); }}><div style={{ left: contextMenu.x, top: contextMenu.y }} className="absolute w-44 rounded-md border border-white/10 bg-[#151d29] p-1 text-xs shadow-2xl"><button onClick={() => openProjectFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Open</button>{contextMenu.file.kind === 'folder' && <button onClick={() => { setSelectedFileId(contextMenu.file.id); setNewItem({ kind: 'shared_module', name: '' }); }} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">New child…</button>}<button onClick={() => void navigator.clipboard.writeText(contextMenu.file.path)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Copy path</button>{!['Server', 'Client', 'Shared', 'UI', 'module.json'].includes(contextMenu.file.path) && <><button onClick={() => renameFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Rename…</button><button onClick={() => duplicateFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left hover:bg-white/8">Duplicate…</button><button onClick={() => deleteFile(contextMenu.file)} className="w-full rounded px-2 py-1.5 text-left text-red-300 hover:bg-red-400/10">Delete</button></>}</div></div>}
        {quickMode && <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-[12vh]" onMouseDown={() => setQuickMode(null)}><div onMouseDown={(event) => event.stopPropagation()} className="w-[min(620px,90vw)] overflow-hidden rounded-lg border border-white/12 bg-[#111722] shadow-2xl"><div className="flex items-center gap-3 border-b border-white/8 px-4"><Search className="h-4 w-4 text-slate-500" /><input autoFocus value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setQuickMode(null); }} placeholder={quickMode === 'files' ? 'Go to file…' : 'Run a command…'} className="h-12 flex-1 bg-transparent text-sm outline-none" /><kbd className="text-[10px] text-slate-600">ESC</kbd></div><div className="max-h-96 overflow-y-auto p-2">{quickMode === 'files' ? quickFiles.map((file) => <button key={file.id} onClick={() => { openProjectFile(file); setQuickMode(null); }} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.05]">{fileIcon(file)}<span>{file.name}</span><span className="ml-auto text-xs text-slate-600">{file.path}</span></button>) : commands.map((command) => <button key={command.label} onClick={() => { command.run(); setQuickMode(null); }} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.05]"><Settings2 className="h-4 w-4 text-sky-300" />{command.label}</button>)}</div></div></div>}
        {conflict && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><div className="w-[min(1000px,95vw)] rounded-lg border border-red-400/20 bg-[#111722] shadow-2xl"><div className="flex items-center gap-3 border-b border-white/8 p-4"><GitCompare className="h-5 w-5 text-amber-300" /><div><p className="font-semibold">Revision conflict: {conflict.title}</p><p className="text-xs text-slate-500">Compare both versions before choosing which source should continue.</p></div></div><div className="grid max-h-[60vh] grid-cols-2 divide-x divide-white/8"><div className="min-w-0"><p className="border-b border-white/8 px-4 py-2 text-xs font-bold text-sky-300">Browser version</p><pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-300">{conflict.browserSource}</pre></div><div className="min-w-0"><p className="border-b border-white/8 px-4 py-2 text-xs font-bold text-emerald-300">{conflict.kind === 'studio' ? 'Studio version' : 'Server version'}</p><pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-300">{conflict.serverSource}</pre></div></div><div className="flex justify-end gap-2 border-t border-white/8 p-4"><button onClick={() => { if (conflict.kind === 'project' && conflict.fileId) { const id = conflict.fileId; setDrafts((current) => ({ ...current, [id]: { value: conflict.serverSource, revision: Number(conflict.serverRevision), dirty: false, status: 'saved' } })); setProject((current) => current ? { ...current, files: current.files.map((file) => file.id === id ? { ...file, sourceCode: conflict.serverSource, revision: Number(conflict.serverRevision) } : file) } : current); } else setStudioScript((current) => current ? { ...current, source: conflict.serverSource, revision: String(conflict.serverRevision), dirty: false } : current); setConflict(null); }} className="rounded border border-white/10 px-3 py-2 text-xs">Use {conflict.kind === 'studio' ? 'Studio' : 'server'} version</button><button onClick={() => { if (conflict.kind === 'project' && conflict.fileId) { const id = conflict.fileId; setDrafts((current) => ({ ...current, [id]: { ...current[id], revision: Number(conflict.serverRevision), dirty: true, status: 'dirty' } })); } else { setStudioScript((current) => current ? { ...current, revision: String(conflict.serverRevision), dirty: true } : current); window.setTimeout(() => void saveStudioScript(String(conflict.serverRevision)), 0); } setConflict(null); }} className="rounded bg-sky-500 px-3 py-2 text-xs font-bold">Keep browser version</button></div></div></div>}
        {publishCheck && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><div className="w-[min(560px,94vw)] rounded-lg border border-white/10 bg-[#111722] shadow-2xl"><div className="flex items-center gap-3 border-b border-white/8 p-5">{publishCheck.ready ? <Check className="h-6 w-6 text-emerald-300" /> : <AlertTriangle className="h-6 w-6 text-red-300" />}<div><p className="font-semibold">{publishCheck.ready ? 'Ready to Publish' : 'Publishing is blocked'}</p><p className="text-xs text-slate-500">Validation never publishes automatically.</p></div></div><div className="space-y-2 p-5 text-sm"><p className="text-emerald-300">✓ {publishCheck.summary.scripts} scripts checked</p><p className="text-emerald-300">✓ Module API transport available</p><p className="text-emerald-300">✓ {publishCheck.summary.uiRoots} UI roots bundled</p><p className={publishCheck.summary.errors ? 'text-red-300' : 'text-emerald-300'}>{publishCheck.summary.errors ? '✕' : '✓'} {publishCheck.summary.errors} errors</p><p className={publishCheck.summary.warnings ? 'text-amber-300' : 'text-emerald-300'}>⚠ {publishCheck.summary.warnings} warnings</p>{publishCheck.problems.slice(0, 6).map((problem, index) => <p key={index} className="border-t border-white/6 pt-2 text-xs text-slate-400">{problem.file ? `${problem.file}: ` : ''}{problem.message}</p>)}</div><div className="flex justify-end gap-2 border-t border-white/8 p-4"><button onClick={() => setPublishCheck(null)} className="rounded border border-white/10 px-4 py-2 text-xs">Cancel</button><button onClick={() => void publish()} disabled={!publishCheck.ready || publishing} className="rounded bg-sky-500 px-4 py-2 text-xs font-bold disabled:opacity-40">{publishing ? 'Publishing…' : `Publish v${String(project?.project.manifest.version || project?.module.version || '')}`}</button></div></div></div>}
        {moduleInfoOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6" onMouseDown={() => { if (!moduleInfoSaving) setModuleInfoOpen(false); }}>
                <form onSubmit={(event) => { event.preventDefault(); void saveModuleInfo(); }} onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[94vh] w-[min(580px,94vw)] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#111722] shadow-2xl">
                    <div className="flex shrink-0 items-center gap-3 border-b border-white/8 p-5"><Settings2 className="h-5 w-5 text-sky-300" /><div><p className="font-semibold">Edit Module Info</p><p className="text-xs text-slate-500">Update the details shown for this module.</p></div></div>
                    <div className="space-y-4 overflow-y-auto p-5">
                        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Title</span><input autoFocus required maxLength={120} value={moduleInfo.title} onChange={(event) => setModuleInfo((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-sky-400/60" /></label>
                        <div>
                            <div className="mb-1.5 flex items-end justify-between gap-4"><span className="text-xs font-semibold text-slate-300">Thumbnails</span><span className="text-[10px] text-slate-600">{moduleThumbnails.length} / 5 · PNG, JPEG or WebP · 5 MB each</span></div>
                            <input ref={moduleThumbnailInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { chooseModuleThumbnails(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {moduleThumbnails.map((thumbnail, index) => (
                                    <div key={thumbnail.id} className="group relative aspect-video overflow-hidden rounded-lg border border-white/12 bg-black/25">
                                        <img src={thumbnail.url} alt={`Module thumbnail ${index + 1}`} className="h-full w-full object-cover" />
                                        {index === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Primary</span>}
                                        <button type="button" aria-label={`Remove thumbnail ${index + 1}`} onClick={() => {
                                            if (thumbnail.url.startsWith('blob:')) {
                                                URL.revokeObjectURL(thumbnail.url);
                                                moduleThumbnailBlobUrlsRef.current.delete(thumbnail.url);
                                            }
                                            setModuleThumbnails((current) => current.filter((item) => item.id !== thumbnail.id));
                                            setModuleThumbnailsDirty(true);
                                        }} className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded border border-red-400/25 bg-black/75 px-2 py-1 text-[9px] font-bold text-red-200 opacity-100 hover:bg-red-400/15 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><Trash2 className="h-3 w-3" />Remove</button>
                                    </div>
                                ))}
                                {moduleThumbnails.length < 5 && <button type="button" onClick={() => moduleThumbnailInputRef.current?.click()} className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/12 bg-black/25 text-slate-500 transition-colors hover:bg-white/[0.03] hover:text-sky-300"><ImagePlus className="h-6 w-6" /><span className="text-[10px] font-semibold">Add thumbnails</span><span className="text-[9px] text-slate-600">16:9 recommended</span></button>}
                            </div>
                        </div>
                        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Description</span><textarea rows={5} maxLength={2000} value={moduleInfo.description} onChange={(event) => setModuleInfo((current) => ({ ...current, description: event.target.value }))} placeholder="Describe what this module does…" className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 outline-none focus:border-sky-400/60" /><span className="mt-1 block text-right text-[10px] text-slate-600">{moduleInfo.description.length} / 2000</span></label>
                        {moduleInfoError && <p role="alert" className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{moduleInfoError}</p>}
                    </div>
                    <div className="flex shrink-0 justify-end gap-2 border-t border-white/8 p-4"><button type="button" onClick={() => setModuleInfoOpen(false)} disabled={moduleInfoSaving} className="rounded border border-white/10 px-4 py-2 text-xs disabled:opacity-40">Cancel</button><button disabled={!moduleInfo.title.trim() || moduleInfoSaving} className="rounded bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-400 disabled:opacity-40">{moduleInfoSaving ? 'Saving…' : 'Save changes'}</button></div>
                </form>
            </div>
        )}
    </div>;
}
