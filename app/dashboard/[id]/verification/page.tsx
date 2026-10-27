'use client';
import { useSuccessNotice } from '@/hooks/use-success-notice';
import { PageIcon } from "@/components/dashboard/PageIcon";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

import { Status, StatusIndicator, StatusLabel } from '@/components/ui/status';

import { Switch } from '@/components/ui/switch';

import { Button } from '@/components/ui/button';


import { Select } from '@/components/ui/select';
import { Save, UserRoundCheck } from "lucide-react";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";


const SaveIcon = () => <Save size={18} aria-hidden="true" />;

const RoleIcon = () => <UserRoundCheck size={18} aria-hidden="true" />;


interface VerificationConfig {
    verification_enabled?: boolean | null;
    on_join_role?: string | null;
    verified_role?: string | null;
    block_unverified?: boolean | null;
}

export default function VerificationPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useSuccessNotice<boolean>(false);

    const [roles, setRoles] = useState<any[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [onJoinRole, setOnJoinRole] = useState("");
    const [verifiedRole, setVerifiedRole] = useState("");
    const [blockUnverified, setBlockUnverified] = useState(false);

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
            const configRes = await fetch(`/api/dashboard/server-config?serverId=${encodeURIComponent(String(id))}`, {
                cache: 'no-store',
            });
            const data = configRes.ok ? await configRes.json() as VerificationConfig | null : null;

            if (data) {
                setEnabled(data.verification_enabled || false);
                setOnJoinRole(data.on_join_role || "");
                setVerifiedRole(data.verified_role || "");
                setBlockUnverified(data.block_unverified || false);
            }

            // 3. Fetch Roles
            try {
                const rolesRes = await fetch(`/api/guilds/${id}/roles`);
                if (rolesRes.ok) {
                    const rolesData = await rolesRes.json();
                    setRoles(rolesData.filter((r: any) => r.name !== "@everyone"));
                }
            } catch (e) {
                console.error("Failed to fetch roles:", e);
            }

            setLoading(false);
        }
        fetchData();
    }, [id, session, router]);

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);

        const response = await fetch('/api/dashboard/server-config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: id,
                updates: {
                verification_enabled: enabled,
                on_join_role: onJoinRole,
                verified_role: verifiedRole,
                block_unverified: blockUnverified
                },
            }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            setError(String(payload.error || 'Failed to save verification settings.'));
        } else {
            setSuccess(true);
        }
        setSaving(false);
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full pb-20">
            {/* Page Header - Integrated Layout */}
            <div className="mb-10 pb-8 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <PageIcon name="verification" />
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Verification</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Status variant={enabled ? "success" : "default"}><StatusIndicator /><StatusLabel>{enabled ? 'System Operational' : 'System Disabled'}</StatusLabel></Status>
                            </div>
                        </div>
                    </div>

                    <Button variant="default" size="default"
                        onClick={handleSave}
                        disabled={saving}
                        className="hidden md:flex transition-all disabled:opacity-50 items-center justify-center active:scale-95"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <SaveIcon />
                                SAVE CHANGES
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 xl:gap-8">
                {/* Main Settings Column */}
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    {/* Primary Config Section */}
                    <Card>


                        <CardHeader className="flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle>Toggle Verification</CardTitle>
                                <CardDescription className="mt-2">Enable or disable the Roblox-to-Discord linking flow for this server.</CardDescription>
                            </div>
                            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Roblox verification" />
                        </CardHeader>
                        <CardContent>

                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-700 ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="space-y-4">
                                <label className="text-xs font-medium text-muted-foreground pl-1 flex items-center gap-2">
                                    <RoleIcon />
                                    Verified Role
                                </label>
                                <div className="relative">
                                    <Select
                                        className="w-full transition-all cursor-pointer"
                                        value={verifiedRole}
                                        onValueChange={(nextValue) => setVerifiedRole(nextValue)}
                                        disabled={!enabled}
                                        aria-label="Verified role"
                                        options={[{ value: '', label: 'None (Disabled)' }, ...roles.map(role => ({ value: role.id, label: role.name }))]}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground font-medium pl-2 leading-relaxed">Awarded automatically after a successful Roblox link.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-medium text-muted-foreground pl-1 flex items-center gap-2">
                                    <RoleIcon />
                                    On Join Role
                                </label>
                                <div className="relative">
                                    <Select
                                        className="w-full transition-all cursor-pointer"
                                        value={onJoinRole}
                                        onValueChange={(nextValue) => setOnJoinRole(nextValue)}
                                        disabled={!enabled}
                                        aria-label="On join role"
                                        options={[{ value: '', label: 'None (Disabled)' }, ...roles.map(role => ({ value: role.id, label: role.name }))]}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground font-medium pl-2 leading-relaxed">Awarded immediately when a member joins the Discord server.</p>
                            </div>
                        </div>

                        {/* Extra Safety Setting */}
                        <div className={`mt-6 pt-6 border-t border-border transition-all duration-700 ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                                <div className="flex items-center gap-5">

                                    <div>
                                        <h4 className="text-sm font-medium text-foreground tracking-tight">Block Unverified Joins</h4>
                                        <p className="text-xs text-muted-foreground font-medium mt-1">Automatically kick players from the Roblox game if they haven&apos;t linked their Discord account.</p>
                                    </div>
                                </div>
                                <Switch checked={blockUnverified} onCheckedChange={setBlockUnverified} disabled={!enabled} aria-label="Block unverified joins" />
                            </div>
                        </div>

                        <div className="mt-12 md:hidden">
                            <Button variant="default" size="default"
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full transition-all disabled:opacity-50 flex items-center justify-center active:scale-95"
                            >
                                {saving ? <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin"></div> : "Save settings"}
                            </Button>
                        </div>
                        </CardContent>
                    </Card>

                    {/* Status Box */}
                    <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
                        <div className="flex items-center gap-5">

                            <div>
                                <h4 className="text-xs font-medium text-foreground tracking-tight">System Status</h4>
                                <p className="text-xs text-muted-foreground font-medium tracking-tight mt-0.5">Ro-Link authentication servers are currently synced and stable.</p>
                            </div>
                        </div>
                        {success && (
                            <Status variant="success" role="status"><StatusLabel>Changes saved</StatusLabel></Status>
                        )}
                        {error && <span className="text-red-700 dark:text-red-400 text-xs font-medium">{error}</span>}
                    </Card>
                </div>

                {/* Info Column */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                    <Card className="bg-card border border-border rounded-xl p-5 sm:p-6 md:p-8">
                        <h4 className="text-xs font-medium text-foreground mb-8 flex items-center gap-3">
                            <span className="w-6 h-px bg-primary"></span>
                            Documentation
                        </h4>
                        <div className="space-y-8">
                            {[
                                { step: "01", text: "Users link via Ro-Link portal using Roblox OAuth2." },
                                { step: "02", text: "Roles are instantly synced across all eligible servers." },
                                { step: "03", text: "Administrators can pull verification data via API." }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <span className="text-foreground font-semibold text-xs mt-0.5 group-hover:scale-110 transition-transform">
                                        {item.step}
                                    </span>
                                    <p className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                                        {item.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-6">

                        <h4 className="text-sm font-medium text-foreground mb-2">Bot Context</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-6">Ro-Link requires its role to be above any roles it attempts to assign.</p>
                        <Card className="p-5 bg-card rounded-xl border border-border text-xs font-mono text-foreground leading-loose">
                            <div className="flex justify-between border-b border-border pb-2 mb-2">
                                <span className="opacity-50">Role Hierarchy</span>
                                <span className="text-foreground font-medium">Priority</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                                Ro-Link Bot
                            </div>
                            <div className="flex items-center gap-3 ml-4 opacity-50">
                                <span className="w-1 h-px bg-primary"></span>
                                Verified Role
                            </div>
                            <div className="flex items-center gap-3 ml-4 opacity-50">
                                <span className="w-1 h-px bg-primary"></span>
                                On Join Role
                            </div>
                        </Card>
                    </Card>
                </div>
            </div>
        </div>
    );
}

