'use client';

import { TriangleAlert } from 'lucide-react';

import { Card } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';


import { Info as LucideInfo, Radar as LucideRadar, Search as LucideSearch, Shield as LucideShield, User as LucideUser } from 'lucide-react';

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useCallback } from "react";
import { canUseDashboardCommand, getAdminPanelCommandDefinition, MODERATION_COMMAND_IDS } from "@/lib/adminPanelCommands";
import { findLivePlayer } from "@/lib/livePlayers";
import { normalizeDashboardLogs, type NormalizedDashboardLog } from "@/lib/logRecords";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/context/PermissionsContext";

interface RobloxPlayer {
    id: number;
    username: string;
    displayName: string;
    description: string;
    created: string;
    avatarUrl: string;
    isBanned?: boolean;
}

interface ServerPlaceConfig {
    place_id?: string | null;
}

interface StaffNote {
    id: string;
    target_discord_id?: string | null;
    target_roblox_id?: string | null;
    target_roblox_username?: string | null;
    note: string;
    created_by_discord_id?: string | null;
    created_by_tag?: string | null;
    created_at: string;
    can_delete?: boolean;
}

// SVGs
const SearchIcon = () => (
    <LucideSearch width="18" height="18" strokeWidth="2" />
);

const UserIcon = () => (
    <LucideUser width="18" height="18" strokeWidth="2" />
);

const ShieldIcon = () => (
    <LucideShield width="16" height="16" strokeWidth="2" />
);

const InfoIcon = () => (
    <LucideInfo width="16" height="16" strokeWidth="2" />
);

const LiveIcon = () => (
    <LucideRadar width="12" height="12" strokeWidth="3" className="animate-pulse" />
);

function PlayerLookupFallback() {
    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-medium text-foreground tracking-tight">Player Lookup</h1>
                <p className="text-muted-foreground text-sm font-medium">Loading lookup parameters...</p>
            </div>
        </div>
    );
}

function PlayerLookupContent() {
    const { id } = useParams();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState("");
    const [player, setPlayer] = useState<RobloxPlayer | null>(null);
    const [presence, setPresence] = useState<{ inGame: boolean, jobId?: string } | null>(null);
    const [linkedPlaceId, setLinkedPlaceId] = useState<string | null>(null);
    const [logs, setLogs] = useState<NormalizedDashboardLog[]>([]);
    const [staffNotes, setStaffNotes] = useState<StaffNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [noteSaving, setNoteSaving] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reasonText, setReasonText] = useState("Dashboard action");
    const [noteText, setNoteText] = useState("");
    const [softBanDurationMinutes, setSoftBanDurationMinutes] = useState("60");

    const perms = usePermissions();

    function hasActionAccess(action: string) {
        return canUseDashboardCommand(perms, action);
    }

    // Fetch Server Config (Place ID)
    useEffect(() => {
        async function fetchConfig() {
            if (!id) return;
            const response = await fetch(`/api/dashboard/server-config?serverId=${encodeURIComponent(String(id))}`, {
                cache: 'no-store',
            });
            const data = response.ok ? await response.json() as ServerPlaceConfig | null : null;
            if (data) setLinkedPlaceId(data.place_id || null);
        }
        fetchConfig();
    }, [id]);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery) return;
        setLoading(true);
        setError(null);
        setPlayer(null);
        setPresence(null);
        setLogs([]);
        setStaffNotes([]);

        try {
            const res = await fetch(`/api/proxy?username=${searchQuery}&serverId=${id}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to find player');
            setPlayer(data);

            // Fetch Presence and Logs in Parallel
            const [serversRes, logsRes, notesRes] = await Promise.all([
                fetch(`/api/dashboard/live-servers?serverId=${encodeURIComponent(String(id))}`, { cache: 'no-store' }),
                fetch(`/api/dashboard/logs?serverId=${encodeURIComponent(String(id))}&target=${encodeURIComponent(data.username)}`, { cache: 'no-store' }),
                fetch(`/api/dashboard/staff-notes?serverId=${encodeURIComponent(String(id))}&robloxId=${encodeURIComponent(String(data.id))}&robloxUsername=${encodeURIComponent(data.username)}`, { cache: 'no-store' })
            ]);

            if (serversRes.ok) {
                const serversData = await serversRes.json();
                const activeServer = serversData.find((s: any) => findLivePlayer(s.players, data.username) || findLivePlayer(s.players, String(data.id)));
                if (activeServer) {
                    setPresence({ inGame: true, jobId: activeServer.id });
                } else {
                    setPresence({ inGame: false });
                }
            }

            if (logsRes.ok) {
                setLogs(normalizeDashboardLogs(await logsRes.json()));
            }
            if (notesRes.ok) {
                const notesPayload = await notesRes.json();
                setStaffNotes(Array.isArray(notesPayload.notes) ? notesPayload.notes : []);
            }
            if (data.username) {
                await fetch('/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serverId: id,
                        action: 'LOOKUP',
                        target: data.username,
                        moderator: session?.user?.name || 'Web Admin'
                    })
                });
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id, session]);

    // Handle initial search from query param
    useEffect(() => {
        const usernameParam = searchParams.get('username');
        if (usernameParam) {
            setQuery(usernameParam);
            performSearch(usernameParam);
        }
    }, [searchParams, performSearch]);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        performSearch(query);
    }

    async function handleAction(action: typeof MODERATION_COMMAND_IDS[number]) {
        if (!player || !id) return;

        if (!hasActionAccess(action)) {
            alert(`You do not have permission to ${getAdminPanelCommandDefinition(action)?.label || action}.`);
            return;
        }

        if (action === 'KICK' && !presence?.inGame) {
            alert("Kick only works while the target is in a live server.");
            return;
        }

        const reason = reasonText.trim() || 'Dashboard action';
        const softBanMinutes = Number(softBanDurationMinutes);
        const softBanSeconds = Number.isFinite(softBanMinutes) && softBanMinutes > 0
            ? String(Math.round(softBanMinutes * 60))
            : '3600';

        const confirmMsg = action === 'BAN'
            ? `Are you sure you want to PERMANENTLY BAN ${player.username}?`
            : action === 'SOFTBAN'
                ? `Soft ban ${player.username} for ${Math.round(Number(softBanSeconds) / 60)} minute(s)?`
            : action === 'KICK'
                ? `Kick ${player.username} from the game?`
                : `Unban ${player.username}?`;

        if (!confirm(confirmMsg)) return;

        setActionLoading(true);

        const response = await fetch('/api/dashboard/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: id,
                command: action,
                args: {
                    username: player.username,
                    job_id: action === 'KICK' ? presence?.jobId : null,
                    reason,
                    ...(action === 'SOFTBAN' ? { duration_seconds: softBanSeconds } : {}),
                }
            })
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            alert("Error: " + (payload.error || 'Failed to send command.'));
        } else {
            alert(`${getAdminPanelCommandDefinition(action)?.label || action} signal sent to Roblox.`);

            // Re-fetch logs
            const logsResponse = await fetch(`/api/dashboard/logs?serverId=${encodeURIComponent(String(id))}&target=${encodeURIComponent(player.username)}`, {
                cache: 'no-store',
            });
            if (logsResponse.ok) setLogs(normalizeDashboardLogs(await logsResponse.json()));
        }
        setActionLoading(false);
    }

    async function handleAddNote(e: React.FormEvent) {
        e.preventDefault();
        if (!player || !id || !noteText.trim()) return;

        setNoteSaving(true);
        try {
            const response = await fetch('/api/dashboard/staff-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    robloxId: String(player.id),
                    robloxUsername: player.username,
                    note: noteText,
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to save staff note.');
            }

            setNoteText("");
            setStaffNotes((current) => payload.note ? [payload.note, ...current].slice(0, 10) : current);
        } catch (err: any) {
            alert(err.message || 'Failed to save staff note.');
        } finally {
            setNoteSaving(false);
        }
    }

    async function handleDeleteNote(noteId: string) {
        if (!id || !noteId) return;
        if (!confirm("Delete this staff note?")) return;

        setDeletingNoteId(noteId);
        try {
            const response = await fetch(`/api/dashboard/staff-notes?serverId=${encodeURIComponent(String(id))}&noteId=${encodeURIComponent(noteId)}`, {
                method: 'DELETE',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to delete staff note.');
            }

            setStaffNotes((current) => current.filter((note) => note.id !== noteId));
        } catch (err: any) {
            alert(err.message || 'Failed to delete staff note.');
        } finally {
            setDeletingNoteId(null);
        }
    }

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-medium text-foreground tracking-tight">Player Lookup</h1>
                <p className="text-muted-foreground text-sm font-medium">Search for Roblox users using official User API data.</p>
            </div>

            {/* Search Bar */}
            <Card className="bg-card border border-border rounded-xl p-4 md:p-6">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <div className="absolute inset-y-0 left-4 flex items-center text-muted-foreground group-focus-within:text-foreground transition-colors">
                            <SearchIcon />
                        </div>
                        <Input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Type a Roblox username..."
                            className="w-full transition-all"
                        />
                    </div>
                    <Button variant="default" size="default"
                        type="submit"
                        disabled={loading || !query}
                        className="transition-all flex items-center justify-center w-full sm:w-auto"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-border border-t-white rounded-full animate-spin"></div> : "SEARCH"}
                    </Button>
                </form>
            </Card>

            {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl text-xs font-medium animate-in shake duration-300">
                    <TriangleAlert className="mr-2 inline size-4" aria-hidden="true" /> {error}
                </div>
            )}

            {player && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Player Card */}
                    <div className="lg:col-span-1 border border-border bg-background rounded-xl overflow-hidden h-fit">
                        <div className={`h-24  ${player.isBanned ? ' ' : ' '}`}></div>
                        <div className="px-8 pb-8 -mt-12 text-center">
                            <div className="inline-block p-1.5 bg-background rounded-full mb-4">
                                <img
                                    src={player.avatarUrl}
                                    alt={player.username}
                                    className="w-24 h-24 rounded-full border border-border bg-card object-cover"
                                />
                            </div>
                            <h2 className="text-xl font-medium text-foreground mb-1">{player.displayName}</h2>
                            <p className="text-muted-foreground text-sm font-semibold mb-6">@{player.username}</p>

                            <div className="grid grid-cols-2 gap-3 mb-8">
                                <div className="bg-card p-3 rounded-xl border border-border">
                                    <span className="text-xs font-medium text-muted-foreground block mb-1">User ID</span>
                                    <span className="text-xs font-mono font-medium text-foreground">{player.id}</span>
                                </div>
                                <div className="bg-card p-3 rounded-xl border border-border">
                                    <span className="text-xs font-medium text-muted-foreground block mb-1">Status</span>
                                    {presence?.inGame ? (
                                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-full border border-emerald-200 dark:border-emerald-900 flex items-center justify-center gap-1.5">
                                            <LiveIcon /> IN GAME
                                        </span>
                                    ) : player.isBanned ? (
                                        <span className="text-xs font-medium text-red-700 dark:text-red-400 px-2 py-0.5 bg-red-50 dark:bg-red-950/30 rounded-full border border-red-200 dark:border-red-900">Banned</span>
                                    ) : (
                                        <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-muted rounded-full border border-border">Offline</span>
                                    )}
                                </div>
                            </div>

                            {presence?.inGame && presence.jobId && linkedPlaceId ? (
                                <a
                                    href={`roblox://placeId=${linkedPlaceId}&gameInstanceId=${presence.jobId}`}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-foreground py-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
                                >
                                    <LiveIcon /> JOIN SERVER
                                </a>
                            ) : (
                                <Button variant="outline" size="default"
                                    disabled={true}
                                    className="w-full transition-all cursor-not-allowed opacity-50"
                                >
                                    JOIN SERVER (OFFLINE)
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Details & Actions */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="bg-card border border-border rounded-xl p-8">
                            <h3 className="text-sm font-medium text-foreground mb-6 flex items-center gap-3">
                                <div className="p-2 bg-accent rounded-lg text-foreground border border-border">
                                    <UserIcon />
                                </div>
                                About Player
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-2">Description</label>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        &quot;{player.description || "No description provided."}&quot;
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-2">Account Created</label>
                                    <p className="text-foreground text-sm font-semibold">
                                        {new Date(player.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-card border border-border rounded-xl p-8">
                            <h3 className="text-sm font-medium text-foreground mb-6 flex items-center gap-3">
                                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                                    <ShieldIcon />
                                </div>
                                Moderation History
                            </h3>
                            {logs.length > 0 ? (
                                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {logs.map((log) => (
                                        <div key={log.id} className="bg-muted border border-border rounded-xl p-4 flex items-center justify-between group hover:bg-muted transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-2 h-2 rounded-full ${log.action === 'BAN' ? 'bg-red-500' : log.action === 'SOFTBAN' ? 'bg-rose-400' : log.action === 'KICK' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                                                <div>
                                                    <span className="text-xs font-medium text-foreground">{log.action}</span>
                                                    <p className="text-xs text-muted-foreground mt-1 font-medium">By {log.moderator} • {new Date(log.timestamp).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-mono text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
                                    <p className="text-xs font-medium text-muted-foreground">No prior history found.</p>
                                </div>
                            )}
                        </Card>

                        <Card className="bg-card border border-border rounded-xl p-8">
                            <h3 className="text-sm font-medium text-foreground mb-6 flex items-center gap-3">
                                <div className="p-2 bg-yellow-600/10 rounded-lg text-yellow-500 border border-yellow-500/10">
                                    <InfoIcon />
                                </div>
                                Staff Notes
                            </h3>
                            {staffNotes.length > 0 ? (
                                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar mb-6">
                                    {staffNotes.map((note) => (
                                        <div key={note.id} className="bg-muted border border-border rounded-xl p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap flex-1">{note.note}</p>
                                                {note.can_delete ? (
                                                    <Button variant="outline" size="default"
                                                        type="button"
                                                        onClick={() => handleDeleteNote(note.id)}
                                                        disabled={deletingNoteId === note.id}
                                                        className="shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        {deletingNoteId === note.id ? 'Deleting' : 'Delete'}
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-3 font-medium">
                                                By {note.created_by_tag || note.created_by_discord_id || 'Unknown Staff'} - {new Date(note.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center border-2 border-dashed border-border rounded-xl mb-6">
                                    <p className="text-xs font-medium text-muted-foreground">No staff notes found.</p>
                                </div>
                            )}
                            <form onSubmit={handleAddNote} className="space-y-3">
                                <Textarea
                                    value={noteText}
                                    onChange={(event) => setNoteText(event.target.value)}
                                    rows={3}
                                    maxLength={1500}
                                    className="w-full transition-all resize-none"
                                    placeholder="Add a staff-only note for this user..."
                                />
                                <Button variant="outline" size="default"
                                    type="submit"
                                    disabled={noteSaving || !noteText.trim()}
                                    className="transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {noteSaving ? "SAVING..." : "ADD NOTE"}
                                </Button>
                            </form>
                        </Card>

                        <Card className="bg-card border border-border rounded-xl p-8">
                            <h3 className="text-sm font-medium text-foreground mb-8 flex items-center gap-3">
                                <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                                    <ShieldIcon />
                                </div>
                                Quick Actions
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-4 mb-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground block">Reason</label>
                                    <Textarea
                                        value={reasonText}
                                        onChange={(event) => setReasonText(event.target.value)}
                                        rows={3}
                                        className="w-full transition-all resize-none"
                                        placeholder="Why are you taking this action?"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground block">Soft Ban Minutes</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={softBanDurationMinutes}
                                        onChange={(event) => setSoftBanDurationMinutes(event.target.value)}
                                        className="w-full transition-all"
                                    />
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Used only for Soft Ban.
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                <Button variant="outline" size="default"
                                    onClick={() => handleAction('KICK')}
                                    disabled={actionLoading || !hasActionAccess('KICK') || !presence?.inGame}
                                    className="transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    KICK PLAYER
                                </Button>
                                <Button variant="outline" size="default"
                                    onClick={() => handleAction('BAN')}
                                    disabled={actionLoading || !hasActionAccess('BAN')}
                                    className="transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    BAN PLAYER
                                </Button>
                                <Button variant="outline" size="default"
                                    onClick={() => handleAction('SOFTBAN')}
                                    disabled={actionLoading || !hasActionAccess('SOFTBAN')}
                                    className="transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    SOFT BAN
                                </Button>
                                <Button variant="outline" size="default"
                                    onClick={() => handleAction('UNBAN')}
                                    disabled={actionLoading || !hasActionAccess('UNBAN')}
                                    className="transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    UNBAN PLAYER
                                </Button>
                            </div>
                        </Card>

                        <div className="p-6 bg-accent rounded-xl border border-border flex items-start gap-4">
                            <div className="text-foreground mt-0.5">
                                <InfoIcon />
                            </div>
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                                Join Server and Presence features require the latest Kernel Update (v1.2).
                                If the player is currently in-game, you will see a &quot;LIVE&quot; badge above.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!player && !loading && (
                <div className="py-20 text-center space-y-4 max-w-md mx-auto">
                    <div className="w-16 h-16 bg-card rounded-xl flex items-center justify-center text-muted-foreground mx-auto border border-border">
                        <UserIcon />
                    </div>
                    <div>
                        <h3 className="text-foreground font-medium text-xs mb-2">Search Required</h3>
                        <p className="text-muted-foreground text-xs font-medium leading-relaxed">
                            Enter a Roblox username above to view their profile, avatar, and execute administrative actions across all game servers.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PlayerLookup() {
    return (
        <Suspense fallback={<PlayerLookupFallback />}>
            <PlayerLookupContent />
        </Suspense>
    );
}
