'use client';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import { Search as LucideSearch, User as LucideUser, WandSparkles as LucideWandSparkles } from 'lucide-react';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
    canUseDashboardCommand,
    getAdminPanelCommandDefinition,
    MISC_ACTION_COMMAND_IDS,
    VALUE_INPUT_COMMAND_IDS,
} from "@/lib/adminPanelCommands";
import { normalizeLivePlayerList } from "@/lib/livePlayers";
import { usePermissions } from "@/context/PermissionsContext";

interface LiveServer {
    id: string;
    players?: unknown;
}

interface PlayerSummary {
    name: string;
    displayName: string;
    userId: string | null;
    avatarUrl: string | null;
    serverId: string;
}

const VALUE_INPUT_CONFIG: Record<string, { prompt: string; defaultValue: string }> = {
    DAMAGE: {
        prompt: 'Enter damage amount to apply:',
        defaultValue: '25',
    },
    MAX_HEALTH: {
        prompt: 'Enter the max health value:',
        defaultValue: '100',
    },
    WALK_SPEED: {
        prompt: 'Enter the walk speed value:',
        defaultValue: '16',
    },
    JUMP_POWER: {
        prompt: 'Enter the jump power value:',
        defaultValue: '50',
    },
    TEAM: {
        prompt: 'Enter the Roblox team name:',
        defaultValue: '',
    },
};

const VALUE_COMMAND_SET = new Set<string>(VALUE_INPUT_COMMAND_IDS);

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function getCommandLabel(commandId: string) {
    return getAdminPanelCommandDefinition(commandId)?.label || commandId.replace(/_/g, ' ');
}

function getActionButtonClasses(commandId: string) {
    if (commandId === 'KILL') {
        return 'bg-red-50 dark:bg-red-950/30 hover:bg-red-500 text-red-700 dark:text-red-400 hover:text-foreground border-red-200 dark:border-red-900';
    }

    if (commandId === 'HEAL' || commandId === 'UNFREEZE' || commandId === 'FORCEFIELD_ADD') {
        return 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-400 hover:text-foreground border-emerald-200 dark:border-emerald-900';
    }

    if (commandId === 'FREEZE' || commandId === 'RAGDOLL' || commandId === 'FORCEFIELD_REMOVE') {
        return 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-foreground border-amber-200 dark:border-amber-900';
    }

    if (VALUE_COMMAND_SET.has(commandId) || commandId === 'SET_CHAR' || commandId === 'TEAM') {
        return 'bg-violet-500/10 hover:bg-violet-500 text-violet-400 hover:text-foreground border-violet-500/20';
    }

    return 'bg-muted hover:bg-primary text-foreground border-border';
}

const MagicIcon = () => (
    <LucideWandSparkles width="18" height="18" strokeWidth="2" />
);

const UserIcon = () => (
    <LucideUser width="14" height="14" strokeWidth="2" />
);

const SearchIcon = () => (
    <LucideSearch width="16" height="16" strokeWidth="2" />
);

export default function MiscPage() {
    const { id: guildId } = useParams();
    const [players, setPlayers] = useState<PlayerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const perms = usePermissions();

    useEffect(() => {
        async function fetchPlayers() {
            if (!guildId) return;

            const response = await fetch(`/api/dashboard/live-servers?serverId=${encodeURIComponent(String(guildId))}`, {
                cache: 'no-store',
            });

            if (response.ok) {
                const data = await response.json();
                const allPlayers: PlayerSummary[] = [];
                data.forEach((server: LiveServer) => {
                    normalizeLivePlayerList(server.players).forEach((player) => {
                        allPlayers.push({
                            name: player.username,
                            displayName: player.displayName,
                            userId: player.userId,
                            avatarUrl: player.avatarUrl,
                            serverId: server.id,
                        });
                    });
                });

                setPlayers(allPlayers);
            }

            setLoading(false);
        }

        fetchPlayers();
        const interval = setInterval(fetchPlayers, 15000);
        return () => clearInterval(interval);
    }, [guildId]);

    async function handleAction(target: string, action: string) {
        if (!guildId) return;

        if (!canUseDashboardCommand(perms, action)) {
            alert("You do not have permission to use this command.");
            return;
        }

        const extraArgs: Record<string, unknown> = {};

        if (action === 'SET_CHAR') {
            const charUser = trimString(prompt(`Enter the Roblox username to copy onto ${target}:`, ''));
            if (!charUser) {
                return;
            }
            extraArgs.char_user = charUser;
        }

        if (VALUE_COMMAND_SET.has(action)) {
            const config = VALUE_INPUT_CONFIG[action];
            const amount = trimString(prompt(config.prompt, config.defaultValue));
            if (!amount) {
                return;
            }
            extraArgs.amount = amount;
        }

        if (action === 'TEAM') {
            const config = VALUE_INPUT_CONFIG.TEAM;
            const teamName = trimString(prompt(config.prompt, config.defaultValue));
            if (!teamName) {
                return;
            }
            extraArgs.team_name = teamName;
        }

        setActionLoading(`${target}-${action}`);

        const res = await fetch('/api/dashboard/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: guildId,
                command: action,
                args: {
                    username: target,
                    ...extraArgs,
                },
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert("Error: " + (data.error || 'Failed to send command.'));
        }

        setActionLoading(null);
    }

    function renderActions(target: string) {
        const availableActions = [...MISC_ACTION_COMMAND_IDS].filter((action) => canUseDashboardCommand(perms, action));
        const instantActions = availableActions.filter((action) => action !== 'SET_CHAR' && action !== 'TEAM' && !VALUE_COMMAND_SET.has(action));
        const promptedActions = availableActions.filter((action) => action === 'SET_CHAR' || action === 'TEAM' || VALUE_COMMAND_SET.has(action));

        return (
            <div className="space-y-3">
                {instantActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {instantActions.map((action) => (
                            <Button variant="outline" size="default"
                                key={action}
                                disabled={actionLoading === `${target}-${action}`}
                                onClick={() => handleAction(target, action)}
                                className={`       transition-all  disabled:opacity-50 ${getActionButtonClasses(action)}`}
                            >
                                {actionLoading === `${target}-${action}` ? "..." : getCommandLabel(action)}
                            </Button>
                        ))}
                    </div>
                )}

                {promptedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {promptedActions.map((action) => (
                            <Button variant="outline" size="default"
                                key={action}
                                disabled={actionLoading === `${target}-${action}`}
                                onClick={() => handleAction(target, action)}
                                className={`       transition-all  disabled:opacity-50 ${getActionButtonClasses(action)}`}
                            >
                                {actionLoading === `${target}-${action}` ? "..." : getCommandLabel(action)}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (loading) return null;

    const query = trimString(searchQuery).toLowerCase();
    const filteredPlayers = players.filter((player) =>
        player.name.toLowerCase().includes(query)
        || player.displayName.toLowerCase().includes(query),
    );

    const isManualTarget = query.length > 0 && !players.some((player) => player.name.toLowerCase() === query);

    return (
        <div className="space-y-10 max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1 text-left">
                <h1 className="text-2xl font-medium text-foreground tracking-tight flex items-center gap-3">
                    <span className="p-2 bg-accent rounded-lg text-foreground border border-border">
                        <MagicIcon />
                    </span>
                    Miscellaneous Actions
                </h1>
                <p className="text-muted-foreground text-sm font-medium">Run every non-global admin panel command that targets a live player.</p>
            </div>

            <div className="w-full">
                <Card className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
                            <SearchIcon />
                        </div>
                        <Input
                            type="text"
                            placeholder="Search live players or enter a username for a manual target..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="w-full transition-all"
                        />
                    </div>
                </Card>

                <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[400px]">
                    <div className="px-6 py-4 border-b border-border bg-card flex justify-between items-center">
                        <h2 className="text-xs font-medium text-foreground">
                            {searchQuery ? `Search Results (${filteredPlayers.length})` : `Active Players (${players.length})`}
                        </h2>
                    </div>

                    <div className="divide-y divide-border max-h-[700px] overflow-y-auto custom-scrollbar">
                        {isManualTarget && (
                            <div className="p-6 bg-accent border-b border-border">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="px-2 py-0.5 bg-primary text-foreground text-xs font-semibold rounded">Manual Target</div>
                                    <h3 className="font-medium text-foreground text-sm">{searchQuery}</h3>
                                </div>
                                {renderActions(searchQuery)}
                            </div>
                        )}

                        {filteredPlayers.length === 0 && !isManualTarget ? (
                            <div className="p-20 text-center text-muted-foreground font-medium text-xs">
                                {searchQuery ? "No matching players found." : "No players online."}
                            </div>
                        ) : (
                            filteredPlayers.map((player) => (
                                <div key={`${player.name}-${player.serverId}`} className="p-6 hover:bg-accent transition-all">
                                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                                        <div className="flex items-center gap-4 min-w-0">
                                            {player.avatarUrl ? (
                                                <img
                                                    src={player.avatarUrl}
                                                    alt={player.name}
                                                    className="w-10 h-10 rounded-full border border-border bg-card object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
                                                    <UserIcon />
                                                </div>
                                            )}

                                            <div className="min-w-0">
                                                <Link
                                                    href={`/dashboard/${guildId}/players/${encodeURIComponent(player.name)}`}
                                                    className="font-medium text-foreground text-sm hover:text-foreground transition-colors"
                                                >
                                                    {player.displayName}
                                                </Link>
                                                <p className="truncate text-xs font-mono text-muted-foreground">
                                                    @{player.name} • {player.userId || 'NO ID'} • SERVER: {player.serverId.substring(0, 8)}...
                                                </p>
                                            </div>
                                        </div>

                                        <div className="max-w-4xl xl:text-right">
                                            {renderActions(player.name)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
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
