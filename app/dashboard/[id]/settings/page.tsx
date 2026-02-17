'use client';

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

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

export default function SettingsPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [adminCmds, setAdminCmds] = useState(true);
    const [miscCmds, setMiscCmds] = useState(true);

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
                .select('admin_cmds_enabled, misc_cmds_enabled')
                .eq('id', id)
                .single();

            if (data && !dbError) {
                setAdminCmds(data.admin_cmds_enabled !== false); // Default to true if null
                setMiscCmds(data.misc_cmds_enabled !== false);   // Default to true if null
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
                admin_cmds_enabled: adminCmds,
                misc_cmds_enabled: miscCmds
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
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    {/* Command Config Section */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 backdrop-blur-sm relative overflow-hidden">

                        <div className="flex items-start gap-6 mb-8">
                            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-500 border border-sky-500/10">
                                <CommandIcon />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Command Modules</h3>
                                <p className="text-sm text-slate-500 leading-relaxed max-w-lg">Enable or disable specific command categories. Disabled commands will not function in-game.</p>
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
