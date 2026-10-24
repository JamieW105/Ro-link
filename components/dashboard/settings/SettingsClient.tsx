'use client';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Status, StatusLabel } from '@/components/ui/status';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

import { Switch } from '@/components/ui/switch';

import { Checkbox } from '@/components/ui/checkbox';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


import { Select } from '@/components/ui/select';

import { ArrowRight as LucideArrowRight, ChevronDown as LucideChevronDown, X as LucideX } from 'lucide-react';

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
    ADMIN_PANEL_COMMAND_GROUPS,
    ADMIN_PANEL_COMMAND_IDS,
    hasAdminPanelCommandAccess,
    normalizeAdminPanelCommandList,
} from "@/lib/adminPanelCommands";
import {
    CUSTOM_DASHBOARD_LAYOUTS,
    CUSTOM_DASHBOARD_THEMES,
    DEFAULT_CUSTOM_DASHBOARD_LAYOUT,
    DEFAULT_CUSTOM_DASHBOARD_THEME,
    type CustomDashboardLayout,
    type CustomDashboardMetadata,
    type CustomDashboardTheme,
} from "@/lib/customDashboardSettings";
import { useSession } from "next-auth/react";
import { Command, FileText, Hash, KeyRound, LayoutTemplate, Plus, Save, ScrollText, Shield, Trash2, TriangleAlert, Users } from "lucide-react";

const SaveIcon = () => <Save size={18} aria-hidden="true" />;
const TrashIcon = () => <Trash2 size={14} aria-hidden="true" />;

interface DiscordRole {
    id: string;
    name: string;
    color: number;
}

interface GuildSummary {
    id: string;
    permissions: string;
}

interface DashboardRole {
    id: string; // UUID
    discord_role_id: string;
    role_name: string;
    can_access_dashboard: boolean;
    can_access_live_panel: boolean;
    can_kick: boolean;
    can_ban: boolean;
    can_timeout: boolean;
    can_mute: boolean;
    can_lookup: boolean;
    can_manage_settings: boolean;
    can_manage_reports: boolean;
    can_view_logs: boolean;
    can_view_runtime_logs: boolean;
    can_manage_staff_notes: boolean;
    can_view_staff_shifts: boolean;
    can_manage_staff_shifts: boolean;
    allowed_misc_cmds: string[];
}

type DashboardRoleBooleanField =
    | 'can_access_dashboard'
    | 'can_access_live_panel'
    | 'can_manage_settings'
    | 'can_manage_reports'
    | 'can_view_logs'
    | 'can_view_runtime_logs'
    | 'can_manage_staff_notes'
    | 'can_view_staff_shifts'
    | 'can_manage_staff_shifts'
    | 'can_lookup'
    | 'can_kick'
    | 'can_ban'
    | 'can_timeout'
    | 'can_mute';

const ROLE_PERMISSION_OPTIONS: Array<{ key: DashboardRoleBooleanField; label: string }> = [
    { key: 'can_access_dashboard', label: 'Dashboard Access' },
    { key: 'can_access_live_panel', label: 'Live Panel' },
    { key: 'can_manage_settings', label: 'Manage Settings' },
    { key: 'can_manage_reports', label: 'Manage Reports' },
    { key: 'can_view_logs', label: 'View /cmds Logs' },
    { key: 'can_view_runtime_logs', label: 'View In-Game Console Logs' },
    { key: 'can_manage_staff_notes', label: 'Manage Staff Notes' },
    { key: 'can_view_staff_shifts', label: 'View Staff Shifts' },
    { key: 'can_manage_staff_shifts', label: 'Manage Staff Shift Settings' },
    { key: 'can_lookup', label: 'Lookup Users' },
    { key: 'can_kick', label: 'Kick Users' },
    { key: 'can_ban', label: 'Ban Users' },
    { key: 'can_timeout', label: 'Timeout/Softban' },
    { key: 'can_mute', label: 'Server Mute' },
];

interface DiscordChannel {
    id: string;
    name: string;
    type: number;
}

interface ServerSettingsConfig {
    admin_cmds_enabled?: boolean | null;
    misc_cmds_enabled?: boolean | null;
    logging_channel_id?: string | null;
    reports_enabled?: boolean | null;
    reports_channel_id?: string | null;
}

interface CustomDashboardSettings {
    id?: string | null;
    server_id: string;
    subdomain: string;
    hostname: string;
    hostnames: string[];
    layout: CustomDashboardLayout;
    theme: CustomDashboardTheme;
    metadata: CustomDashboardMetadata;
}

type SettingsView = 'overview' | 'roles' | 'commands' | 'logging' | 'reports' | 'dashboard';

interface SavedSettingsSnapshot {
    adminCmds: boolean;
    miscCmds: boolean;
    loggingChannelId: string;
    reportsEnabled: boolean;
    reportsChannelId: string;
    customDashboardSubdomain: string;
    customDashboardLayout: CustomDashboardLayout;
    customDashboardTheme: CustomDashboardTheme;
    customDashboardMetadata: CustomDashboardMetadata;
}

interface SettingsClientProps {
    view?: SettingsView;
}

const PAGE_COPY: Record<SettingsView, { title: string; description: string }> = {
    overview: {
        title: 'Settings',
        description: 'Choose a settings area to configure. Removal controls stay here for extra visibility.',
    },
    roles: {
        title: 'Role Permissions',
        description: 'Assign dashboard and in-game permissions to Discord roles.',
    },
    commands: {
        title: 'Command Modules',
        description: 'Enable or disable global command categories for this server.',
    },
    logging: {
        title: 'Audit Logging',
        description: 'Choose where moderation and administrative actions are logged.',
    },
    reports: {
        title: 'Report System',
        description: 'Configure player reports and where report notifications are delivered.',
    },
    dashboard: {
        title: 'Custom Dashboard',
        description: 'Control the custom dashboard URL, layout, theme, and public sign-in metadata.',
    },
};

const EMPTY_CUSTOM_DASHBOARD_METADATA: CustomDashboardMetadata = {
    title: "",
    description: "",
    logoUrl: "",
    supportUrl: "",
};

const DEFAULT_SAVED_SETTINGS: SavedSettingsSnapshot = {
    adminCmds: true,
    miscCmds: true,
    loggingChannelId: "",
    reportsEnabled: false,
    reportsChannelId: "",
    customDashboardSubdomain: "",
    customDashboardLayout: DEFAULT_CUSTOM_DASHBOARD_LAYOUT,
    customDashboardTheme: DEFAULT_CUSTOM_DASHBOARD_THEME,
    customDashboardMetadata: EMPTY_CUSTOM_DASHBOARD_METADATA,
};

function normalizeDashboardMetadata(metadata?: Partial<CustomDashboardMetadata> | null): CustomDashboardMetadata {
    return {
        title: metadata?.title || "",
        description: metadata?.description || "",
        logoUrl: metadata?.logoUrl || "",
        supportUrl: metadata?.supportUrl || "",
    };
}

function getComparableSettingsForView(settings: SavedSettingsSnapshot, view: SettingsView) {
    if (view === 'commands') {
        return {
            adminCmds: settings.adminCmds,
            miscCmds: settings.miscCmds,
        };
    }

    if (view === 'logging') {
        return {
            loggingChannelId: settings.loggingChannelId,
        };
    }

    if (view === 'reports') {
        return {
            reportsEnabled: settings.reportsEnabled,
            reportsChannelId: settings.reportsChannelId,
        };
    }

    if (view === 'dashboard') {
        return {
            customDashboardSubdomain: settings.customDashboardSubdomain.trim(),
            customDashboardLayout: settings.customDashboardLayout,
            customDashboardTheme: settings.customDashboardTheme,
            customDashboardMetadata: settings.customDashboardMetadata,
        };
    }

    return {};
}

export default function SettingsClient({ view = 'overview' }: SettingsClientProps) {
    const { id } = useParams();
    const { data: session } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [savedSettings, setSavedSettings] = useState<SavedSettingsSnapshot | null>(null);
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [removeBotOption, setRemoveBotOption] = useState(true);
    const [deleteDataOption, setDeleteDataOption] = useState(false);
    const [removingRoLink, setRemovingRoLink] = useState(false);
    const [removeActionError, setRemoveActionError] = useState<string | null>(null);

    // General Settings
    const [adminCmds, setAdminCmds] = useState(true);
    const [miscCmds, setMiscCmds] = useState(true);
    const [loggingChannelId, setLoggingChannelId] = useState("");
    const [reportsEnabled, setReportsEnabled] = useState(false);
    const [reportsChannelId, setReportsChannelId] = useState("");
    const [customDashboardSubdomain, setCustomDashboardSubdomain] = useState("");
    const [customDashboardLayout, setCustomDashboardLayout] = useState<CustomDashboardLayout>(DEFAULT_CUSTOM_DASHBOARD_LAYOUT);
    const [customDashboardTheme, setCustomDashboardTheme] = useState<CustomDashboardTheme>(DEFAULT_CUSTOM_DASHBOARD_THEME);
    const [customDashboardMetadata, setCustomDashboardMetadata] = useState<CustomDashboardMetadata>({
        title: "",
        description: "",
        logoUrl: "",
        supportUrl: "",
    });
    const [customDashboardHostnames, setCustomDashboardHostnames] = useState<string[]>([]);
    const [currentHostname, setCurrentHostname] = useState("");
    const [hasCustomDashboardSetup, setHasCustomDashboardSetup] = useState(false);

    // Role Management
    const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
    const [dashboardRoles, setDashboardRoles] = useState<DashboardRole[]>([]);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [selectedRoleForAdd, setSelectedRoleForAdd] = useState("");
    const [addingRole, setAddingRole] = useState(false);
    const [roleToRemove, setRoleToRemove] = useState<DashboardRole | null>(null);
    const [collapsedRoleIds, setCollapsedRoleIds] = useState<string[]>([]);

    const isLoggingChannelAccessible = !loggingChannelId || channels.some(channel => channel.id === loggingChannelId);
    const isReportsChannelAccessible = !reportsChannelId || channels.some(channel => channel.id === reportsChannelId);

    function getRolePanelCommands(role: DashboardRole) {
        return normalizeAdminPanelCommandList(role.allowed_misc_cmds);
    }

    function handleReplaceRoleCommands(role: DashboardRole, commands: string[]) {
        handleUpdateRole(role, 'allowed_misc_cmds', normalizeAdminPanelCommandList(commands));
    }

    function handleToggleRoleAllCommands(role: DashboardRole) {
        const currentCommands = getRolePanelCommands(role);
        if (currentCommands.includes('*')) {
            handleReplaceRoleCommands(role, []);
            return;
        }

        handleReplaceRoleCommands(role, ['*']);
    }

    function handleToggleRoleCommand(role: DashboardRole, commandId: string) {
        const currentCommands = getRolePanelCommands(role);

        if (currentCommands.includes('*')) {
            handleReplaceRoleCommands(
                role,
                ADMIN_PANEL_COMMAND_IDS.filter((id) => id !== commandId),
            );
            return;
        }

        if (currentCommands.includes(commandId)) {
            handleReplaceRoleCommands(
                role,
                currentCommands.filter((id) => id !== commandId),
            );
            return;
        }

        const nextCommands = [...currentCommands, commandId];
        if (nextCommands.length >= ADMIN_PANEL_COMMAND_IDS.length) {
            handleReplaceRoleCommands(role, ['*']);
            return;
        }

        handleReplaceRoleCommands(role, nextCommands);
    }

    function getRolePermissionCount(role: DashboardRole) {
        const basePermissionCount = ROLE_PERMISSION_OPTIONS.reduce((count, perm) => (
            role[perm.key] ? count + 1 : count
        ), 0);
        const roleCommands = getRolePanelCommands(role);
        const commandCount = roleCommands.includes('*') ? ADMIN_PANEL_COMMAND_IDS.length : roleCommands.length;
        return basePermissionCount + commandCount;
    }

    function toggleRoleCollapsed(roleId: string) {
        setCollapsedRoleIds((currentRoleIds) => (
            currentRoleIds.includes(roleId)
                ? currentRoleIds.filter((currentRoleId) => currentRoleId !== roleId)
                : [...currentRoleIds, roleId]
        ));
    }

    function updateCustomDashboardMetadata(field: keyof CustomDashboardMetadata, value: string) {
        setCustomDashboardMetadata((current) => ({
            ...current,
            [field]: value,
        }));
    }

    useEffect(() => {
        setCurrentHostname(window.location.hostname.toLowerCase());
    }, []);

    useEffect(() => {
        if (view !== 'dashboard' || !hasCustomDashboardSetup) return;

        window.dispatchEvent(new CustomEvent('rolink:custom-dashboard-preview', {
            detail: {
                layout: customDashboardLayout,
                theme: customDashboardTheme,
                metadata: customDashboardMetadata,
            },
        }));

        return () => {
            window.dispatchEvent(new CustomEvent('rolink:custom-dashboard-preview', { detail: null }));
        };
    }, [customDashboardLayout, customDashboardMetadata, customDashboardTheme, hasCustomDashboardSetup, view]);

    useEffect(() => {
        async function fetchData() {
            if (!id || !session) return;
            const sessionUserId = String((session.user as { id?: string }).id || "");
            let nextSavedSettings: SavedSettingsSnapshot = { ...DEFAULT_SAVED_SETTINGS };

            // 1. Check Permissions
            const guildRes = await fetch('/api/guilds');
            const guilds = await guildRes.json() as GuildSummary[];
            const g = guilds.find((guild) => guild.id === id);

            if (!g || (g.permissions === "0" && sessionUserId === '953414442060746854')) {
                router.push(`/dashboard/${id}`);
                return;
            }

            // 2. Fetch Server Settings
            const settingsRes = await fetch(`/api/dashboard/server-config?serverId=${encodeURIComponent(String(id))}`, {
                cache: 'no-store',
            });
            const data = settingsRes.ok ? await settingsRes.json() as ServerSettingsConfig | null : null;

            if (data) {
                const nextAdminCmds = data.admin_cmds_enabled !== false;
                const nextMiscCmds = data.misc_cmds_enabled !== false;
                const nextLoggingChannelId = data.logging_channel_id || "";
                const nextReportsEnabled = data.reports_enabled || false;
                const nextReportsChannelId = data.reports_channel_id || "";

                setAdminCmds(nextAdminCmds);
                setMiscCmds(nextMiscCmds);
                setLoggingChannelId(nextLoggingChannelId);
                setReportsEnabled(nextReportsEnabled);
                setReportsChannelId(nextReportsChannelId);
                nextSavedSettings = {
                    ...nextSavedSettings,
                    adminCmds: nextAdminCmds,
                    miscCmds: nextMiscCmds,
                    loggingChannelId: nextLoggingChannelId,
                    reportsEnabled: nextReportsEnabled,
                    reportsChannelId: nextReportsChannelId,
                };
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

            if (view === 'overview' || view === 'dashboard') {
                try {
                    const dashboardRes = await fetch(`/api/dashboard/custom-dashboard?serverId=${encodeURIComponent(String(id))}`, {
                        cache: 'no-store',
                    });

                    if (dashboardRes.ok) {
                        const dashboardSettings = await dashboardRes.json() as CustomDashboardSettings;
                        const nextDashboardMetadata = normalizeDashboardMetadata(dashboardSettings.metadata);

                        setHasCustomDashboardSetup(Boolean(dashboardSettings.id));
                        setCustomDashboardSubdomain(dashboardSettings.subdomain || "");
                        setCustomDashboardLayout(dashboardSettings.layout || DEFAULT_CUSTOM_DASHBOARD_LAYOUT);
                        setCustomDashboardTheme(dashboardSettings.theme || DEFAULT_CUSTOM_DASHBOARD_THEME);
                        setCustomDashboardMetadata(nextDashboardMetadata);
                        setCustomDashboardHostnames(dashboardSettings.hostnames || []);
                        nextSavedSettings = {
                            ...nextSavedSettings,
                            customDashboardSubdomain: dashboardSettings.subdomain || "",
                            customDashboardLayout: dashboardSettings.layout || DEFAULT_CUSTOM_DASHBOARD_LAYOUT,
                            customDashboardTheme: dashboardSettings.theme || DEFAULT_CUSTOM_DASHBOARD_THEME,
                            customDashboardMetadata: nextDashboardMetadata,
                        };
                    } else {
                        setHasCustomDashboardSetup(false);
                        if (view === 'dashboard') {
                            router.replace(`/dashboard/${id}/settings`);
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch custom dashboard settings", e);
                    setHasCustomDashboardSetup(false);
                    if (view === 'dashboard') {
                        router.replace(`/dashboard/${id}/settings`);
                        return;
                    }
                }
            }

            setSavedSettings(nextSavedSettings);
            setLoading(false);
        }
        fetchData();
    }, [id, session, router, view]);

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);

        if (view === 'logging' && loggingChannelId && !channels.some((channel) => channel.id === loggingChannelId)) {
            setError('The selected logging channel is not accessible to the bot anymore. Choose another channel and save again.');
            setSaving(false);
            return;
        }

        if (view === 'reports' && reportsChannelId && !channels.some((channel) => channel.id === reportsChannelId)) {
            setError('The selected reports channel is not accessible to the bot anymore. Choose another channel and save again.');
            setSaving(false);
            return;
        }

        if (view === 'dashboard') {
            const response = await fetch('/api/dashboard/custom-dashboard', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    subdomain: customDashboardSubdomain,
                    layout: customDashboardLayout,
                    theme: customDashboardTheme,
                    metadata: customDashboardMetadata,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                setError(String(payload.error || 'Failed to save custom dashboard settings.'));
            } else {
                const dashboardSettings = payload as CustomDashboardSettings;
                const nextDashboardMetadata = normalizeDashboardMetadata(dashboardSettings.metadata);
                const nextDashboardLayout = dashboardSettings.layout || DEFAULT_CUSTOM_DASHBOARD_LAYOUT;
                const nextDashboardTheme = dashboardSettings.theme || DEFAULT_CUSTOM_DASHBOARD_THEME;

                setCustomDashboardSubdomain(dashboardSettings.subdomain || "");
                setCustomDashboardLayout(nextDashboardLayout);
                setCustomDashboardTheme(nextDashboardTheme);
                setCustomDashboardMetadata(nextDashboardMetadata);
                setCustomDashboardHostnames(dashboardSettings.hostnames || []);
                setSavedSettings((current) => ({
                    ...(current || DEFAULT_SAVED_SETTINGS),
                    customDashboardSubdomain: dashboardSettings.subdomain || "",
                    customDashboardLayout: nextDashboardLayout,
                    customDashboardTheme: nextDashboardTheme,
                    customDashboardMetadata: nextDashboardMetadata,
                }));
                window.dispatchEvent(new CustomEvent('rolink:custom-dashboard-saved', {
                    detail: {
                        ...dashboardSettings,
                        layout: nextDashboardLayout,
                        theme: nextDashboardTheme,
                        metadata: nextDashboardMetadata,
                    },
                }));
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }

            setSaving(false);
            return;
        }

        const response = await fetch('/api/dashboard/server-config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: id,
                updates: {
                admin_cmds_enabled: adminCmds,
                misc_cmds_enabled: miscCmds,
                logging_channel_id: loggingChannelId || null,
                reports_enabled: reportsEnabled,
                reports_channel_id: reportsChannelId || null
                },
            }),
        });
        const payload = await response.json().catch(() => ({}));

        // Save Roles Logic (In this simplified view, we save roles as they are modified, but general settings on Save)
        // Actually, let's keep role editing separate to avoid complex state management
        // Roles are saved immediately when modified in the UI below, or we could batch them.
        // For simplicity, let's just save general settings here.

        if (!response.ok) {
            setError(String(payload.error || 'Failed to save settings.'));
        } else {
            const savedServerSettings = payload as ServerSettingsConfig;
            const nextServerSettings = {
                adminCmds: savedServerSettings.admin_cmds_enabled !== false,
                miscCmds: savedServerSettings.misc_cmds_enabled !== false,
                loggingChannelId: savedServerSettings.logging_channel_id || "",
                reportsEnabled: savedServerSettings.reports_enabled || false,
                reportsChannelId: savedServerSettings.reports_channel_id || "",
            };

            setAdminCmds(nextServerSettings.adminCmds);
            setMiscCmds(nextServerSettings.miscCmds);
            setLoggingChannelId(nextServerSettings.loggingChannelId);
            setReportsEnabled(nextServerSettings.reportsEnabled);
            setReportsChannelId(nextServerSettings.reportsChannelId);
            setSavedSettings((current) => ({
                ...(current || DEFAULT_SAVED_SETTINGS),
                ...nextServerSettings,
            }));
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
                        live_panel: false,
                        kick: false,
                        ban: false,
                        timeout: false,
                        mute: false,
                        lookup: false,
                        manage_settings: false,
                        manage_reports: false,
                        view_logs: false,
                        view_runtime_logs: false,
                        manage_staff_notes: false,
                        view_staff_shifts: false,
                        manage_staff_shifts: false,
                    },
                    panelCmds: []
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

    async function handleUpdateRole(role: DashboardRole, field: keyof DashboardRole, value: DashboardRole[keyof DashboardRole]) {
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
                        live_panel: targetRole.can_access_live_panel,
                        kick: targetRole.can_kick,
                        ban: targetRole.can_ban,
                        timeout: targetRole.can_timeout,
                        mute: targetRole.can_mute,
                        lookup: targetRole.can_lookup,
                        manage_settings: targetRole.can_manage_settings,
                        manage_reports: targetRole.can_manage_reports,
                        view_logs: targetRole.can_view_logs,
                        view_runtime_logs: targetRole.can_view_runtime_logs,
                        manage_staff_notes: targetRole.can_manage_staff_notes,
                        view_staff_shifts: targetRole.can_view_staff_shifts,
                        manage_staff_shifts: targetRole.can_manage_staff_shifts,
                    },
                    panelCmds: normalizeAdminPanelCommandList(targetRole.allowed_misc_cmds)
                })
            });
        } catch (e) {
            console.error("Failed to update role", e);
            // Revert on error? For now, we assume success or user refreshes.
        }
    }

    async function handleDeleteRole(roleId: string) {
        setRoleToRemove(null);

        // Optimistic Remove
        setDashboardRoles(dashboardRoles.filter(r => r.id !== roleId));

        try {
            await fetch(`/api/settings/roles?id=${encodeURIComponent(roleId)}&serverId=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Failed to delete role", e);
        }
    }

    function closeRemoveModal() {
        if (removingRoLink) {
            return;
        }

        setIsRemoveModalOpen(false);
        setRemoveActionError(null);
    }

    async function handleRemoveRoLink() {
        if (!removeBotOption && !deleteDataOption) {
            setRemoveActionError('Select at least one option before continuing.');
            return;
        }

        setRemovingRoLink(true);
        setRemoveActionError(null);

        try {
            const response = await fetch('/api/dashboard/server/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: id,
                    removeBot: removeBotOption,
                    deleteData: deleteDataOption,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setRemoveActionError(String(payload.error || 'Failed to remove Ro-Link from this server.'));
                return;
            }

            if (payload.warning) {
                alert(String(payload.warning));
            }

            router.push('/dashboard');
            router.refresh();
        } catch (removeError) {
            setRemoveActionError(String(removeError instanceof Error ? removeError.message : removeError));
        } finally {
            setRemovingRoLink(false);
        }
    }

    const showsSaveButton = view === 'commands' || view === 'logging' || view === 'reports' || view === 'dashboard';
    const currentSettingsSnapshot = useMemo<SavedSettingsSnapshot>(() => ({
        adminCmds,
        miscCmds,
        loggingChannelId,
        reportsEnabled,
        reportsChannelId,
        customDashboardSubdomain,
        customDashboardLayout,
        customDashboardTheme,
        customDashboardMetadata,
    }), [
        adminCmds,
        customDashboardLayout,
        customDashboardMetadata,
        customDashboardSubdomain,
        customDashboardTheme,
        loggingChannelId,
        miscCmds,
        reportsChannelId,
        reportsEnabled,
    ]);
    const hasUnsavedSettings = showsSaveButton
        && Boolean(savedSettings)
        && JSON.stringify(getComparableSettingsForView(currentSettingsSnapshot, view)) !== JSON.stringify(getComparableSettingsForView(savedSettings || DEFAULT_SAVED_SETTINGS, view));

    useEffect(() => {
        if (hasUnsavedSettings && success) {
            setSuccess(false);
        }
    }, [hasUnsavedSettings, success]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    const pageCopy = PAGE_COPY[view];
    const settingsTiles = [
        {
            title: 'Game Connection',
            icon: KeyRound,
            description: 'Configure Roblox place IDs, API keys, and install the game script.',
            href: `/dashboard/${id}/settings/setup`,
        },
        {
            title: 'Role Permissions',
            icon: Users,
            description: 'Assign dashboard permissions and Roblox admin panel commands to Discord roles.',
            href: `/dashboard/${id}/settings/roles`,
        },
        {
            title: 'Command Modules',
            icon: Command,
            description: 'Enable or disable admin and misc command groups server-wide.',
            href: `/dashboard/${id}/settings/commands`,
        },
        {
            title: 'Audit Logging',
            icon: ScrollText,
            description: 'Select the Discord channel for moderation and administrative action logs.',
            href: `/dashboard/${id}/settings/logging`,
        },
        {
            title: 'Report System',
            icon: TriangleAlert,
            description: 'Turn reports on or off and pick the Discord channel for report notifications.',
            href: `/dashboard/${id}/settings/reports`,
        },
        ...(hasCustomDashboardSetup ? [{
            title: 'Custom Dashboard',
            icon: LayoutTemplate,
            description: 'Edit the custom URL, sign-in metadata, layout, and color scheme.',
            href: `/dashboard/${id}/settings/dashboard`,
        }] : []),
        {
            title: 'Activity Logs',
            icon: FileText,
            description: 'Review recent dashboard and moderation activity for this server.',
            href: `/dashboard/${id}/settings/logs`,
        },
    ];
    const infoItems = view === 'roles'
        ? [
            { title: "Dashboard Access", text: "A role must have dashboard access before its other dashboard permissions are useful. Live Panel can be granted separately for focused live moderation." },
            { title: "Panel Commands", text: "The Roblox admin panel uses the same command allowlist configured on each Discord role." },
        ]
        : view === 'logging'
            ? [
                { title: "Channel Access", text: "The bot needs permission to view and send messages in the selected logging channel." },
                { title: "Audit Trail", text: "Moderation actions are kept in dashboard logs even when Discord channel logging is disabled." },
            ]
            : view === 'reports'
                ? [
                    { title: "Dashboard Reports", text: "Reports remain visible in the dashboard even when no Discord channel is selected." },
                    { title: "Notifications", text: "Choose a reports channel when staff should receive new report notifications in Discord." },
                ]
                : view === 'dashboard'
                    ? [
                        { title: "Custom URL", text: "The subdomain controls the wildcard dashboard address staff can use to sign in." },
                        { title: "Branding", text: "Metadata appears before sign-in and the theme carries into the custom-host dashboard shell." },
                    ]
                    : [
                        { title: "Admin Commands", text: "Essential moderation tools. Disabling this prevents any kick/ban actions from Discord." },
                        { title: "Misc Commands", text: "Fun and utility commands. Can be disabled if they interfere with gameplay." },
                    ];
    const currentDashboardHostname = (() => {
        const subdomain = customDashboardSubdomain.trim().toLowerCase();
        if (!subdomain) return "";

        const hostnames = customDashboardHostnames.length > 0 ? customDashboardHostnames : [`${subdomain}.rolink.cloud`];
        const exactRootMatch = hostnames.find((hostname) => {
            const rootDomain = hostname.toLowerCase().replace(/^[^.]+\./, '');
            return currentHostname === rootDomain;
        });
        const matchingHostname = exactRootMatch || hostnames.find((hostname) => {
            const rootDomain = hostname.toLowerCase().replace(/^[^.]+\./, '');
            return currentHostname.endsWith(`.${rootDomain}`)
                || rootDomain.endsWith(`.${currentHostname}`);
        }) || hostnames[0];

        return matchingHostname.replace(/^[^.]+/, subdomain);
    })();

    return (
        <div className={`animate-in fade-in slide-in-from-bottom-4 duration-700 w-full ${showsSaveButton ? 'pb-32' : 'pb-20'}`}>
            <div className="mb-7">
                <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><PageIcon name={view === "overview" ? "settings" : view} />{pageCopy.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{pageCopy.description}</p>
            </div>

            <div className="space-y-6">
                <div className="space-y-6">

                    {view === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {settingsTiles.map((tile) => (
                                <Card key={tile.href} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-3">
                                            <tile.icon className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            {tile.title}
                                        </CardTitle>
                                        <CardDescription>{tile.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="mt-auto">
                                        <Button type="button" variant="outline" onClick={() => router.push(tile.href)}>
                                            Open {tile.title}<LucideArrowRight className="size-4" aria-hidden="true" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {view === 'roles' && (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Discord roles</CardTitle>
                                    <CardDescription>Add a Discord role, then choose what its members can access. Changes save automatically.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <label htmlFor="discord-role" className="text-sm font-medium">Discord role</label>
                                        <Select
                                            id="discord-role"
                                            value={selectedRoleForAdd}
                                            onValueChange={setSelectedRoleForAdd}
                                            aria-label="Discord role"
                                            options={[{ value: '', label: 'Select a Discord role…' }, ...discordRoles
                                                .filter(dr => !dashboardRoles.some(dbr => dbr.discord_role_id === dr.id) && dr.name !== '@everyone')
                                                .map(role => ({ value: role.id, label: role.name }))]}
                                        />
                                    </div>
                                    <Button type="button" onClick={handleAddRole} disabled={!selectedRoleForAdd || addingRole}>
                                        <Plus className="size-4" aria-hidden="true" />{addingRole ? 'Adding…' : 'Add Role'}
                                    </Button>
                                </CardContent>
                            </Card>

                            {dashboardRoles.map((role) => {
                                const roleCommands = getRolePanelCommands(role);
                                const hasAllCommands = roleCommands.includes('*');
                                const permissionCount = getRolePermissionCount(role);
                                const collapsed = collapsedRoleIds.includes(role.id);
                                const contentId = `role-permissions-${role.id}`;

                                return (
                                    <Card key={role.id}>
                                        <CardHeader className="flex-row items-center justify-between gap-3 px-4 py-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Hash className="size-4" aria-hidden="true" /></div>
                                                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                                    <CardTitle className="max-w-full break-words text-sm leading-snug">{role.role_name}</CardTitle>
                                                    <Status variant="info" className="px-2 py-0.5"><StatusLabel>{permissionCount} permission{permissionCount === 1 ? '' : 's'}</StatusLabel></Status>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button type="button" variant="ghost" size="icon" onClick={() => toggleRoleCollapsed(role.id)} aria-expanded={!collapsed} aria-controls={contentId} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${role.role_name}`}>
                                                    <LucideChevronDown className={`size-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} aria-hidden="true" />
                                                </Button>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => setRoleToRemove(role)} aria-label={`Remove ${role.role_name}`} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                                    <Trash2 className="size-4" aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent id={contentId} hidden={collapsed} className="space-y-6">
                                            <Separator />
                                            <section aria-labelledby={`dashboard-access-${role.id}`} className="space-y-4">
                                                <div>
                                                    <h3 id={`dashboard-access-${role.id}`} className="text-sm font-semibold">Dashboard permissions</h3>
                                                    <p className="mt-1 text-sm text-muted-foreground">Control access to dashboard pages and moderation tools.</p>
                                                </div>
                                                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                                                    {ROLE_PERMISSION_OPTIONS.map((perm) => (
                                                        <label key={perm.key} className="flex cursor-pointer items-start gap-3 text-sm leading-5">
                                                            <Checkbox className="mt-0.5" checked={Boolean(role[perm.key])} onCheckedChange={(checked) => handleUpdateRole(role, perm.key, checked === true)} />
                                                            {perm.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </section>
                                            <Separator />
                                            <section aria-labelledby={`panel-commands-${role.id}`} className="space-y-5">
                                                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                                                    <div>
                                                        <h3 id={`panel-commands-${role.id}`} className="text-sm font-semibold">Roblox admin panel commands</h3>
                                                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Choose the commands this role can run in the dashboard and live Roblox panel.</p>
                                                    </div>
                                                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
                                                        <Checkbox checked={hasAllCommands} onCheckedChange={() => handleToggleRoleAllCommands(role)} />
                                                        All commands
                                                    </label>
                                                </div>
                                                <div className="space-y-6">
                                                    {ADMIN_PANEL_COMMAND_GROUPS.map((group) => {
                                                        const selectedCount = hasAllCommands ? group.commands.length : group.commands.filter(command => hasAdminPanelCommandAccess(roleCommands, command.id)).length;
                                                        return (
                                                            <fieldset key={group.category} className="min-w-0 space-y-3">
                                                                <legend className="mb-3 flex w-full items-center justify-between gap-3 text-sm font-medium">
                                                                    {group.category}<Status><StatusLabel>{selectedCount}/{group.commands.length} selected</StatusLabel></Status>
                                                                </legend>
                                                                <div className="grid gap-3 lg:grid-cols-2">
                                                                    {group.commands.map(command => {
                                                                        const enabled = hasAllCommands || hasAdminPanelCommandAccess(roleCommands, command.id);
                                                                        return (
                                                                            <label key={command.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-accent/50">
                                                                                <Checkbox className="mt-0.5" checked={enabled} aria-label={command.label} onCheckedChange={() => handleToggleRoleCommand(role, command.id)} aria-describedby={`${role.id}-${command.id}-description`} />
                                                                                <span className="min-w-0 space-y-1">
                                                                                    <span className="block text-sm font-medium">{command.label}</span>
                                                                                    <span id={`${role.id}-${command.id}-description`} className="block text-sm leading-relaxed text-muted-foreground">{command.description}</span>
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </fieldset>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                            {dashboardRoles.length === 0 && (
                                <Card>
                                    <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
                                        <Shield className="mb-2 size-6 text-muted-foreground" aria-hidden="true" />
                                        <h2 className="text-sm font-semibold">No roles configured</h2>
                                        <p className="text-sm text-muted-foreground">Add a Discord role above to start assigning permissions.</p>
                                    </CardContent>
                                </Card>
                            )}
                            <Dialog open={Boolean(roleToRemove)} onOpenChange={(open) => { if (!open) setRoleToRemove(null); }}>
                                <DialogContent>
                                    <DialogTitle>Remove role configuration?</DialogTitle>
                                    <DialogDescription className="mt-2">Remove the permissions configured for {roleToRemove?.role_name}? The Discord role itself will remain.</DialogDescription>
                                    <div className="mt-6 flex justify-end gap-2">
                                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                        <Button type="button" variant="destructive" onClick={() => { if (roleToRemove) handleDeleteRole(roleToRemove.id); }}>Remove configuration</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}


                    {/* Custom Dashboard Config Section */}
                    {view === 'dashboard' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                            <CardTitle>Custom Dashboard</CardTitle>
                            <CardDescription>Set the custom dashboard address and control how the branded sign-in and dashboard shell appear.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <div className="grid grid-cols-1 gap-6">
                                <Card className="p-6">
                                    <label className="text-xs font-medium text-muted-foreground block mb-2">Dashboard Subdomain</label>
                                    <div className="flex rounded-xl border border-border bg-muted focus-within:border-amber-500">
                                        <Input
                                            value={customDashboardSubdomain}
                                            onChange={(e) => setCustomDashboardSubdomain(e.target.value)}
                                            placeholder="my-community"
                                            className="min-w-0 flex-1"
                                        />
                                        <span className="hidden items-center border-l border-border px-4 font-mono text-xs text-muted-foreground sm:flex">subdomain</span>
                                    </div>
                                    {currentDashboardHostname && (
                                        <div className="mt-4">
                                            <a
                                                href={`https://${currentDashboardHostname}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 font-mono text-xs text-amber-700 dark:text-amber-400 hover:border-amber-200"
                                            >
                                                {currentDashboardHostname}
                                            </a>
                                        </div>
                                    )}
                                </Card>

                                <div className="space-y-6">
                                    <div className="space-y-6">
                                        <Card className="p-6">
                                            <label className="text-xs font-medium text-muted-foreground block mb-2">Dashboard Title</label>
                                            <Input
                                                value={customDashboardMetadata.title}
                                                onChange={(e) => updateCustomDashboardMetadata('title', e.target.value)}
                                                placeholder="Community Staff Dashboard"
                                                maxLength={80}
                                                className="w-full transition-colors"
                                            />
                                        </Card>

                                        <Card className="p-6">
                                            <label className="text-xs font-medium text-muted-foreground block mb-2">Description</label>
                                            <Textarea
                                                value={customDashboardMetadata.description}
                                                onChange={(e) => updateCustomDashboardMetadata('description', e.target.value)}
                                                placeholder="Sign in with Discord to access this community dashboard."
                                                maxLength={180}
                                                className="w-full resize-none transition-colors"
                                            />
                                        </Card>

                                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                            <Card className="p-6">
                                                <label className="text-xs font-medium text-muted-foreground block mb-2">Logo URL</label>
                                                <Input
                                                    value={customDashboardMetadata.logoUrl}
                                                    onChange={(e) => updateCustomDashboardMetadata('logoUrl', e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full transition-colors"
                                                />
                                            </Card>

                                            <Card className="p-6">
                                                <label className="text-xs font-medium text-muted-foreground block mb-2">Support URL</label>
                                                <Input
                                                    value={customDashboardMetadata.supportUrl}
                                                    onChange={(e) => updateCustomDashboardMetadata('supportUrl', e.target.value)}
                                                    placeholder="https://discord.gg/..."
                                                    className="w-full transition-colors"
                                                />
                                            </Card>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                        <Card>
                            <CardHeader><CardTitle>Layout</CardTitle><CardDescription>Choose how dense the custom-host dashboard shell should feel.</CardDescription></CardHeader>
                            <CardContent>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {CUSTOM_DASHBOARD_LAYOUTS.map((layout) => (
                                    <Button variant="outline" size="default"
                                        key={layout.id}
                                        type="button"
                                        onClick={() => setCustomDashboardLayout(layout.id)}
                                        className={`h-auto min-h-9 justify-start whitespace-normal py-3    text-left transition-all ${customDashboardLayout === layout.id ? ' ' : '  '}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-foreground">{layout.name}</div>
                                            {customDashboardLayout === layout.id && (
                                                <span className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                                    Selected
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{layout.description}</p>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Theme</CardTitle><CardDescription>Choose one of seven color schemes for custom dashboard branding.</CardDescription></CardHeader>
                            <CardContent>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                {CUSTOM_DASHBOARD_THEMES.map((theme) => (
                                    <Button variant="outline" size="default"
                                        key={theme.id}
                                        type="button"
                                        onClick={() => setCustomDashboardTheme(theme.id)}
                                        className={`   text-left transition-all ${customDashboardTheme === theme.id ? ' ' : '  '}`}
                                    >
                                        <span
                                            className="mb-4 block h-9 w-full rounded-lg border"
                                            style={{
                                                background: "var(--background)",
                                                borderColor: theme.border,
                                            }}
                                        />
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-foreground">{theme.name}</span>
                                            {customDashboardTheme === theme.id && (
                                                <span className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
                                            )}
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                        </Card>
                    </div>
                    )}


                    {/* Command Config Section */}
                    {view === 'commands' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Global Command Modules</CardTitle>
                            <CardDescription>Enable or disable specific command categories server-wide. Disabled commands will not function in-game regardless of role.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                        <div className="grid grid-cols-1 gap-6">
                            {/* Admin Commands Toggle */}
                            <Card className="flex items-center justify-between gap-4 p-6">
                                <div>
                                    <h4 className="text-sm font-medium text-foreground tracking-tight">Admin Commands</h4>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">Kick, Ban, Unban, Shutdown, Update</p>
                                </div>
                                <Switch checked={adminCmds} onCheckedChange={setAdminCmds} aria-label="Admin commands" />
                            </Card>

                            {/* Misc Commands Toggle */}
                            <Card className="flex items-center justify-between gap-4 p-6">
                                <div>
                                    <h4 className="text-sm font-medium text-foreground tracking-tight">Misc Commands</h4>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">Fly, Noclip, Heal, Teleport, etc.</p>
                                </div>
                                <Switch checked={miscCmds} onCheckedChange={setMiscCmds} aria-label="Miscellaneous commands" />
                            </Card>
                        </div>
                    </CardContent>
                    </Card>
                    )}

                    {/* Logging Config Section */}
                    {view === 'logging' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Audit Logging</CardTitle>
                            <CardDescription>Select a Discord channel where administrative actions (kick, ban, etc) will be logged.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                        <Card className="p-6">
                            <label className="text-xs font-medium text-muted-foreground block mb-2">Logging Channel</label>
                            <Select
                                value={loggingChannelId}
                                onValueChange={(nextValue) => setLoggingChannelId(nextValue)}
                                className="w-full transition-all"
                                aria-label="Audit logging channel"
                                options={[{ value: '', label: 'Disabled (No Logging)' }, ...channels.map(channel => ({ value: channel.id, label: '#' + channel.name }))]}
                            />
                            {!isLoggingChannelAccessible && (
                                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                                    The saved logging channel is no longer accessible to the bot. Pick a visible channel the bot can send to, then save again.
                                </p>
                            )}
                        </Card>
                    </CardContent>
                    </Card>
                    )}

                    {/* Report System Config */}
                    {view === 'reports' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Report System</CardTitle>
                            <CardDescription>Enable player reports via Discord and configure where they are forwarded.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                                    <Status variant={reportsEnabled ? "success" : "default"}><StatusLabel>{reportsEnabled ? 'Enabled' : 'Disabled'}</StatusLabel></Status>
                                </div>
                                <Switch checked={reportsEnabled} onCheckedChange={setReportsEnabled} aria-label="Player reports" />
                            </Card>

                            <Card className="p-6">
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Reports Channel</label>
                                <Select
                                    value={reportsChannelId}
                                    onValueChange={(nextValue) => setReportsChannelId(nextValue)}
                                    className="w-full transition-all"
                                    aria-label="Reports channel"
                                    options={[{ value: '', label: 'None (Dashboard Only)' }, ...channels.map(channel => ({ value: channel.id, label: '#' + channel.name }))]}
                                />
                                {!isReportsChannelAccessible && (
                                    <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                                        The saved reports channel is no longer accessible to the bot. Choose a different channel or restore the bot’s permissions there.
                                    </p>
                                )}
                            </Card>
                        </div>
                    </CardContent>
                    </Card>
                    )}

                    {/* Status Box */}
                    {showsSaveButton && (
                        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
                            <div className="flex items-center gap-5">

                                <div>
                                    <h4 className="text-xs font-medium text-foreground tracking-tight">System Status</h4>
                                    <p className="text-xs text-muted-foreground font-medium tracking-tight mt-0.5">Settings changes propagate to game servers within ~30 seconds.</p>
                                </div>
                            </div>
                            {success && (
                                <Status variant="success" role="status"><StatusLabel>Changes saved</StatusLabel></Status>
                            )}
                            {error && <span className="text-red-700 dark:text-red-400 text-xs font-medium">{error}</span>}
                        </Card>
                    )}

                    {/* Remove Ro-Link */}
                    {view === 'overview' && (
                    <Card className="p-6">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-5">

                                <div>
                                    <h3 className="text-lg font-medium text-foreground mb-2">Remove Ro-Link</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                                        Open a removal panel for this server. You can remove the bot from the Discord server, delete the stored Ro-Link database data, or do both together.
                                    </p>
                                </div>
                            </div>
                            <Button variant="destructive" size="default"
                                type="button"
                                onClick={() => {
                                    setRemoveBotOption(true);
                                    setDeleteDataOption(false);
                                    setRemoveActionError(null);
                                    setIsRemoveModalOpen(true);
                                }}
                                className="w-full md:w-auto transition-all flex items-center justify-center"
                            >
                                <TrashIcon />
                                Remove Ro-Link
                            </Button>
                        </div>
                    </Card>
                    )}
                </div>

                {view !== 'overview' && (
                    <aside aria-label="Settings information" className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
                        {infoItems.map(item => <div key={item.title}><h3 className="text-sm font-medium">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p></div>)}
                    </aside>
                )}
            </div>

            {showsSaveButton && (hasUnsavedSettings || saving) && (
                <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
                    <Card className="pointer-events-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">

                            <div>
                                <p className="text-sm font-medium text-foreground">Save your settings</p>
                                <p className="mt-0.5 text-xs font-medium text-muted-foreground">You have unsaved changes on this page.</p>
                            </div>
                        </div>
                        <Button variant="default" size="default"
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex min-h-11 items-center justify-center transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? (
                                <div className="h-4 w-4 rounded-full border-2 border-border border-t-transparent animate-spin"></div>
                            ) : (
                                <>
                                    <SaveIcon />
                                    Save Settings
                                </>
                            )}
                        </Button>
                    </Card>
                </div>
            )}

            {view === 'overview' && isRemoveModalOpen && (
                <Dialog open={isRemoveModalOpen} onOpenChange={(open) => { if (!open) closeRemoveModal(); }}>
                    <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto p-0" onEscapeKeyDown={(event) => { if (removingRoLink) event.preventDefault(); }} onPointerDownOutside={(event) => { if (removingRoLink) event.preventDefault(); }}>
                        <div className="flex items-start justify-between gap-4 border-b border-border px-8 py-6">
                            <div>
                                <p className="text-xs font-medium text-red-700 dark:text-red-400">Danger Zone</p>
                                <DialogTitle className="mt-2">Remove Ro-Link</DialogTitle>
                                <DialogDescription className="mt-2">Choose what should happen for this server. You can remove the bot, wipe the saved Ro-Link data, or perform both actions together.</DialogDescription>
                            </div>
                            <Button variant="outline" size="icon"
                                type="button"
                                aria-label="Close removal dialog"
                                onClick={closeRemoveModal}
                                disabled={removingRoLink}
                                className="transition-colors disabled:opacity-50"
                            >
                                <LucideX width="18" height="18" strokeWidth="2.5" />
                            </Button>
                        </div>

                        <div className="space-y-5 px-8 py-8">
                            <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-border p-4"><Checkbox className="mt-0.5" checked={removeBotOption} onCheckedChange={(checked) => setRemoveBotOption(checked === true)} disabled={removingRoLink} />
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Remove Bot from Server</div>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            Makes Ro-Link leave this Discord server. Existing database data stays unless you also enable the delete option below.
                                        </p>
                                    </div>
                                </label>

                            <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-border p-4"><Checkbox className="mt-0.5" checked={deleteDataOption} onCheckedChange={(checked) => setDeleteDataOption(checked === true)} disabled={removingRoLink} />
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Delete Ro-Link Data</div>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            Deletes this server’s stored Ro-Link setup, logs, live server cache, command queue, reports, and dashboard role configuration from the database.
                                        </p>
                                    </div>
                                </label>

                            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 text-sm text-amber-700 dark:text-amber-400">
                                Deleting data is permanent. If you want a full disconnect, enable both options before confirming.
                            </div>

                            {removeActionError && (
                                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-sm font-medium text-red-700 dark:text-red-400">
                                    {removeActionError}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-border px-8 py-6 sm:flex-row sm:items-center sm:justify-end">
                            <Button variant="ghost" size="default"
                                type="button"
                                onClick={closeRemoveModal}
                                disabled={removingRoLink}
                                className="transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </Button>
                            <Button variant="destructive" size="default"
                                type="button"
                                onClick={handleRemoveRoLink}
                                disabled={removingRoLink || (!removeBotOption && !deleteDataOption)}
                                className="flex items-center justify-center transition-all disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {removingRoLink ? (
                                    <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <TrashIcon />
                                )}
                                Confirm Removal
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
