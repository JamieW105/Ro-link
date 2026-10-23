'use client';

import { Card } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';


import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Copy, ExternalLink, KeyRound, RefreshCw, Search, ShieldAlert } from "lucide-react";

const INSTALLER_PLUGIN_URL = "https://create.roblox.com/store/asset/87859041511603/RoLink-installer";

const SearchIcon = () => <Search size={20} aria-hidden="true" />;
const CheckIcon = () => <Check size={20} strokeWidth={3} aria-hidden="true" />;
const KeyIcon = () => <KeyRound size={16} aria-hidden="true" />;
const CopyIcon = () => <Copy size={14} aria-hidden="true" />;
const ExternalLinkIcon = () => <ExternalLink size={14} aria-hidden="true" />;
const RefreshIcon = () => <RefreshCw size={14} aria-hidden="true" />;

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
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-6 text-muted-foreground border border-border">
                    <ShieldAlert size={32} aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-medium mb-2 tracking-tight">Access Denied</h1>
                <p className="text-muted-foreground mb-8 max-w-sm text-sm">You have read-only access to this dashboard. You cannot modify server configuration.</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className={`w-full transition-all duration-700 ${step === 1 ? "max-w-md mx-auto mt-20" : "max-w-7xl"}`}>
                {step === 1 ? (
                    <Card className="bg-card border border-border rounded-xl p-5 sm:p-6 md:p-8 xl:p-10">
                        <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center text-foreground mb-8 border border-border">
                            <SearchIcon />
                        </div>
                        <h1 className="text-2xl font-medium mb-2 tracking-tight">Setup</h1>
                        <p className="text-muted-foreground text-sm font-medium mb-8">Connect your Roblox game to Discord.</p>

                        <form onSubmit={handleSetup} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground pl-1 block">Place ID</label>
                                    <Input
                                        type="text"
                                        required
                                        placeholder="Place ID"
                                        className="w-full transition-all"
                                        value={placeId}
                                        onChange={(event) => setPlaceId(event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground pl-1 block">Universe ID</label>
                                    <Input
                                        type="text"
                                        required
                                        placeholder="Universe ID"
                                        className="w-full transition-all"
                                        value={universeId}
                                        onChange={(event) => setUniverseId(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground pl-1 block">Open Cloud API Key</label>
                                <Input
                                    type="password"
                                    required
                                    placeholder="Enter Roblox API Key"
                                    className="w-full transition-all"
                                    value={openCloudKey}
                                    onChange={(event) => setOpenCloudKey(event.target.value)}
                                />
                            </div>

                            {error ? <p className="text-red-700 dark:text-red-400 text-xs font-medium">{error}</p> : null}

                            <Button variant="default" size="default"
                                type="submit"
                                disabled={loading}
                                className="w-full transition-all disabled:opacity-50 flex items-center justify-center"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    "REQUEST AUTH KEY"
                                )}
                            </Button>
                        </form>
                    </Card>
                ) : (
                    <Card className="bg-card border border-border rounded-xl p-5 sm:p-6 md:p-8 xl:p-10 border-l-sky-600 border-l-4">
                        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 xl:gap-12">
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg flex items-center justify-center text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                                        <CheckIcon />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-medium tracking-tight">Setup Complete</h1>
                                        <p className="text-muted-foreground text-xs font-medium">STATUS: ACTIVE</p>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="bg-muted p-5 rounded-xl border border-border">
                                        <label className="text-xs text-muted-foreground font-medium flex items-center gap-2 mb-4">
                                            <KeyIcon />
                                            Security Key
                                        </label>
                                        <div className="flex gap-3">
                                            <code className="flex-1 bg-card px-4 py-3 rounded-lg font-mono text-xs text-foreground break-all border border-border">
                                                {apiKey}
                                            </code>
                                            <Button variant="outline" size="icon"
                                                onClick={() => navigator.clipboard.writeText(apiKey)}
                                                className="transition-all"
                                            >
                                                <CopyIcon />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-medium flex items-center gap-3 text-foreground">
                                            <div className="w-1 h-1 bg-primary rounded-full"></div>
                                            Complete in Studio
                                        </h3>
                                        <ol className="space-y-4">
                                            {setupSteps.map((text, index) => (
                                                <li key={text} className="flex gap-4 text-xs font-semibold text-muted-foreground p-4 bg-muted rounded-xl border border-border">
                                                    <span className="text-foreground">{`0${index + 1}`}</span>
                                                    {text}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="bg-muted rounded-xl border border-border h-full flex flex-col overflow-hidden">
                                    <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border gap-4">
                                        <div>
                                            <span className="text-xs font-medium text-muted-foreground">Installer plugin</span>
                                            <p className="text-sm font-semibold text-foreground mt-1">RoLink installer</p>
                                        </div>
                                        <a
                                            href={INSTALLER_PLUGIN_URL}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary text-foreground rounded text-xs font-medium tracking-tight transition-colors"
                                        >
                                            Open Plugin
                                            <ExternalLinkIcon />
                                        </a>
                                    </div>
                                    <div className="flex-1 overflow-auto p-6 bg-background custom-scrollbar">
                                        <div className="space-y-5">
                                            <div className="rounded-xl border border-border bg-accent p-5">
                                                <p className="text-xs font-medium text-foreground mb-2">No manual scripts required</p>
                                                <p className="text-sm leading-6 text-foreground">
                                                    The installer plugin places and configures the Ro-Link bridge for you in Studio. Install it, paste your Security Key, and let it finish the setup.
                                                </p>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-3">
                                                {installerHighlights.map((item) => (
                                                    <Card key={item.title} className="rounded-xl border border-border bg-card p-4">
                                                        <p className="text-xs font-medium text-muted-foreground mb-2">{item.title}</p>
                                                        <p className="text-xs leading-6 text-muted-foreground">{item.body}</p>
                                                    </Card>
                                                ))}
                                            </div>
                                            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5">
                                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">Keep this key private</p>
                                                <p className="text-xs leading-6 text-amber-100/80">
                                                    Only paste the Security Key into the RoLink installer plugin or your secure backend tooling. Do not expose it in public repos, client scripts, or shared screenshots.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-border">
                            <Button variant="ghost" size="default"
                                onClick={() => {
                                    setStep(1);
                                    setPlaceId("");
                                }}
                                className="flex items-center transition-colors"
                            >
                                <RefreshIcon />
                                Reset Bridge Handshake
                            </Button>
                        </div>
                    </Card>
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
                    background: var(--dice-border);
                    border-radius: 10px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--dice-muted-foreground);
                }
            `}</style>
        </div>
    );
}
