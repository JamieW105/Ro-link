'use client';
import { ArrowUpDown, ScrollText, Search } from "lucide-react";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeDashboardLogs, type NormalizedDashboardLog } from "@/lib/logRecords";

const ScrollIcon = () => <ScrollText size={24} aria-hidden="true" />;

const SearchIcon = () => <Search size={16} aria-hidden="true" />;

const SortIcon = () => <ArrowUpDown size={16} aria-hidden="true" />;

export default function LogsPage() {
    const { id } = useParams();
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]…104093 tokens truncated…                         >
                                        Open Module
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {selectedModule && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                        <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-[#020617] shadow-2xl">
                            <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950/80 px-5 py-5 md:flex-row md:items-start md:justify-between md:px-7">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                                            {selectedModule.category}
                                        </span>
                                        <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            v{selectedModule.version}
                                        </span>
                                        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClassName(selectedModule.status)}`}>
                                            {statusLabel(selectedModule.status)}
                                        </span>
                                        {selectedModule.isOfficial && (
                                            <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                                Official
                                            </span>
                                        )}
                                        {selectedModule.creatorIsVerified && (
                                            <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                                                Verified Creator
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-4xl">{selectedModule.name}</h2>
                                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                                        {selectedModule.description || 'No description provided.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeModulePreview}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
                                    aria-label="Close module preview"
                                >
                                    x
                                </button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-180px)] overflow-y-auto px-5 py-6 md:px-7">
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Configuration Fields</h3>
                                        {Object.values(selectedModule.configSchema || {}).length === 0 ? (
                                            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-500">
                                                This module does not expose configurable fields.
                                            </div>
                                        ) : (
                                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {Object.values(selectedModule.configSchema || {}).map((field) => (
                                                    <div key={field.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{field.label}</p>
                                                                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                                                    {field.shortDescription || 'No field description provided.'}
                                                                </p>
                                                            </div>
                                                            <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                {field.type}
                                                            </span>
                                                        </div>
                                                        {field.options.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {field.options.slice(0, 6).map((option) => (
                                                                    <span key={option} className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-400">
                                                                        {option}
                                                                    </span>
                                                                ))}
                                                                {field.options.length > 6 && (
                                                                    <span className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-500">
                                                                        +{field.options.length - 6} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <aside className="space-y-4">
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Slug</p>
                                            <p className="mt-2 break-all font-mono text-sm text-slate-300">{selectedModule.slug}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Review Status</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">{statusLabel(selectedModule.status)}</p>
                                            {selectedModule.status === 'REJECTED' && selectedModule.moderationNote && (
                                                <p className="mt-2 text-xs leading-relaxed text-red-300">{selectedModule.moderationNote}</p>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Published</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">{formatDate(selectedModule.publishedAt)}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Checksum</p>
                                            <p className="mt-2 break-all font-mono text-xs text-slate-300">{selectedModule.sourceChecksum || 'Unavailable'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openInstallPicker(selectedModule.id)}
                                            className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500"
                                        >
                                            Select Server To Install
                                        </button>
                                    </aside>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {installPickerModule && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                        <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#020617] shadow-2xl">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-5 py-5">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-400">Install Module</p>
                                    <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{installPickerModule.name}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                                        Click a server to install. Right-click a server to start multi-select.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeInstallPicker}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-50"
                                    aria-label="Close install picker"
                                    disabled={installing}
                                >
                                    x
                                </button>
                            </div>

                            <div className="custom-scrollbar max-h-[calc(90vh-170px)] overflow-y-auto px-5 py-5">
                                {installError && (
                                    <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                                        {installError}
                                    </div>
                                )}
                                {installMessage && (
                                    <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
                                        {installMessage}
                                    </div>
                                )}

                                {installTargets.length === 0 ? (
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
                                        No servers are available for module installs.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {installTargets.map((server) => {
                                            const selected = selectedServerIds.includes(server.id);
                                            const full = server.installedModuleCount >= server.moduleLimit;

                                            return (
                                                <button
                                                    key={server.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (multiSelectInstall) {
                                                            toggleServerSelection(server.id);
                                                            return;
                                                        }

                                                        installModuleToServers(installPickerModule.id, [server.id]);
                                                    }}
                                                    onContextMenu={(event) => {
                                                        event.preventDefault();
                                                        setMultiSelectInstall(true);
                                                        toggleServerSelection(server.id);
                                                    }}
                                                    disabled={installing || full}
                                                    className={`flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${selected ? 'border-sky-400 bg-sky-500/15' : 'border-slate-800 bg-slate-900/40 hover:border-sky-500/40'}`}
                                                >
                                                    {server.icon ? (
                                                        <img
                                                            src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`}
                                                            alt=""
                                                            className="h-11 w-11 shrink-0 rounded-lg border border-white/5 object-cover"
                                                        />
                                                    ) : (
                                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-sky-300">
                                                            {server.name.substring(0, 1)}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0">
                                                        <span className="block break-words text-sm font-bold text-white">{server.name}</span>
                                                        <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                            {full ? `${server.installedModuleCount}/${server.moduleLimit} installed` : selected ? 'Selected' : `${server.installedModuleCount}/${server.moduleLimit} installed`}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {multiSelectInstall && installTargets.length > 0 && (
                                <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-semibold text-slate-400">
                                        {selectedServerIds.length} server{selectedServerIds.length === 1 ? '' : 's'} selected
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMultiSelectInstall(false);
                                                setSelectedServerIds([]);
                                            }}
                                            disabled={installing}
                                            className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => installModuleToServers(installPickerModule.id, selectedServerIds)}
                                            disabled={installing || selectedServerIds.length === 0}
                                            className="rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                                        >
                                            {installing ? 'Installing' : 'Install Selected'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
