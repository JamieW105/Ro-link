'use client';

import { Card } from '@/components/ui/card';

import { Switch } from '@/components/ui/switch';

import { Button } from '@/components/ui/button';


import { Select } from '@/components/ui/select';
import { Info, Save, Shield, UserRoundCheck } from "lucide-react";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const ShieldIcon = () => <Shield size={24} aria-hidden="true" />;

const SaveIcon = () => <Save size={18} aria-hidden="true" />;

const RoleIcon = () => <UserRoundCheck size={18} aria-hidden="true" />;

const InfoIcon = () => <Info size={18} aria-hidden="true" />;

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
    const [success, setSuccess] = useState(false);

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
            setTimeout(() => setSuccess(false), 3000);
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
                        <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-foreground border border-border">
                            <ShieldIcon />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Verification</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`}></span>
                                <p className="text-muted-foreground text-xs font-medium">
                                    {enabled ? 'System Operational' : 'System Disabled'}
                                </p>
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
                    <Card className="bg-card border border-border rounded-xl p-5 sm:p-6 md:p-8 xl:p-10 relative overflow-hidden">
                        <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 p-8 opacity-[0.02] text-foreground">
                            <ShieldIcon />
                        </div>

                        <div className="flex items-center justify-between mb-12">
                            <div>
                                <h3 className="text-lg font-medium text-foreground mb-2">Toggle Verification</h3>
                                <p className="text-sm text-muted-foreground">Enable or disable the Roblox-to-Discord linking flow for this server.</p>
                            </div>
                            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Roblox verification" />
                        </div>

                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 transition-all duration-700 ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
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
                        <div className={`mt-12 pt-10 border-t border-border transition-all duration-700 ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl">
                                <div className="flex items-center gap-5">
                                    <div className="w-10 h-10 bg-red-50 dark:bg-red-950/30 rounded-xl flex items-center justify-center text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                                        <ShieldIcon />
                                    </div>
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
                                {saving ? <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin"></div> : "SAVE SETTINGS"}
                            </Button>
                        </div>
                    </Card>

                    {/* Status Box */}
                    <Card className="p-5 sm:p-6 md:p-8 bg-card border border-border rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                                <InfoIcon />
                            </div>
                            <div>
                                <h4 className="text-xs font-medium text-foreground tracking-tight">System Status</h4>
                                <p className="text-xs text-muted-foreground font-medium tracking-tight mt-0.5">Ro-Link authentication servers are currently synced and stable.</p>
                            </div>
                        </div>
                        {success && (
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-medium">Changes Saved</span>
                            </div>
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

                    <div className="bg-accent border border-border rounded-xl p-5 sm:p-6 md:p-8 relative overflow-hidden group hover:border-border transition-all">
                        <div className="absolute -bottom-6 -right-6 opacity-[0.03] text-foreground group-hover:rotate-12 transition-transform duration-700">
                            <ShieldIcon />
                        </div>
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
                    </div>
                </div>
            </div>
        </div>
    );
}

