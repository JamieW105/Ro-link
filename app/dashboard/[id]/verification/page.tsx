'use client';

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
);

const SaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
);

const RoleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
);

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
            const { data, error: dbError } = await supabase
                .from('servers')
                .select('verification_enabled, on_join_role, verified_role, block_unverified')
                .eq('id', id)
                .single();

            if (data && !dbError) {
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

        const { error: dbError } = await supabase
            .from('servers')
            .update({
                verification_enabled: enabled,
                on_join_role: onJoinRole,
                verified_role: verifiedRole,
                block_unverified: blockUnverified
            })
            .eq('id', id);

        if (dbError) {
            setError(dbError.message);
        } else {
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        }
        setSaving(false);
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full pb-20">
            {/* Page Header - Integrated Layout */}
            <div className="mb-10 pb-8 border-b border-slate-800/60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-sky-600/10 rounded-2xl flex items-center justify-center text-sky-500 border border-sky-500/20 shadow-2xl shadow-sky-900/10">
                            <ShieldIcon />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Verification</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                                    {enabled ? 'System Operational' : 'System Disabled'}
                                </p>
                            </div>
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
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    {/* Primary Config Section */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] text-white">
                            <ShieldIcon />
                        </div>

                        <div className="flex items-center justify-between mb-12">
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Toggle Verification</h3>
                                <p className="text-sm text-slate-500">Enable or disable the Roblox-to-Discord linking flow for this server.</p>
                            </div>
                            <button
                                onClick={() => setEnabled(!enabled)}
                                className={`w-16 h-8 rounded-full transition-all duration-500 relative border-2 ${enabled ? 'bg-sky-600/20 border-sky-500 shadow-[0_0_20px_rgba(2,132,199,0.2)]' : 'bg-slate-800/40 border-slate-700'}`}
                            >
                                <div className={`absolute top-1 w-4.5 h-4.5 rounded-full transition-all duration-500 shadow-md ${enabled ? 'left-9 bg-sky-400' : 'left-1.5 bg-slate-500'}`} />
                            </button>
                        </div>

                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 transition-all duration-700 ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] pl-1 flex items-center gap-2">
                                    <RoleIcon />
                                    Verified Role
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-slate-950/50 border border-slate-800/80 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-600/30 transition-all cursor-pointer hover:border-slate-700"
                                        value={verifiedRole}
                                        onChange={(e) => setVerifiedRole(e.target.value)}
                                    >
                                        <option value="">None (Disabled)</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium pl-2 leading-relaxed italic">Awarded automatically after a successful Roblox link.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] pl-1 flex items-center gap-2">
                                    <RoleIcon />
                                    On Join Role
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-slate-950/50 border border-slate-800/80 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-600/30 transition-all cursor-pointer hover:border-slate-700"
                                        value={onJoinRole}
                                        onChange={(e) => setOnJoinRole(e.target.value)}
                                    >
                                        <option value="">None (Disabled)</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium pl-2 leading-relaxed italic">Awarded immediately when a member joins the Discord server.</p>
                            </div>
                        </div>

                        {/* Extra Safety Setting */}
                        <div className={`mt-12 pt-10 border-t border-slate-800/60 transition-all duration-700 ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between p-6 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                <div className="flex items-center gap-5">
                                    <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 border border-red-500/20 shadow-lg shadow-red-900/5">
                                        <ShieldIcon />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-tight">Block Unverified Joins</h4>
                                        <p className="text-[11px] text-slate-500 font-medium mt-1">Automatically kick players from the Roblox game if they haven't linked their Discord account.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setBlockUnverified(!blockUnverified)}
                                    className={`w-14 h-7 rounded-full transition-all duration-500 relative border-2 ${blockUnverified ? 'bg-red-600/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-slate-800/40 border-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3.5 h-3.5 rounded-full transition-all duration-500 shadow-md ${blockUnverified ? 'left-8 bg-red-500' : 'left-1.5 bg-slate-500'}`} />
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

                    {/* Status Box */}
                    <div className="p-8 bg-slate-900/20 border border-slate-800 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/10">
                                <InfoIcon />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-tight">System Status</h4>
                                <p className="text-[11px] text-slate-500 font-medium tracking-tight mt-0.5">Ro-Link authentication servers are currently synced and stable.</p>
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
                            Documentation
                        </h4>
                        <div className="space-y-8">
                            {[
                                { step: "01", text: "Users link via Ro-Link portal using Roblox OAuth2." },
                                { step: "02", text: "Roles are instantly synced across all eligible servers." },
                                { step: "03", text: "Administrators can pull verification data via API." }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <span className="text-sky-500 font-black text-xs mt-0.5 group-hover:scale-110 transition-transform">
                                        {item.step}
                                    </span>
                                    <p className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-300 transition-colors">
                                        {item.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-sky-600/5 border border-sky-500/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-sky-500/30 transition-all">
                        <div className="absolute -bottom-6 -right-6 opacity-[0.03] text-sky-400 group-hover:rotate-12 transition-transform duration-700">
                            <ShieldIcon />
                        </div>
                        <h4 className="text-sm font-bold text-sky-400 mb-2">Bot Context</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-6">Ro-Link requires its role to be above any roles it attempts to assign.</p>
                        <div className="p-5 bg-slate-950/60 rounded-2xl border border-sky-500/20 text-[10px] font-mono text-sky-300 leading-loose">
                            <div className="flex justify-between border-b border-sky-500/10 pb-2 mb-2">
                                <span className="opacity-50">Role Hierarchy</span>
                                <span className="text-sky-500 font-bold">Priority</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>
                                Ro-Link Bot
                            </div>
                            <div className="flex items-center gap-3 ml-4 opacity-50">
                                <span className="w-1 h-px bg-sky-900"></span>
                                Verified Role
                            </div>
                            <div className="flex items-center gap-3 ml-4 opacity-50">
                                <span className="w-1 h-px bg-sky-900"></span>
                                On Join Role
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
