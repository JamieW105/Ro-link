'use client';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { Card } from '@/components/ui/card';
import { Status, StatusIndicator, StatusLabel } from '@/components/ui/status';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Copy, ExternalLink, KeyRound, RefreshCw, ShieldAlert } from "lucide-react";

const INSTALLER_PLUGIN_URL = "https://create.roblox.com/store/asset/87859041511603/RoLink-installer";

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
                    <Card className="p-6">
                        <PageIcon name="setup" />
                        <h1 className="text-2xl font-medium mb-2 tracking-tight">Setup</h1>
                        <p className="text-muted-foreground text-sm font-medium mb-8">Connect your Roblox game to Discord.</p>

                        <form onSubmit={handleSetup} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="place-id" className="text-sm font-medium block">Place ID</label>
                                    <Input
                                        type="text"
                                        required
                                        id="place-id" placeholder="Place ID"
                                        className="w-full transition-all"
                                        value={placeId}
                                        onChange={(event) => setPlaceId(event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="universe-id" className="text-sm font-medium block">Universe ID</label>
                                    <Input
                                        type="text"
                                        required
                                        id="universe-id" placeholder="Universe ID"
                                        className="w-full transition-all"
                                        value={universeId}
                                        onChange={(event) => setUniverseId(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="open-cloud-key" className="text-sm font-medium block">Open Cloud API Key</label>
                                <Input
                                    type="password"
                                    required
                                    id="open-cloud-key" placeholder="Enter Roblox API Key"
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
                                    "Request auth key"
                                )}
                            </Button>
                        </form>
                    </Card>
                ) : (
                    <Card className="p-6">
                        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 xl:gap-12">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-4 mb-10">
                                    <PageIcon name="verification" />
                                    <div>
                                        <h1 className="text-2xl font-medium tracking-tight">Setup Complete</h1>
                                        <Status className="mt-2"><StatusIndicator /><StatusLabel>Active</StatusLabel></Status>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <Card className="p-4">
                                        <h2 className="text-sm text-foreground font-medium flex items-center gap-2 mb-4">
                                            <KeyIcon />
                                            Security Key
                                        </h2>
                                        <div className="flex gap-3">
                                            <code className="min-w-0 flex-1 bg-card px-4 py-3 rounded-lg font-mono text-xs text-foreground break-all border border-border">
                                                {apiKey}
                                            </code>
                                            <Button type="button" aria-label="Copy security key" variant="outline" size="icon"
                                                onClick={() => navigator.clipboard.writeText(apiKey)}
                                                className="transition-all"
                                            >
                                                <CopyIcon />
                                            </Button>
                                        </div>
                                    </Card>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-medium flex items-center gap-3 text-foreground">
                                            <div className="w-1 h-1 bg-primary rounded-full"></div>
                                            Complete in Studio
                                        </h3>
                                        <ol className="space-y-4">
                                            {setupSteps.map((text, index) => (
                                                <li key={text} className="flex gap-4 text-sm text-foreground p-3 rounded-md border border-border">
                                                    <span className="text-foreground">{`0${index + 1}`}</span>
                                                    {text}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0 flex-1">
                                <Card className="h-full overflow-hidden">
                                    <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-card border-b border-border gap-4">
                                        <div>
                                            <span className="text-xs font-medium text-muted-foreground">Installer plugin</span>
                                            <p className="text-sm font-semibold text-foreground mt-1">RoLink installer</p>
                                        </div>
                                        <Button asChild>
                                            <a href={INSTALLER_PLUGIN_URL} target="_blank" rel="noreferrer">
                                                Open Plugin <ExternalLinkIcon />
                                            </a>
                                        </Button>
                                    </div>
                                    <div className="p-6">
                                        <div className="space-y-5">
                                            <Card className="bg-muted p-4">
                                                <p className="text-xs font-medium text-foreground mb-2">No manual scripts required</p>
                                                <p className="text-sm leading-6 text-foreground">
                                                    The installer plugin places and configures the Ro-Link bridge for you in Studio. Install it, paste your Security Key, and let it finish the setup.
                                                </p>
                                            </Card>
                                            <div className="grid gap-4">
                                                {installerHighlights.map((item) => (
                                                    <Card key={item.title} className="p-4">
                                                        <p className="text-sm font-medium text-foreground mb-2">{item.title}</p>
                                                        <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                                                    </Card>
                                                ))}
                                            </div>
                                            <Card className="bg-muted p-4">
                                                <p className="text-xs font-medium text-foreground mb-2">Keep this key private</p>
                                                <p className="text-xs leading-6 text-foreground">
                                                    Only paste the Security Key into the RoLink installer plugin or your secure backend tooling. Do not expose it in public repos, client scripts, or shared screenshots.
                                                </p>
                                            </Card>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-border">
                            <Button type="button" variant="outline" size="default"
                                onClick={() => {
                                    setStep(1);
                                    setPlaceId("");
                                }}
                                className="flex items-center transition-colors"
                            >
                                <RefreshIcon />
                                Reset bridge handshake
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
