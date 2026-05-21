'use client';

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

interface GuildSummary {
    id: string;
    permissions: string;
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

type DashboardRoleBooleanField =
    | 'can_access_dashboard'
    | 'can_manage_settings'
    | 'can_manage_reports'
    | 'can_lookup'
    | 'can_kick'
    | 'can_ban'
    | 'can_timeout'
    | 'can_mute';

const ROLE_PERMISSION_OPTIONS: Array<{ key: DashboardRoleBooleanField; label: string }> = [
    { key: 'can_access_dashboard', label: 'Dashboard Access' },
    { key: 'can_manage_settings', label: 'Manage Settings' },
    { key: 'can_manage_reports', label: 'Manage Reports' },
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
    const [isRolesCollapsed, setIsRolesCollapsed] = useState(false);
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
                        kick: false,
                        ban: false,
                        timeout: false,
                        mute: false,
                        lookup: false,
                        manage_settings: false,
                        manage_reports: false
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
                        kick: targetRole.can_kick,
                        ban: targetRole.can_ban,
                        timeout: targetRole.can_timeout,
                        mute: targetRole.can_mute,
                        lookup: targetRole.can_lookup,
                        manage_settings: targetRole.can_manage_settings,
                        manage_reports: targetRole.can_manage_reports
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
        if (!confirm("Are you sure you want to remove this role configuration?")) return;

        // Optimistic Remove
        setDashboardRoles(dashboardRoles.filter(r => r.id !== roleId));

        try {
            await fetch(`/api/settings/roles?id=${roleId}`, { method: 'DELETE' });
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
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    const pageCopy = PAGE_COPY[view];
    const settingsTiles = [
        {
            title: 'Game Connection',
            description: 'Configure Roblox place IDs, API keys, and install the game script.',
            href: `/dashboard/${id}/settings/setup`,
            tone: 'emerald',
        },
        {
            title: 'Role Permissions',
            description: 'Assign dashboard permissions and Roblox admin panel commands to Discord roles.',
            href: `/dashboard/${id}/settings/roles`,
            tone: 'purple',
        },
        {
            title: 'Command Modules',
            description: 'Enable or disable admin and misc command groups server-wide.',
            href: `/dashboard/${id}/settings/commands`,
            tone: 'sky',
        },
        {
            title: 'Audit Logging',
            description: 'Select the Discord channel for moderation and administrative action logs.',
            href: `/dashboard/${id}/settings/logging`,
            tone: 'indigo',
        },
        {
            title: 'Report System',
            description: 'Turn reports on or off and pick the Discord channel for report notifications.',
            href: `/dashboard/${id}/settings/reports`,
            tone: 'red',
        },
        ...(hasCustomDashboardSetup ? [{
            title: 'Custom Dashboard',
            description: 'Edit the custom URL, sign-in metadata, layout, and color scheme.',
            href: `/dashboard/${id}/settings/dashboard`,
            tone: 'amber',
        }] : []),
        {
            title: 'Activity Logs',
            description: 'Review recent dashboard and moderation activity for this server.',
            href: `/dashboard/${id}/settings/logs`,
            tone: 'slate',
        },
    ];
    const infoItems = view === 'roles'
        ? [
            { title: "Dashboard Access", text: "A role must have dashboard access before its other dashboard permissions are useful." },
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
            {/* Page Header */}
            <div className="mb-10 pb-8 border-b border-slate-800/60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-sky-600/10 rounded-2xl flex items-center justify-center text-sky-500 border border-sky-500/20 shadow-2xl shadow-sky-900/10">
                            <SettingsIcon />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">{pageCopy.title}</h1>
                            <p className="text-slate-500 text-sm font-medium mt-1">{pageCopy.description}</p>
                        </div>
                    </div>

                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 xl:gap-8">
                {/* Main Settings Column */}
                <div className={`col-span-12 space-y-12 ${view === 'overview' ? '' : 'lg:col-span-8'}`}>

                    {view === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {settingsTiles.map((tile) => {
                                const toneClass = tile.tone === 'emerald'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:border-emerald-500/40'
                                    : tile.tone === 'purple'
                                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:border-purple-500/40'
                                        : tile.tone === 'indigo'
                                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 group-hover:border-indigo-500/40'
                                            : tile.tone === 'red'
                                                ? 'bg-red-500/10 text-red-400 border-red-500/20 group-hover:border-red-500/40'
                                                : tile.tone === 'amber'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 group-hover:border-amber-500/40'
                                                : tile.tone === 'sky'
                                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 group-hover:border-sky-500/40'
                                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20 group-hover:border-slate-500/40';

                                return (
                                    <button
                                        key={tile.href}
                                        type="button"
                                        onClick={() => router.push(tile.href)}
                                        className="group min-h-44 rounded-[2rem] border border-slate-800 bg-slate-900/40 p-7 text-left transition-all hover:bg-slate-900/70 hover:border-slate-700"
                                    >
                                        <div className={`mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${toneClass}`}>
                                            <SettingsIcon />
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">{tile.title}</h3>
                                                <p className="mt-3 text-sm leading-relaxed text-slate-500">{tile.description}</p>
                                            </div>
                                            <svg className="mt-0.5 shrink-0 text-slate-600 transition-colors group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* --- ROLE PERMISSIONS SECTION (NEW) --- */}
                    {view === 'roles' && (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm relative overflow-hidden transition-all duration-300">
                        <div className="flex items-start justify-between mb-8 cursor-pointer" onClick={() => setIsRolesCollapsed(!isRolesCollapsed)}>
                            <div className="flex items-start gap-6">
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
                            <button className={`p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all transform ${isRolesCollapsed ? 'rotate-180' : ''}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </button>
                        </div>

                        {!isRolesCollapsed && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
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
                                    {dashboardRoles.map((role) => {
                                        const roleCommands = getRolePanelCommands(role);
                                        const hasAllCommands = roleCommands.includes('*');
                                        const permissionCount = getRolePermissionCount(role);
                                        const roleCardCollapsed = collapsedRoleIds.includes(role.id);

                                        return (
                                        <div key={role.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-6 transition-all hover:bg-slate-900/40">
                                            <div className={`flex items-center justify-between ${roleCardCollapsed ? '' : 'mb-6 border-b border-slate-800/50 pb-4'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRoleCollapsed(role.id)}
                                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                                                        #
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-white tracking-wide">{role.role_name}</div>
                                                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                            {permissionCount} permission{permissionCount === 1 ? '' : 's'}
                                                        </div>
                                                    </div>
                                                </button>
                                                <div className="ml-4 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRoleCollapsed(role.id)}
                                                        className={`p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white transition-all transform ${roleCardCollapsed ? 'rotate-180' : ''}`}
                                                        title={roleCardCollapsed ? "Expand Role" : "Collapse Role"}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRole(role.id)}
                                                        className="text-slate-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                                                        title="Remove Configuration"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            </div>

                                            {!roleCardCollapsed && (
                                                <>
                                                    {/* Permissions Grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-3 xl:gap-4">
                                                        {ROLE_PERMISSION_OPTIONS.map((perm) => (
                                                            <label key={perm.key} className="flex items-center gap-3 cursor-pointer group select-none">
                                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                                                    role[perm.key] ? 'bg-purple-600 border-purple-500' : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'
                                                                    }`}>
                                                                    {role[perm.key] && (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12" /></svg>
                                                                        )}
                                                                </div>
                                                                <input
                                                                    type="checkbox"
                                                                    className="hidden"
                                                                    checked={role[perm.key]}
                                                                    onChange={(e) => handleUpdateRole(role, perm.key, e.target.checked)}
                                                                />
                                                                <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                                                                    role[perm.key] ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'
                                                                    }`}>
                                                                    {perm.label}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>

                                                    <div className="mt-6 pt-6 border-t border-slate-800/50 space-y-5">
                                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                                                                    Roblox Admin Panel Commands
                                                                </label>
                                                                <p className="text-[11px] text-slate-500 max-w-xl leading-relaxed">
                                                                    Choose exactly which Ro-Link in-game panel commands this role can run. The dashboard and live Roblox panel both use this same command list.
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleRoleAllCommands(role)}
                                                                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.18em] transition-all border ${
                                                                    hasAllCommands
                                                                        ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20'
                                                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-purple-500/50 hover:text-white'
                                                                }`}
                                                            >
                                                                {hasAllCommands ? 'All Commands Enabled' : 'Enable All Commands'}
                                                            </button>
                                                        </div>

                                                        <div className="space-y-4">
                                                            {ADMIN_PANEL_COMMAND_GROUPS.map((group) => {
                                                                const selectedCount = hasAllCommands
                                                                    ? group.commands.length
                                                                    : group.commands.filter((command) => hasAdminPanelCommandAccess(roleCommands, command.id)).length;

                                                                return (
                                                                    <div key={group.category} className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                                                                        <div className="flex items-center justify-between mb-4">
                                                                            <div>
                                                                                <h4 className="text-xs font-bold text-white uppercase tracking-[0.18em]">{group.category}</h4>
                                                                                <p className="text-[10px] text-slate-600 mt-1">{selectedCount}/{group.commands.length} selected</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                                            {group.commands.map((command) => {
                                                                                const enabled = hasAllCommands || hasAdminPanelCommandAccess(roleCommands, command.id);

                                                                                return (
                                                                                    <button
                                                                                        key={command.id}
                                                                                        type="button"
                                                                                        onClick={() => handleToggleRoleCommand(role, command.id)}
                                                                                        className={`text-left rounded-xl border px-4 py-3 transition-all ${
                                                                                            enabled
                                                                                                ? 'bg-purple-600/10 border-purple-500/40 shadow-[0_0_0_1px_rgba(168,85,247,0.12)]'
                                                                                                : 'bg-black/20 border-slate-800 hover:border-slate-600'
                                                                                        }`}
                                                                                    >
                                                                                        <div className="flex items-start gap-3">
                                                                                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                                                                                enabled
                                                                                                    ? 'bg-purple-600 border-purple-500 text-white'
                                                                                                    : 'bg-slate-900 border-slate-700 text-slate-700'
                                                                                            }`}>
                                                                                                {enabled ? (
                                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                                                ) : null}
                                                                                            </div>
                                                                                            <div className="min-w-0">
                                                                                                <div className={`text-xs font-bold uppercase tracking-[0.16em] ${enabled ? 'text-white' : 'text-slate-300'}`}>
                                                                                                    {command.label}
                                                                                                </div>
                                                                                                <p className={`mt-1 text-[11px] leading-relaxed ${enabled ? 'text-slate-300' : 'text-slate-500'}`}>
                                                                                                    {command.description}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )})}

                                    {dashboardRoles.length === 0 && (
                                        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No roles configured yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    )}


                    {/* Custom Dashboard Config Section */}
                    {view === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm relative overflow-hidden">
                            <div className="flex items-start gap-6 mb-8">
                                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/10">
                                    <SettingsIcon />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Custom Dashboard</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed max-w-lg">Set the custom dashboard address and control how the branded sign-in and dashboard shell appear.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Dashboard Subdomain</label>
                                    <div className="flex rounded-xl border border-slate-800 bg-black/30 focus-within:border-amber-500">
                                        <input
                                            value={customDashboardSubdomain}
                                            onChange={(e) => setCustomDashboardSubdomain(e.target.value)}
                                            placeholder="my-community"
                                            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none"
                                        />
                                        <span className="hidden items-center border-l border-slate-800 px-4 font-mono text-xs text-slate-500 sm:flex">subdomain</span>
                                    </div>
                                    {currentDashboardHostname && (
                                        <div className="mt-4">
                                            <a
                                                href={`https://${currentDashboardHostname}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-mono text-[11px] text-amber-200 hover:border-amber-400/50"
                                            >
                                                {currentDashboardHostname}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-6">
                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Dashboard Title</label>
                                            <input
                                                value={customDashboardMetadata.title}
                                                onChange={(e) => updateCustomDashboardMetadata('title', e.target.value)}
                                                placeholder="Community Staff Dashboard"
                                                maxLength={80}
                                                className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-500"
                                            />
                                        </div>

                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Description</label>
                                            <textarea
                                                value={customDashboardMetadata.description}
                                                onChange={(e) => updateCustomDashboardMetadata('description', e.target.value)}
                                                placeholder="Sign in with Discord to access this community dashboard."
                                                maxLength={180}
                                                className="h-28 w-full resize-none rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Logo URL</label>
                                                <input
                                                    value={customDashboardMetadata.logoUrl}
                                                    onChange={(e) => updateCustomDashboardMetadata('logoUrl', e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-500"
                                                />
                                            </div>

                                            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Support URL</label>
                                                <input
                                                    value={customDashboardMetadata.supportUrl}
                                                    onChange={(e) => updateCustomDashboardMetadata('supportUrl', e.target.value)}
                                                    placeholder="https://discord.gg/..."
                                                    className="w-full rounded-xl border border-slate-800 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Layout</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">Choose how dense the custom-host dashboard shell should feel.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {CUSTOM_DASHBOARD_LAYOUTS.map((layout) => (
                                    <button
                                        key={layout.id}
                                        type="button"
                                        onClick={() => setCustomDashboardLayout(layout.id)}
                                        className={`rounded-xl border p-5 text-left transition-all ${customDashboardLayout === layout.id ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-black uppercase tracking-[0.16em] text-white">{layout.name}</div>
                                            {customDashboardLayout === layout.id && (
                                                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                                                    Selected
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs leading-relaxed text-slate-500">{layout.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Theme</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">Choose one of seven color schemes for custom dashboard branding.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                {CUSTOM_DASHBOARD_THEMES.map((theme) => (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        onClick={() => setCustomDashboardTheme(theme.id)}
                                        className={`rounded-xl border p-4 text-left transition-all ${customDashboardTheme === theme.id ? 'border-white/40 bg-white/10' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}
                                    >
                                        <span
                                            className="mb-4 block h-9 w-full rounded-lg border"
                                            style={{
                                                background: theme.gradient,
                                                borderColor: theme.border,
                                            }}
                                        />
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-black uppercase tracking-[0.16em] text-white">{theme.name}</span>
                                            {customDashboardTheme === theme.id && (
                                                <span className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
                                            )}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    )}


                    {/* Command Config Section */}
                    {view === 'commands' && (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm relative overflow-hidden">
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
                    </div>
                    )}

                    {/* Logging Config Section */}
                    {view === 'logging' && (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm relative overflow-hidden">
                        <div className="flex items-start gap-6 mb-8">
                            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Audit Logging</h3>
                                <p className="text-sm text-slate-500 leading-relaxed max-w-lg">Select a Discord channel where administrative actions (kick, ban, etc) will be logged.</p>
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
                            {!isLoggingChannelAccessible && (
                                <p className="mt-3 text-[11px] font-medium text-amber-400">
                                    The saved logging channel is no longer accessible to the bot. Pick a visible channel the bot can send to, then save again.
                                </p>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Report System Config */}
                    {view === 'reports' && (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm relative overflow-hidden">
                        <div className="flex items-start gap-6 mb-8">
                            <div className="p-3 bg-red-500/10 rounded-xl text-red-500 border border-red-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Report System</h3>
                                <p className="text-sm text-slate-500 leading-relaxed max-w-lg">Enable player reports via Discord and configure where they are forwarded.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60 flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Status</label>
                                    <span className={`text-sm font-bold ${reportsEnabled ? 'text-red-500' : 'text-slate-500'}`}>
                                        {reportsEnabled ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setReportsEnabled(!reportsEnabled)}
                                    className={`w-14 h-7 rounded-full transition-all duration-500 relative border-2 ${reportsEnabled ? 'bg-red-600/20 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-slate-800/40 border-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3.5 h-3.5 rounded-full transition-all duration-500 shadow-md ${reportsEnabled ? 'left-8 bg-red-500' : 'left-1.5 bg-slate-500'}`} />
                                </button>
                            </div>

                            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/60">
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Reports Channel</label>
                                <select
                                    value={reportsChannelId}
                                    onChange={(e) => setReportsChannelId(e.target.value)}
                                    className="w-full bg-black/40 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 transition-all font-medium"
                                >
                                    <option value="">None (Dashboard Only)</option>
                                    {channels.map(channel => (
                                        <option key={channel.id} value={channel.id}>
                                            #{channel.name}
                                        </option>
                                    ))}
                                </select>
                                {!isReportsChannelAccessible && (
                                    <p className="mt-3 text-[11px] font-medium text-amber-400">
                                        The saved reports channel is no longer accessible to the bot. Choose a different channel or restore the bot’s permissions there.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Status Box */}
                    {showsSaveButton && (
                        <div className="p-5 sm:p-6 md:p-8 bg-slate-900/20 border border-slate-800 rounded-2xl flex items-center justify-between">
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
                    )}

                    {/* Remove Ro-Link */}
                    {view === 'overview' && (
                    <div className="bg-red-950/20 border border-red-500/20 rounded-[2rem] p-5 sm:p-6 md:p-8 xl:p-10 backdrop-blur-sm">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-5">
                                <div className="p-3 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20">
                                    <TrashIcon />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Remove Ro-Link</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                                        Open a removal panel for this server. You can remove the bot from the Discord server, delete the stored Ro-Link database data, or do both together.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setRemoveBotOption(true);
                                    setDeleteDataOption(false);
                                    setRemoveActionError(null);
                                    setIsRemoveModalOpen(true);
                                }}
                                className="w-full md:w-auto px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 text-xs uppercase tracking-widest flex items-center justify-center gap-3"
                            >
                                <TrashIcon />
                                Remove Ro-Link
                            </button>
                        </div>
                    </div>
                    )}
                </div>

                {/* Info Column */}
                {view !== 'overview' && (
                <div className="col-span-12 lg:col-span-4 space-y-8">
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-5 sm:p-6 md:p-8">
                        <h4 className="text-xs font-bold text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                            <span className="w-6 h-px bg-sky-600"></span>
                            Information
                        </h4>
                        <div className="space-y-6">
                            {infoItems.map((item, i) => (
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
                )}
            </div>

            {showsSaveButton && (hasUnsavedSettings || saving) && (
                <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
                    <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-sky-500/30 bg-slate-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                                <SaveIcon />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Save your settings</p>
                                <p className="mt-0.5 text-xs font-medium text-slate-400">You have unsaved changes on this page.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex min-h-11 items-center justify-center gap-3 rounded-xl border border-sky-400/20 bg-sky-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? (
                                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                            ) : (
                                <>
                                    <SaveIcon />
                                    Save Settings
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {view === 'overview' && isRemoveModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl rounded-[2rem] border border-red-500/20 bg-[#020617] shadow-2xl overflow-hidden">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-8 py-6">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-400">Danger Zone</p>
                                <h3 className="mt-2 text-2xl font-black tracking-tight text-white uppercase italic">Remove Ro-Link</h3>
                                <p className="mt-2 text-sm text-slate-400 max-w-xl">
                                    Choose what should happen for this server. You can remove the bot, wipe the saved Ro-Link data, or perform both actions together.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeRemoveModal}
                                disabled={removingRoLink}
                                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-slate-500 hover:text-white transition-colors disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-5 px-8 py-8">
                            <button
                                type="button"
                                onClick={() => setRemoveBotOption((current) => !current)}
                                className={`w-full rounded-2xl border p-5 text-left transition-all ${removeBotOption ? 'border-red-500/40 bg-red-500/10' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${removeBotOption ? 'border-red-500 bg-red-500 text-white' : 'border-slate-700 bg-slate-950 text-transparent'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold uppercase tracking-[0.16em] text-white">Remove Bot from Server</div>
                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                                            Makes Ro-Link leave this Discord server. Existing database data stays unless you also enable the delete option below.
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDeleteDataOption((current) => !current)}
                                className={`w-full rounded-2xl border p-5 text-left transition-all ${deleteDataOption ? 'border-red-500/40 bg-red-500/10' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${deleteDataOption ? 'border-red-500 bg-red-500 text-white' : 'border-slate-700 bg-slate-950 text-transparent'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold uppercase tracking-[0.16em] text-white">Delete Ro-Link Data</div>
                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                                            Deletes this server’s stored Ro-Link setup, logs, live server cache, command queue, reports, and dashboard role configuration from the database.
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
                                Deleting data is permanent. If you want a full disconnect, enable both options before confirming.
                            </div>

                            {removeActionError && (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
                                    {removeActionError}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-8 py-6 sm:flex-row sm:items-center sm:justify-end">
                            <button
                                type="button"
                                onClick={closeRemoveModal}
                                disabled={removingRoLink}
                                className="px-5 py-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRemoveRoLink}
                                disabled={removingRoLink || (!removeBotOption && !deleteDataOption)}
                                className="flex items-center justify-center gap-3 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {removingRoLink ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <TrashIcon />
                                )}
                                Confirm Removal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
