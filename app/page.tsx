'use client';
import { ChartNoAxesCombined, Check, MessageCircle, Rocket, Server, Shield, Users, Zap } from "lucide-react";

import Link from 'next/link';
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { DEFAULT_ROLINK_VERSION } from "@/lib/updatePosts";
import { getDiscordBotInviteUrl } from "@/lib/discordInvite";

const SUPPORT_DISCORD_URL = "https://discord.gg/C3n4nAwYMw";
const STATUS_PAGE_URL = "https://status.rolink.cloud";

// SVGs
const RocketIcon = () => <Rocket size={18} aria-hidden="true" />;

const ShieldIcon = () => <Shield size={20} aria-hidden="true" />;

const ZapIcon = () => <Zap size={20} aria-hidden="true" />;

const ChartBarIcon = () => <ChartNoAxesCombined size={20} aria-hidden="true" />;

const ServerIcon = () => <Server size={20} aria-hidden="true" />;

const UsersIcon = () => <Users size={20} aria-hidden="true" />;

const CheckIcon = () => <Check size={18} aria-hidden="true" />;

const DiscordIcon = () => <MessageCircle size={18} aria-hidden="true" />;

export default function Home() {
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [commandCount, setCommandCount] = useState<number | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'operational' | 'degraded'>('checking');
  const [latestVersion, setLatestVersion] = useState(DEFAULT_ROLINK_VERSION);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function redirectCustomDashboardHost() {
      try {
        const hostname = window.location.hostname;
        const res = await fetch(`/api/custom-dashboard/resolve?hostname=${encodeURIComponent(hostname)}`, {
          cache: 'no-store',
        });

        if (!res.ok || cancelled) return;

        const data = await res.json() as { found?: boolean; serverId?: string; subdomain?: string };

        if (data.found && data.serverId) {
          window.location.replace(`/custom-dashboard/${encodeURIComponent(data.serverId)}`);
          return;
        }

        if (data.subdomain) {
          window.location.replace(`/custom-dashboard/not-found?subdomain=${encodeURIComponent(data.subdomain)}`);
        }
      } catch (error) {
        console.error('Failed to resolve custom dashboard host', error);
      }
    }

    redirectCustomDashboardHost();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function fetchStats() {
      // Real-time Bot Server Count (From Discord API)
      try {
        const requestStartedAt = performance.now();
        const res = await fetch('/api/stats');
        setResponseTimeMs(Math.max(1, Math.round(performance.now() - requestStartedAt)));
        setServiceStatus(res.ok ? 'operational' : 'degraded');
        const data = await res.json();
        if (data.guild_count !== undefined) setServerCount(data.guild_count);
        if (data.command_count !== undefined) setCommandCount(data.command_count);
      } catch (err) {
        console.error("Failed to fetch server count", err);
        setServiceStatus('degraded');
      }

      try {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        if (Array.isArray(posts)) {
          const latestPostWithVersion = posts.find((post) => (
            typeof post?.rolink_version === 'string' && post.rolink_version.trim()
          ) || (
            typeof post?.version === 'string' && post.version.trim()
          ));
          const rolinkVersion = typeof latestPostWithVersion?.rolink_version === 'string' && latestPostWithVersion.rolink_version.trim()
            ? latestPostWithVersion.rolink_version.trim()
            : typeof latestPostWithVersion?.version === 'string'
              ? latestPostWithVersion.version.trim()
              : '';
          if (rolinkVersion) {
            setLatestVersion(rolinkVersion);
          }
        }
      } catch (err) {
        console.error("Failed to fetch latest version", err);
      }
    }

    fetchStats();

    // Poll in place so landing stats stay fresh without a page reload.
    const interval = setInterval(fetchStats, 10000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-sky-500/30 overflow-x-hidden">
      {/* Refined Background Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-sky-950/20 to-transparent" />
        <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] bg-sky-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        {/* Navbar */}
        <nav className="flex items-center justify-between py-8">
          <div className="flex items-center gap-3">
            <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link Logo" className="w-9 h-9 rounded-lg object-contain" />
            <span className="text-xl font-semibold tracking-tight text-white pl-1">Ro-Link</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/posts" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Updates
            </Link>
            <a href="/docs" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Documentation
            </a>
            <Link href="/careers" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Careers
            </Link>
            <Link href="/report" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Report
            </Link>
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <DiscordIcon />
              Support Server
            </a>
            <button
              onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
              className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-all shadow-md shadow-sky-900/20"
            >
              Sign In
            </button>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          >
            {isMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-96 opacity-100 mb-8' : 'max-h-0 opacity-0'}`}>
          <div className="flex flex-col gap-4 bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
            <Link href="/posts" className="text-base font-semibold text-slate-300 hover:text-white transition-colors">
              Updates
            </Link>
            <a href="/docs" className="text-base font-semibold text-slate-300 hover:text-white transition-colors">
              Documentation
            </a>
            <Link href="/careers" className="text-base font-semibold text-slate-300 hover:text-white transit…114480 tokens truncated…xit
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* Minimalist Drawer Navigation Trigger (minimalist_drawer) */}
                        {customDashboardLayout === 'minimalist_drawer' && (
                            <button
                                onClick={() => setIsDrawerMenuOpen(true)}
                                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-850 backdrop-blur-md text-xs font-bold text-slate-300 hover:text-white hover:border-sky-500/30 transition-all mr-4"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                Navigation Menu
                            </button>
                        )}

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:block">Server ID</span>
                            <div className="h-4 w-[1px] bg-slate-800 mx-2 hidden sm:block"></div>
                            <code className="max-w-[180px] truncate rounded border border-sky-400/10 bg-sky-400/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-sky-400 sm:max-w-none">
                                {id}
                            </code>
                        </div>
                    </div>

                    <div className="flex w-full items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 sm:w-auto sm:justify-end sm:gap-6">
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)] ${networkState.className === 'text-emerald-500'
                                ? 'bg-emerald-500'
                                : networkState.className === 'text-amber-400'
                                    ? 'bg-amber-400'
                                    : networkState.className === 'text-red-400'
                                        ? 'bg-red-400'
                                        : 'bg-slate-400'
                                }`}></div>
                            <span className="hidden xs:inline">Network:</span> <span className={networkState.className}>{networkState.label}</span>
                        </div>
                        <div className="h-3 w-[1px] bg-slate-800 hidden sm:block"></div>
                        <span className="hidden sm:inline">API Latency:</span> <span className={`hidden sm:inline ${apiLatencyState === 'error' ? 'text-red-400' : 'text-sky-500'}`}>{apiLatencyLabel}</span>
                    </div>
                </header>

                <div className="dashboard-content-frame dashboard-premium-frame motion-page min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-tr from-[#020617] via-[#020617] to-sky-950/5 p-4 md:p-10 custom-scrollbar">
                    <PermissionsProvider permissions={userPermissions}>
                        {children}
                    </PermissionsProvider>
                </div>
            </main>

            {/* 3. Floating Bottom Dock Layout */}
            {customDashboardLayout === 'floating_dock' && (
                <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#090d16]/75 border border-slate-800/80 backdrop-blur-xl rounded-2xl px-4 py-3 items-center gap-3.5 shadow-2xl shadow-black/80 z-[40] transition-all duration-350 hover:border-sky-500/30 hover:shadow-sky-500/10">
                    {/* Utility Items */}
                    {utilityItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <div key={item.href} className="relative group">
                                <Link
                                    href={item.href}
                                    style={getNavLinkStyle(isActive)}
                                    className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border hover:scale-115 active:scale-95 duration-150 ${isActive
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    {item.label}
                                </div>
                            </div>
                        );
                    })}

                    {/* Divider */}
                    {moderationItems.length > 0 && <div className="w-[1px] h-6 bg-slate-800/80" />}

                    {/* Moderation Items */}
                    {moderationItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <div key={item.href} className="relative group">
                                <Link
                                    href={item.href}
                                    style={getNavLinkStyle(isActive)}
                                    className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border hover:scale-115 active:scale-95 duration-150 ${isActive
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    {item.label}
                                </div>
                            </div>
                        );
                    })}

                    {/* Divider */}
                    {settingItems.length > 0 && <div className="w-[1px] h-6 bg-slate-800/80" />}

                    {/* Settings Items */}
                    {settingItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <div key={item.href} className="relative group">
                                <Link
                                    href={item.href}
                                    style={getNavLinkStyle(isActive)}
                                    className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border hover:scale-115 active:scale-95 duration-150 ${isActive
                                        ? 'bg-sky-600/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-900/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <span style={getNavIconStyle(isActive)} className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    {item.label}
                                </div>
                            </div>
                        );
                    })}

                    {/* Exit Button */}
                    {!isCustomDashboardHost && (
                        <>
                            <div className="w-[1px] h-6 bg-slate-800/80" />
                            <div className="relative group">
                                <Link
                                    href="/dashboard"
                                    className="flex items-center justify-center w-11 h-11 rounded-xl transition-all border text-slate-500 hover:text-white hover:bg-slate-800/40 border-transparent hover:scale-115 active:scale-95 duration-150"
                                >
                                    <BackIcon />
                                </Link>
                                <div className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[#090d16]/95 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-slate-200 px-3 py-2 rounded-lg whitespace-nowrap shadow-2xl transition-all duration-200 z-[99] translate-y-2 group-hover:translate-y-0">
                                    Back to Servers
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 6. Minimalist Drawer Navigation Overlay (revealed full-screen when trigger clicked) */}
            {isDrawerMenuOpen && customDashboardLayout === 'minimalist_drawer' && (
                <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl z-[99] flex flex-col items-center justify-center p-6 md:p-24 transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
                    <button
                        onClick={() => setIsDrawerMenuOpen(false)}
                        className="absolute top-8 right-8 p-3 rounded-full border border-slate-800 text-slate-400 hover:text-white hover:rotate-90 hover:border-sky-500/30 transition-all duration-300 bg-slate-900/60 backdrop-blur-md"
                    >
                        <CloseIcon />
                    </button>

                    <div className="w-full max-w-5xl flex flex-col gap-12">
                        <div className="flex flex-col items-center text-center">
                            <img src={customDashboardLogo} alt="" className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-xl shadow-sky-500/10" />
                            <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white">{customDashboardBrand}</h2>
                            <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">Dashboard Navigation Hub</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Column 1: Utility */}
                            <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4">
                                <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase border-b border-slate-800/80 pb-2">Utility</h3>
                                <div className="flex flex-col gap-2">
                                    {utilityItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setIsDrawerMenuOpen(false)}
                                                style={getNavLinkStyle(isActive)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                    ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                }`}
                                            >
                                                <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Column 2: Moderation */}
                            {moderationItems.length > 0 && (
                                <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4">
                                    <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase border-b border-slate-800/80 pb-2">Moderation</h3>
                                    <div className="flex flex-col gap-2">
                                        {moderationItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setIsDrawerMenuOpen(false)}
                                                    style={getNavLinkStyle(isActive)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                        ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                                >
                                                    <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                                        {item.icon}
                                                    </span>
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Column 3: Settings */}
                            {settingItems.length > 0 && (
                                <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4">
                                    <h3 className="text-xs font-black tracking-widest text-slate-500 uppercase border-b border-slate-800/80 pb-2">Settings</h3>
                                    <div className="flex flex-col gap-2 font-sans">
                                        {settingItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setIsDrawerMenuOpen(false)}
                                                    style={getNavLinkStyle(isActive)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group font-semibold text-sm ${isActive
                                                        ? "bg-sky-600/10 text-sky-400 border border-sky-500/10 shadow-sm shadow-sky-900/5"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                                                    }`}
                                                >
                                                    <span style={getNavIconStyle(isActive)} className={`${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                                                        {item.icon}
                                                    </span>
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Back button */}
                        {!isCustomDashboardHost && (
                            <div className="flex justify-center mt-6">
                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsDrawerMenuOpen(false)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all font-semibold text-sm"
                                >
                                    <BackIcon />
                                    Back to Servers
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

