'use client';

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

// Icons
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);

const SaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
);

const CommandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
);

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

interface DiscordRole {
    id: string;
    name: string;
    color: number;
}

interface DashboardRole {
    id: string; // UUID
    discord_role_id: string;
    role_name: string;
    can_access_dashboard: boolean;
    can_kick: boolean;
    can_ban: boolean;
    can_timeout: boolean;
    can_mute: boolean;
    can_lookup: boolean;
    can_manage_settings: boolean;
    can_manage_reports: boolean;
    allowed_misc_cmds: string[];
}

interface DiscordChannel {
    id: string;
    name: string;
    type: number;
}

export default function SettingsPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // General Settings
    const [adminCmds, setAdminCmds] = useState(true);
    const [miscCmds, setMiscCmds] = useState(true);
    const [loggingChannelId, setLoggingChannelId] = useState("");

    // Role Management
    const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
    const [dashboardRoles, setDashboardRoles] = useState<DashboardRole[]>([]);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [selectedRoleForAdd, setSelectedRoleForAdd] = useState("");
    const [addingRole, setAddingRole] = useState(false);

    useEffect(() => {
        async function fetchData() {
            if (!id || !session) return;

            // 1. Check Permissions
            const guildRes = await fetch('/api/guilds');
            const guilds = await guildRes.json();
            const g = guilds.find((guild: any) => guild.id === id);

            if (!g || (g.permissions === "0" && (session.user as any).id === '953414442060746854')) {
                router.push(`/dashboard/${id}`);
                return;
            }

            // 2. Fetch Server Settings
            const { data, error: dbError } = await supabase
                .from('servers')
                .select('admin_cmds_enabled, misc_cmds_enabled, logging_channel_id')
                .eq('id', id)
                .single();

            if (data && !dbError) {
                setAdminCmds(data.admin_cmds_enabled !== false);
                setMiscCmds(data.misc_cmds_enabled !== false);
                setLoggingChannelId(data.logging_channel_id || "");
            }

            // 3. Fetch Discord Roles & Channels
            try {
                const [rolesRes, channelsRes] = await Promise.all([
                    fetch(`/api/discord/roles?guildId=${id}`),
                    fetch(`/api/discord/channels?guildId=${id}`)
                ]);

                if (rolesRes.ok) setDiscordRoles(await rolesRes.json());
                if (channelsRes.ok) setChannels(await channelsRes.json());

            } catch (e) {
                console.error("Failed to fetch Discord data", e);
            }

            // 4. Fetch Configured Dashboard Roles
            try {
                const dbRolesRes = await fetch(`/api/settings/roles?serverId=${id}`);
                if (dbRolesRes.ok) {
                    setDashboardRoles(await dbRolesRes.json());
                }
            } catch (e) {
                console.error("Failed to fetch configured roles", e);
            }

            setLoading(false);
        }
        fetchData();
    }, [id, session, router]);

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);

        // Save General Settings
        const { error: dbError } = await supabase
            .from('servers')
            .update({
                admin_cmds_enabled: adminCmds,
                misc_cmds_enabled: miscCmds,
                logging_channel_id: loggingChannelId || null
            })
            .eq('id', id);

        // Save Roles Logic (In this simplified view, we save roles as they are modified, but general settings on Save)
        // Actually, let's keep role editing separate to avoid complex state management
        // Roles are saved immediately when modified in the UI below, or we could batch them.
        // For simplicity, let's just save general settings here.

        if (dbError) {
            setError(dbError.message);
        } else {
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        }
        setSaving(false);
    }

    async function handleAddRole() {
        if (!selectedRoleForAdd) return;
        setAddingRole(true);
        const role = discordRoles.find(r => r.id === selectedRoleForAdd);
        if (!role) return;

        // Check if already exists
        if (dashboardRoles.some(r => r.discord_role_id === role.id)) {
            alert("Role already configured!");
            setAddingRole(false);
            return;
        }

        // Add to DB
        try {
            const res = await fetch('/api/settings/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    discordRoleId: role.id,
                    roleName: role.name,
                    permissions: {
                        access_dashboard: false,
                        kick: false,
                        ban: false,
                        timeout: false,
                        mute: false,
                        lookup: false,
                        manage_settings: false,
                        manage_reports: false
                    },
                    miscCmds: []
                })
            });

            if (res.ok) {
                const newRole = await res.json();
                setDashboardRoles([...dashboardRoles, newRole]);
                setSelectedRoleForAdd("");
            } else {
                alert("Failed to add role");
            }
        } catch (e) {
            console.error(e);
        }
        setAddingRole(false);
    }

    async function handleUpdateRole(role: DashboardRole, field: keyof DashboardRole, value: any) {
        // Optimistic UI Update
        const updatedRoles = dashboardRoles.map(r => r.id === role.id ? { ...r, [field]: value } : r);
        setDashboardRoles(updatedRoles);

        // Current state of the role being updated
        const targetRole = updatedRoles.find(r => r.id === role.id);
        if (!targetRole) return;

        // Save to DB
        try {
            await fetch('/api/settings/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    discordRoleId: targetRole.discord_role_id,
                    roleName: targetRole.role_name,
                    permissions: {
                        access_dashboard: targetRole.can_access_dashboard,
                        kick: targetRole.can_kick,
                        ban: targetRole.can_ban,
                        timeout: targetRole.can_timeout,
                        mute: targetRole.can_mute,
                        lookup: targetRole.can_lookup,
                        manage_settings: targetRole.can_manage_settings,
                        manage_reports: targetRole.can_manage_reports
                    },
                    miscCmds: targetRole.allowed_misc_cmds
                })
            });
        } catch (e) {
            console.error("Failed to update role", e);
            // Revert on error? For now, we assume success or user refreshes.
        }
    }

    async function handleDeleteRole(roleId: string) {
        if (!confirm("Are you sure you want to remove this role configuration?")) return;

        // Optimistic Remove
        setDashboardRoles(dashboardRoles.filter(r => r.id !== roleId));

        try {
            await fetch(`/api/settings/roles?id=${roleId}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Failed to delete role", e);
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full pb-20">
            {/* Page Header */}
            <div className="mb-10 pb-8 border-b border-slate-800/60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-sky-600/10 rounded-2xl flex items-center justify-center text-sky-500 border border-sky-500/20 shadow-2xl shadow-sky-900/10">
                            <SettingsIcon />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">General Settings</h1>
                            <p className="text-slate-500 text-sm font-medium mt-1">Configure global server behavior and command permissions.</p>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="hidden md:flex bg-sky-600 hover:bg-sky-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-sky-900/20 text-xs disabled:opacity-50 items-center justify-center gap-3 active:scale-95 border border-sky-400/20"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <SaveIcon />
                                SAVE CHANGES
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Main Settings Column */}
                <div className="col-span-12 lg:col-span-8 space-y-12">

                    {/* Game Connection Card (Setup Wizard Link) */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Game Connection</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm mt-1">
                                    Configure Roblox place IDs, API keys, and install the game script.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push(`/dashboard/${id}/settings/setup`)}
                            className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-lg border border-slate-700 uppercase tracking-widest text-xs flex items-center justify-center gap-3 group-hover:border-emerald-500/50 group-hover:text-emerald-400"
                        >
                            Manage Connection
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                        </button>
                    </div>

                    {/* --- ROLE PERMISSIONS SECTION (NEW) --- */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 backdrop-blur-sm relative overflow-hidden">
                        <div className="flex items-start gap-6 mb-8">
                            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 border border-purple-500/10">
                                <ShieldIcon />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Role Permissions</h3>
                                <p className="text-sm text-slate-500 leading-relaxed max-w-lg">
                                    Assign specific dashboard and in-game capabilities to Discord roles.
                                </p>
                            </div>
                        </div>

                        {/* Add Role Section */}
                        <div className="flex gap-4 mb-8 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                            <select
                                value={selectedRoleForAdd}
                                onChange={(e) => setSelectedRoleForAdd(e.target.value)}
                                className="flex-1 bg-black/40 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-medium"
                            >
                                <option value="">Select a Discord Role...</option>
                                {discordRoles
                                    .filter(dr => !dashboardRoles.some(dbr => dbr.discord_role_id === dr.id) && dr.name !== '@everyone')
                                    .map(role => (
                                        <option key={role.id} value={role.id} style={{ color: role.color ? `#${role.color.toString(16)}` : 'white' }}>
                                            {role.name}
                                        </option>
                                    ))}
                            </select>
                            <button
                                onClick={handleAddRole}
                                disabled={!selectedRoleForAdd || addingRole}
                                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg text-xs transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {addingRole ? "Adding..." : "Add Role"}
                            </button>
                        </div>

                        {/* Roles List */}
                        <div className="space-y-4">
                            {dashboardRoles.map(role => (
                                <div key={role.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-6 transition-all hover:bg-slate-900/40">
                                    <div className="flex items-center justify-between mb-6 border-b border-slate-800/50 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                                                #
                                            </div>
                                            <span className="text-sm font-bold text-white tracking-wide">{role.role_name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteRole(role.id)}
                                            className="text-slate-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                                            title="Remove Configuration"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>

                                    {/* Permissions Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {[
                                            { key: 'can_access_dashboard', label: 'Dashboard Access' },
                                            { key: 'can_manage_settings', label: 'Manage Settings' },
                                            { key: 'can_manage_reports', label: 'Manage Reports' },
                                            { key: 'can_lookup', label: 'Lookup Users' },
                                            { key: 'can_kick', label: 'Kick Users' },
                                            { key: 'can_ban', label: 'Ban Users' },
                                            { key: 'can_timeout', label: 'Timeout/Softban' },
                                            { key: 'can_mute', label: 'Server Mute' },
                                        ].map((perm) => (
                                            <label key={perm.key} className="flex items-center gap-3 cursor-pointer group select-none">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                                    // @ts-ignore
                                                    role[perm.key] ? 'bg-purple-600 border-purple-500' : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'
                                                    }`}>
                                                    {/* @ts-ignore */
                                                        role[perm.key] && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12" /></svg>
                                                        )}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    // @ts-ignore
                                                    checked={role[perm.key]}
                                                    // @ts-ignore
                                                    onChange={(e) => handleUpdateRole(role, perm.key, e.target.checked)}
                                                />
                                                <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                                                    // @ts-ignore
                                                    role[perm.key] ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'
                                                    }`}>
                                                    {perm.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    {/* Misc Commands Input */}
                                    <div className="mt-6 pt-4 border-t border-slate-800/50">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                                            Misc Commands (Comma Separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={role.allowed_misc_cmds?.join(", ") || ""}
                                            onChange={(e) => handleUpdateRole(role, 'allowed_misc_cmds', e.target.value.split(",").map(s => s.trim()).filter(s => s))}
                                            placeholder="e.g. fly, heal, tp (or * for all)"
                                            className="w-full bg-black/20 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500 transition-colors"
                                        />
                                        <p className="text-[9px] text-slate-600 mt-1.5">Enter specific commands this role can use (e.g., 'fly', 'heal') or '*' for all available misc commands.</p>
                                    </div>
                                </div>
                            ))}

                            {dashboardRoles.length === 0 && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No roles configured yet.</p>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Command Config Section */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 backdrop-blur-sm relative overflow-hidden">
                        <div className="flex items-start gap-6 mb-8">
                            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-500 border border-sky-500/10">
                                <CommandIcon />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Global Command Modules</h3>
                                <p className="text-sm text-slate-500 leading-relaxed max-w-lg">Enable or disable specific command categories server-wide. Disabled commands will not function in-game regardless of role.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {/* Admin Commands Toggle */}
                            <div className="flex items-center justify-between p-6 bg-slate-950/40 border border-slate-800 rounded-2xl">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-tight">Admin Commands</h4>
                                    <p className="text-[11px] text-slate-500 font-medium mt-1">Kick, Ban, Unban, Shutdown, Update</p>
                                </div>
                                <button
                                    onClick={() => setAdminCmds(!adminCmds)}
                                    className={`w-14 h-7 rounded-full transition-all duration-500 relative border-2 ${adminCmds ? 'bg-sky-600/20 border-sky-500 shadow-[0_0_15px_rgba(2,132,199,0.2)]' : 'bg-slate-800/40 border-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3.5 h-3.5 rounded-full transition-all duration-500 shadow-md ${adminCmds ? 'left-8 bg-sky-500' : 'left-1.5 bg-slate-500'}`} />
                                </button>
                            </div>

                            {/* Misc Commands Toggle */}
                            <div className="flex items-center justify-between p-6 bg-slate-950/40 border border-slate-800 rounded-2xl">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-tight">Misc Commands</h4>
                                    <p className="text-[11px] text-slate-500 font-medium mt-1">Fly, Noclip, Heal, Teleport, etc.</p>
                                </div>
                                <button
                                    onClick={() => setMiscCmds(!miscCmds)}
                                    className={`w-14 h-7 rounded-full transition-all duration-500 relative border-2 ${miscCmds ? 'bg-sky-600/20 border-sky-500 shadow-[0_0_15px_rgba(2,132,199,0.2)]' : 'bg-slate-800/40 border-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3.5 h-3.5 rounded-full transition-all duration-500 shadow-md ${miscCmds ? 'left-8 bg-sky-500' : 'left-1.5 bg-slate-500'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-12 md:hidden">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-sky-900/10 text-xs disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                            >
                                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "SAVE SETTINGS"}
                            </button>
                        </div>
                    </div>

                    {/* Logging Config Section */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 backdrop-blur-sm relative overflow-hidden">
                        <div className="flex items-start gap-6 mb-8">
                            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Audit Logging</h3>
                                <p className="text-sm text-slate-500 leading-relaxed max-w-lg">Select a Discord channel where administrative actions and reports will be logged.</p>
                            </div>
                        </div>

                        <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Logging Channel</label>
                            <select
                                value={loggingChannelId}
                                onChange={(e) => setLoggingChannelId(e.target.value)}
                                className="w-full bg-black/40 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                            >
                                <option value="">Disabled (No Logging)</option>
                                {channels.map(channel => (
                                    <option key={channel.id} value={channel.id}>
                                        #{channel.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Status Box */}
                    <div className="p-8 bg-slate-900/20 border border-slate-800 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/10">
                                <InfoIcon />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-tight">System Status</h4>
                                <p className="text-[11px] text-slate-500 font-medium tracking-tight mt-0.5">Settings changes propagate to game servers within ~30 seconds.</p>
                            </div>
                        </div>
                        {success && (
                            <div className="flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">Changes Saved</span>
                            </div>
                        )}
                        {error && <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">{error}</span>}
                    </div>
                </div>

                {/* Info Column */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8">
                        <h4 className="text-xs font-bold text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                            <span className="w-6 h-px bg-sky-600"></span>
                            Information
                        </h4>
                        <div className="space-y-6">
                            {[
                                { title: "Admin Commands", text: "Essential moderation tools. Disabling this prevents any kick/ban actions from Discord." },
                                { title: "Misc Commands", text: "Fun and utility commands. Can be disabled if they interfere with gameplay." },
                            ].map((item, i) => (
                                <div key={i} className="group">
                                    <h5 className="text-xs font-bold text-sky-500 mb-1 group-hover:text-sky-400 transition-colors uppercase tracking-wide">
                                        {item.title}
                                    </h5>
                                    <p className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors">
                                        {item.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
