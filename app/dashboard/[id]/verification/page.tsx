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

    useEffect(() => {
        async function fetchData() {
            if (!id || !session) return;

            // 1. Check Permissions (Already handled by layout but good to be safe)
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
                .select('verification_enabled, on_join_role, verified_role')
                .eq('id', id)
                .single();

            if (data && !dbError) {
                setEnabled(data.verification_enabled || false);
                setOnJoinRole(data.on_join_role || "");
                setVerifiedRole(data.verified_role || "");
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
                verified_role: verifiedRole
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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-sky-600/10 rounded-xl flex items-center justify-center text-sky-500 border border-sky-500/10 shadow-lg shadow-sky-900/5">
                    <ShieldIcon />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">Verification System</h1>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Manage your Roblox-to-Discord linking settings</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Settings */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <ShieldIcon />
                        </div>

                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/50">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Enable Verification</h3>
                                <p className="text-xs text-slate-500">Allow users to link their Roblox accounts.</p>
                            </div>
                            <button
                                onClick={() => setEnabled(!enabled)}
                                className={`w-14 h-7 rounded-full transition-all duration-300 relative ${enabled ? 'bg-sky-600 shadow-[0_0_15px_rgba(2,132,199,0.3)]' : 'bg-slate-800'}`}
                            >
                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 ${enabled ? 'left-8' : 'left-1'}`} />
                            </button>
                        </div>

                        <div className={`space-y-8 transition-all duration-500 ${!enabled ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 flex items-center gap-2">
                                    <RoleIcon />
                                    Verified Role
                                </label>
                                <select
                                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-600/50 transition-all cursor-pointer"
                                    value={verifiedRole}
                                    onChange={(e) => setVerifiedRole(e.target.value)}
                                >
                                    <option value="">None (Disabled)</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-600 font-medium pl-1">This role will be given to users after they successfully verify.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 flex items-center gap-2">
                                    <RoleIcon />
                                    On Join Role
                                </label>
                                <select
                                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-600/50 transition-all cursor-pointer"
                                    value={onJoinRole}
                                    onChange={(e) => setOnJoinRole(e.target.value)}
                                >
                                    <option value="">None (Disabled)</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-600 font-medium pl-1">This role will be given to users immediately when they join the server.</p>
                            </div>
                        </div>

                        <div className="mt-10 flex items-center gap-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-sky-900/10 text-xs disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <SaveIcon />
                                        SAVE SETTINGS
                                    </>
                                )}
                            </button>
                            {success && (
                                <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Saved Successfully</span>
                            )}
                            {error && (
                                <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">{error}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">How it works</h4>
                        <ul className="space-y-4">
                            <li className="flex gap-4">
                                <span className="text-sky-500 font-bold text-xs mt-0.5">01</span>
                                <p className="text-xs text-slate-500 leading-relaxed">Users visit the verification portal and link their Roblox account via OAuth2.</p>
                            </li>
                            <li className="flex gap-4">
                                <span className="text-sky-500 font-bold text-xs mt-0.5">02</span>
                                <p className="text-xs text-slate-500 leading-relaxed">Ro-Link stores the mapping and updates their roles in your Discord server.</p>
                            </li>
                            <li className="flex gap-4">
                                <span className="text-sky-500 font-bold text-xs mt-0.5">03</span>
                                <p className="text-xs text-slate-500 leading-relaxed">Existing members can also use <code className="text-sky-400 bg-sky-400/5 px-1 rounded">/get-roblox</code> to check verification status.</p>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-sky-600/5 border border-sky-500/10 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">Bot Permissions</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-4">Ensure the Ro-Link bot role is positioned <b>above</b> the roles you want it to assign.</p>
                        <div className="p-2.5 bg-sky-500/10 rounded-lg border border-sky-500/20 text-[9px] font-mono text-sky-300">
                            + Ro-Link Bot <br />
                            + Verified Role <br />
                            + On Join Role
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
