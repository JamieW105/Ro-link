'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const INSTALLER_PLUGIN_URL = "https://create.roblox.com/store/asset/87859041511603/RoLink-installer";

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

const KeyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3l2 2" /></svg>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
);

const ExternalLinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
);

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
);

const setupSteps = [
    "Install the RoLink installer plugin from the Roblox Creator Store.",
    "Open your experience in Roblox Studio and launch the plugin from the Plugins tab.",
    "Paste the Security Key into the installer when prompted.",
    "Let the plugin place and configure the Ro-Link bridge for this experience.",
    "Publish the place, then verify HTTP Requests and API Services are enabled if your experience requires them."
];

const installerHighlights = [
    {
        title: "Install in Studio",
        body: "Add the plugin from the Creator Store, then open it from the Plugins tab inside Roblox Studio."
    },
    {
        title: "Paste your key",
        body: "Use the Security Key from this page when the plugin asks for your Ro-Link credentials."
    },
    {
        title: "Publish and test",
        body: "Save and publish the place, then join a live server to confirm the dashboard starts receiving data."
    }
];

type DashboardGuild = {
    id?: string;
    permissions?: string;
};

type ServerSetupConfig = {
    api_key?: string | null;
    place_id?: string | null;
    universe_id?: string | null;
    open_cloud_key?: string | null;
};

type SessionUserWithId = {
    id?: string;
};

export default function DashboardSetupPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [placeId, setPlaceId] = useState("");
    const [universeId, setUniverseId] = useState("");
    const [openCloudKey, setOpenCloudKey] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isReadOnly, setIsReadOnly] = useState(true);

    useEffect(() => {
        async function checkStatus() {
            if (!id || !session) return;

            const res = await fetch("/api/guilds");
            const guilds = await res.json() as DashboardGuild[];
            const guild = guilds.find((entry) => entry.id === id);
            const sessionUser = session.user as SessionUserWithId;

            if (!guild || (guild.permissions === "0" && sessionUser.id === "953414442060746854")) {
                router.push(`/dashboard/${id}`);
                return;
            }

            setIsReadOnly(false);

            const configRes = await fetch(`/api/dashboard/server-config?serverId=${encodeURIComponent(String(id))}`, {
                cache: 'no-store',
            });
            const data = configRes.ok ? await configRes.json() as ServerSetupConfig | null : null;

            if (data) {
                setApiKey(data.api_key || "");
                setPlaceId(data.place_id || "");
                setUniverseId(data.universe_id || "");
                setOpenCloudKey(data.open_cloud_key || "");
                setStep(4);
            }

            setInitialLoading(false);
        }

        checkStatus();
    }, [id, router, session]);

    async function handleSetup(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const response = await fetch('/api/dashboard/server-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: id,
                placeId,
                universeId,
                openCloudKey,
                apiKey,
            }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            setError(String(payload.error || 'Failed to save setup.'));
            setLoading(false);
            return;
        }

        setApiKey(String(payload.api_key || ""));
        setStep(2);
        setLoading(false);
    }

    if (initialLoading) {
        return null;
    }

    if (isReadOnly) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-slate-400 border border-slate-700 shadow-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">Access Denied</h1>
                <p className="text-slate-400 mb-8 max-w-sm text-sm">You have read-only access to this dashboard. You cannot modify server configuration.</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className={`w-full transition-all duration-700 ${step === 1 ? "max-w-md mx-auto mt-20" : "max-w-7xl"}`}>
                {step === 1 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 md:p-8 xl:p-10 shadow-3xl">
                        <div className="w-12 h-12 bg-sky-600/10 rounded-lg flex items-center justify-center text-sky-500 mb-8 border border-sky-500/10">
                            <SearchIcon />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 tracking-tight">Setup</h1>
                        <p className="text-slate-500 text-sm font-medium mb-8">Connect your Roblox game to Discord.</p>

                        <form onSubmit={handleSetup} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 block">Place ID</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Place ID"
                                        className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-mono"
                                        value={placeId}
                                        onChange={(event) => setPlaceId(event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 block">Universe ID</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Universe ID"
                                        className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-mono"
                                        value={universeId}
                                        onChange={(event) => setUniverseId(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 block">Open Cloud API Key</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Enter Roblox API Key"
                                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-mono"
                                    value={openCloudKey}
                                    onChange={(event) => setOpenCloudKey(event.target.value)}
                                />
                            </div>

                            {error ? <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider">{error}</p> : null}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 rounded-lg transition-all shadow-lg shadow-sky-900/10 text-xs disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    "REQUEST AUTH KEY"
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] p-5 sm:p-6 md:p-8 xl:p-10 shadow-3xl border-l-sky-600 border-l-4">
                        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 xl:gap-12">
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 border border-emerald-500/10">
                                        <CheckIcon />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold tracking-tight">Setup Complete</h1>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">STATUS: ACTIVE</p>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="bg-black/40 p-5 rounded-xl border border-slate-800">
                                        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2 mb-4">
                                            <KeyIcon />
                                            Security Key
                                        </label>
                                        <div className="flex gap-3">
                                            <code className="flex-1 bg-slate-900 px-4 py-3 rounded-lg font-mono text-[11px] text-sky-500 break-all border border-slate-800 shadow-inner">
                                                {apiKey}
                                            </code>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(apiKey)}
                                                className="p-3.5 bg-slate-800 hover:bg-slate-700 transition-all font-bold rounded-lg border border-slate-700"
                                            >
                                                <CopyIcon />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-3 text-slate-300">
                                            <div className="w-1 h-1 bg-sky-600 rounded-full"></div>
                                            Complete in Studio
                                        </h3>
                                        <ol className="space-y-4">
                                            {setupSteps.map((text, index) => (
                                                <li key={text} className="flex gap-4 text-xs font-semibold text-slate-400 p-4 bg-slate-800/20 rounded-xl border border-slate-800/40">
                                                    <span className="text-sky-600">{`0${index + 1}`}</span>
                                                    {text}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="bg-black/60 rounded-xl border border-slate-800 h-full flex flex-col overflow-hidden">
                                    <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 gap-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Installer plugin</span>
                                            <p className="text-sm font-semibold text-white mt-1">RoLink installer</p>
                                        </div>
                                        <a
                                            href={INSTALLER_PLUGIN_URL}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold uppercase tracking-tight transition-colors shadow-sm"
                                        >
                                            Open Plugin
                                            <ExternalLinkIcon />
                                        </a>
                                    </div>
                                    <div className="flex-1 overflow-auto p-6 bg-[#030303] custom-scrollbar">
                                        <div className="space-y-5">
                                            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
                                                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-2">No manual scripts required</p>
                                                <p className="text-sm leading-6 text-slate-300">
                                                    The installer plugin places and configures the Ro-Link bridge for you in Studio. Install it, paste your Security Key, and let it finish the setup.
                                                </p>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-3">
                                                {installerHighlights.map((item) => (
                                                    <div key={item.title} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{item.title}</p>
                                                        <p className="text-xs leading-6 text-slate-400">{item.body}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5">
                                                <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-2">Keep this key private</p>
                                                <p className="text-xs leading-6 text-amber-100/80">
                                                    Only paste the Security Key into the RoLink installer plugin or your secure backend tooling. Do not expose it in public repos, client scripts, or shared screenshots.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-slate-800">
                            <button
                                onClick={() => {
                                    setStep(1);
                                    setPlaceId("");
                                }}
                                className="flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest"
                            >
                                <RefreshIcon />
                                Reset Bridge Handshake
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }

                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
            `}</style>
        </div>
    );
}
