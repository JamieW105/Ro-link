'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';

type ModuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

interface AddonModule {
    id: string;
    slug: string;
    name: string;
    description: string;
    version: string;
    category: string;
    status: ModuleStatus;
    sourceCode: string;
    sourceChecksum: string;
    configSchema?: Record<string, unknown>;
    authorDiscordId: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    moderationNote: string;
    updatedAt: string | null;
    publishedAt: string | null;
}

interface CreatorBlock {
    discord_id: string;
    reason: string;
    active: boolean;
}

interface ModuleForm {
    name: string;
    slug: string;
    description: string;
    version: string;
    category: string;
    status: ModuleStatus;
    sourceCode: string;
}

const emptyForm: ModuleForm = {
    name: '',
    slug: '',
    description: '',
    version: '1.0.0',
    category: 'General',
    status: 'DRAFT',
    sourceCode: '',
};

const developerApiExample = `CONFIG = {
    Version = "1.0.0",
    Debug_UI = {
        Short_Description = "Show a live test panel when the module loads.",
        Type = "Bool",
        Default = true,
        Options = {}
    },
    Message_Target = {
        Short_Description = "Where the test notification should be sent.",
        Type = "Dropdown",
        Default = "serverowner",
        Options = { "serverowner", "channel" }
    },
    Enabled_Checks = {
        Short_Description = "Pick which checks the module should mark in its test UI.",
        Type = "CheckBoxes",
        Default = { "ui", "hooks", "messages" },
        Options = { "ui", "hooks", "messages" }
    },
    Accent_Color = {
        Short_Description = "Accent color used by the module UI.",
        Type = "Color Wheel",
        Default = "#38bdf8",
        Options = {}
    }
}

return {
    Init = function(context)
        local settings = context.Settings or {}
        context.Log("Config Debug_UI =", settings.Debug_UI)

        context.OnAdminPanelOpened(function(player)
            if settings.Debug_UI ~= false then
                context.Notify(player, "Admin panel opened with configured module settings.", true)
            end
        end)

        context.OnCommandBarOpened(function(player)
            context.CreateUI(player, function(ui)
                local label = ui.Create("TextLabel", {
                    Size = UDim2.new(0, 260, 0, 48),
                    Text = "Module UI: " .. tostring(ui.Settings.Debug_UI),
                    BackgroundColor3 = Color3.fromRGB(15, 23, 42),
                    TextColor3 = Color3.fromRGB(255, 255, 255)
                })
                return label
            end)
        end)
    end,

    Commands = {
        hello = function(command, context)
            context.SendBotMessage("channel", nil, command.args.channelId, {
                PlainText = "Hello from a Ro-Link module. Accent color: " .. tostring(context.Settings.Accent_Color),
                Embed = {
                    Title = "Optional embed",
                    Content = "Configured target: " .. tostring(context.Settings.Message_Target),
                    media = "https://example.com/image.png",
                    Footer = "Ro-Link"
                }
            })
        end
    }
}`;

function formatDate(value: string | null) {
    if (!value) return 'Never';
    return new Date(value).toLocaleString();
}

export default function ManagementModulesPage() {
    const [modules, setModules] = useState<AddonModule[]>([]);
    const [creatorBlocks, setCreatorBlocks] = useState<CreatorBlock[]>([]);
    const [form, setForm] = useState<ModuleForm>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const filteredModules = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return modules;

        return modules.filter((addon) => (
            addon.name.toLowerCase().includes(query)
            || addon.slug.toLowerCase().includes(query)
            || addon.category.toLowerCase().includes(query)
        ));
    }, [modules, search]);

    const pendingModules = useMemo(
        () => modules.filter((addon) => addon.status === 'PENDING_REVIEW'),
        [modules],
    );

    const activeBlockIds = useMemo(
        () => new Set(creatorBlocks.filter((block) => block.active).map((block) => block.discord_id)),
        [creatorBlocks],
    );

    async function loadModules() {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/management/modules', { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to load modules.'));
            }
            setModules(Array.isArray(payload) ? payload : []);
            const blocksResponse = await fetch('/api/management/module-creator-blocks', { cache: 'no-store' });
            const blocksPayload = await blocksResponse.json().catch(() => ([]));
            if (blocksResponse.ok) {
                setCreatorBlocks(Array.isArray(blocksPayload) ? blocksPayload : []);
            }
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load modules.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadModules();
    }, []);

    function updateForm<K extends keyof ModuleForm>(key: K, value: ModuleForm[K]) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    function selectModule(addon: AddonModule) {
        setEditingId(addon.id);
        setForm({
            name: addon.name,
            slug: addon.slug,
            description: addon.description,
            version: addon.version,
            category: addon.category,
            status: addon.status,
            sourceCode: addon.sourceCode,
        });
        setSuccess(null);
        setError(null);
    }

    function resetForm() {
        setEditingId(null);
        setForm(emptyForm);
        setError(null);
        setSuccess(null);
    }

    async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        setForm((current) => ({
            ...current,
            name: current.name || file.name.replace(/\.(lua|luau|txt)$/i, ''),
            sourceCode: text,
        }));
    }

    async function saveModule() {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(editingId ? `/api/management/modules/${editingId}` : '/api/management/modules', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to save module.'));
            }

            setSuccess(editingId ? 'Module updated.' : 'Module created.');
            setEditingId(payload.id || editingId);
            setForm({
                name: payload.name || form.name,
                slug: payload.slug || form.slug,
                description: payload.description || '',
                version: payload.version || '1.0.0',
                category: payload.category || 'General',
                status: payload.status || 'DRAFT',
                sourceCode: payload.sourceCode || form.sourceCode,
            });
            await loadModules();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save module.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteModule(addon: AddonModule) {
        if (!confirm(`Delete ${addon.name}? Installed copies will be removed from servers.`)) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/management/modules/${addon.id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to delete module.'));
            }

            if (editingId === addon.id) {
                resetForm();
            }
            setSuccess('Module deleted.');
            await loadModules();
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete module.');
        } finally {
            setSaving(false);
        }
    }

    async function copySource(addon: AddonModule) {
        await navigator.clipboard.writeText(addon.sourceCode || '');
        setSuccess(`Copied ${addon.name} source code.`);
    }

    async function reviewModule(addon: AddonModule, status: 'PUBLISHED' | 'REJECTED') {
        const moderationNote = status === 'REJECTED'
            ? prompt('Reason for denying this module?') || 'Denied by moderation.'
            : '';

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/management/modules/${addon.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, moderationNote }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to review module.'));
            }

            setSuccess(status === 'PUBLISHED' ? 'Module accepted and published.' : 'Module denied.');
            await loadModules();
        } catch (reviewError) {
            setError(reviewError instanceof Error ? reviewError.message : 'Failed to review module.');
        } finally {
            setSaving(false);
        }
    }

    async function blockCreator(addon: AddonModule) {
        if (!addon.authorDiscordId) {
            setError('This module does not have a creator Discord ID.');
            return;
        }

        const reason = prompt('Reason for blocking this creator from submitting modules?') || 'Repeated module terms violations.';
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/management/module-creator-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId: addon.authorDiscordId, reason, active: true }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(String(payload.error || 'Failed to block creator.'));
            }

            setSuccess('Creator blocked from future module submissions.');
            await loadModules();
        } catch (blockError) {
            setError(blockError instanceof Error ? blockError.message : 'Failed to block creator.');
        } finally {
            setSaving(false);
        }
    }

    function statusClassName(status: ModuleStatus) {
        if (status === 'PUBLISHED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
        if (status === 'PENDING_REVIEW') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
        if (status === 'REJECTED') return 'border-red-400/20 bg-red-400/10 text-red-300';
        return 'border-slate-700 bg-slate-950 text-slate-500';
    }

    return (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
            <section className="space-y-6">
                <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Module Marketplace</h1>
                        <p className="mt-1 text-sm text-slate-400">Create and publish add-ons stored by Ro-Link for Roblox runtimes.</p>
                    </div>
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search modules..."
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500 md:w-72"
                    />
                </header>

                {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-300">
                        {success}
                    </div>
                )}

                {pendingModules.length > 0 && (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Awaiting Moderation</h2>
                                <p className="mt-1 text-xs text-slate-400">Review submitted source, copy code for inspection, then accept or deny the module.</p>
                            </div>
                            <div className="text-2xl font-black text-amber-300">{pendingModules.length}</div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {pendingModules.map((addon) => (
                                <article key={addon.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                                                    Awaiting moderation
                                                </span>
                                                {addon.authorDiscordId && (
                                                    <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${activeBlockIds.has(addon.authorDiscordId) ? 'border-red-400/20 bg-red-400/10 text-red-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
                                                        Creator {addon.authorDiscordId}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="mt-3 text-base font-bold text-white">{addon.name}</h3>
                                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">{addon.description || 'No description provided.'}</p>
                                            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                                <span>{addon.slug}</span>
                                                <span>{addon.category}</span>
                                                <span>Submitted {formatDate(addon.submittedAt)}</span>
                                                <span>{addon.sourceChecksum.slice(0, 12)}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                            <button
                                                onClick={() => copySource(addon)}
                                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                                            >
                                                Copy Code
                                            </button>
                                            <button
                                                onClick={() => reviewModule(addon, 'PUBLISHED')}
                                                disabled={saving}
                                                className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => reviewModule(addon, 'REJECTED')}
                                                disabled={saving}
                                                className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                            >
                                                Deny
                                            </button>
                                            <button
                                                onClick={() => blockCreator(addon)}
                                                disabled={saving || !addon.authorDiscordId || activeBlockIds.has(addon.authorDiscordId)}
                                                className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                            >
                                                {addon.authorDiscordId && activeBlockIds.has(addon.authorDiscordId) ? 'Blocked' : 'Block Creator'}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
                        <div className="table-responsive">
                            <table className="w-full min-w-[780px] text-left text-sm">
                                <thead className="border-b border-slate-800 bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Module</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Version</th>
                                        <th className="px-6 py-4">Updated</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {filteredModules.map((addon) => (
                                        <tr key={addon.id} className="transition-colors hover:bg-slate-800/30">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-white">{addon.name}</div>
                                                <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    <span>{addon.slug}</span>
                                                    <span>{addon.category}</span>
                                                    <span>{Object.keys(addon.configSchema || {}).length} config fields</span>
                                                    <span>{addon.sourceChecksum.slice(0, 12)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(addon.status)}`}>
                                                    {addon.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-400">v{addon.version}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{formatDate(addon.updatedAt)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => selectModule(addon)}
                                                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => copySource(addon)}
                                                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                                                    >
                                                        Copy
                                                    </button>
                                                    <button
                                                        onClick={() => deleteModule(addon)}
                                                        disabled={saving}
                                                        className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredModules.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                No modules found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            <aside className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">{editingId ? 'Edit Module' : 'Create Module'}</h2>
                        <p className="mt-1 text-xs text-slate-500">{editingId ? 'Changes affect future Roblox module fetches.' : 'Upload Luau source or paste it below.'}</p>
                    </div>
                    {editingId && (
                        <button
                            onClick={resetForm}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:text-white"
                        >
                            New
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Name</label>
                        <input
                            value={form.name}
                            onChange={(event) => updateForm('name', event.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</label>
                            <input
                                value={form.slug}
                                onChange={(event) => updateForm('slug', event.target.value)}
                                placeholder="auto"
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Version</label>
                            <input
                                value={form.version}
                                onChange={(event) => updateForm('version', event.target.value)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</label>
                            <input
                                value={form.category}
                                onChange={(event) => updateForm('category', event.target.value)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</label>
                            <select
                                value={form.status}
                                onChange={(event) => updateForm('status', event.target.value as ModuleStatus)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-500"
                            >
                                <option value="DRAFT">Draft</option>
                                <option value="PENDING_REVIEW">Pending Review</option>
                                <option value="PUBLISHED">Published</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="ARCHIVED">Archived</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</label>
                        <textarea
                            value={form.description}
                            onChange={(event) => updateForm('description', event.target.value)}
                            className="h-24 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-white outline-none transition-colors focus:border-sky-500"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Upload Source</label>
                        <input
                            type="file"
                            accept=".lua,.luau,.txt"
                            onChange={handleFileUpload}
                            className="w-full rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:border-sky-500"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Source Code</label>
                        <textarea
                            value={form.sourceCode}
                            onChange={(event) => updateForm('sourceCode', event.target.value)}
                            className="h-[360px] w-full resize-none rounded-xl border border-slate-800 bg-black/50 p-4 font-mono text-xs leading-relaxed text-slate-100 outline-none transition-colors focus:border-sky-500"
                            spellCheck={false}
                        />
                    </div>

                    <div className="space-y-3 border-t border-slate-800 pt-4">
                        <div>
                            <h3 className="text-sm font-bold text-white">Developer API</h3>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                Modules receive a context object with helpers for Discord messages, lifecycle hooks, Roblox UI, command registration, player lookup, and admin feedback.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-300">
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">SendBotMessage</span>
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">GetDiscordChannels</span>
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">OnAdminPanelOpened</span>
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">OnCommandBarOpened</span>
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">CreateUI</span>
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">RegisterCommand</span>
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">FindPlayer</span>
                            <span className="rounded-lg bg-slate-950/70 px-3 py-2">Notify</span>
                        </div>
                        <pre className="max-h-80 overflow-auto rounded-xl border border-slate-800 bg-black/50 p-4 text-[11px] leading-relaxed text-slate-200">
                            {developerApiExample}
                        </pre>
                    </div>

                    <button
                        onClick={saveModule}
                        disabled={saving}
                        className="w-full rounded-xl bg-sky-600 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                    >
                        {saving ? 'Saving' : editingId ? 'Save Module' : 'Create Module'}
                    </button>
                </div>
            </aside>
        </div>
    );
}
