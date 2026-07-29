'use client';

import { BarChart3 as LucideBarChart3, Check as LucideCheck, Menu as LucideMenu, MessageCircle as LucideMessageCircle, Server as LucideServer, Shield as LucideShield, Users as LucideUsers, X as LucideX, Zap as LucideZap } from 'lucide-react';

import Link from 'next/link';
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { DEFAULT_ROLINK_VERSION } from "@/lib/updatePosts";
import { getDiscordBotInviteUrl } from "@/lib/discordInvite";

const SUPPORT_DISCORD_URL = "https://discord.gg/C3n4nAwYMw";
const STATUS_PAGE_URL = "https://status.rolink.cloud";

const ShieldIcon = () => (
  <LucideShield width="20" height="20" strokeWidth="2" />
);

const ZapIcon = () => (
  <LucideZap width="20" height="20" strokeWidth="2" />
);

const ChartBarIcon = () => (
  <LucideBarChart3 width="20" height="20" strokeWidth="2" />
);

const ServerIcon = () => (
  <LucideServer width="20" height="20" strokeWidth="2" />
);

const UsersIcon = () => (
  <LucideUsers width="20" height="20" strokeWidth="2" />
);

const CheckIcon = () => (
  <LucideCheck width="18" height="18" strokeWidth="2.25" />
);

const DiscordIcon = () => (
  <LucideMessageCircle width="18" height="18" />
);

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
              <LucideX width="24" height="24" strokeWidth="2" />
            ) : (
              <LucideMenu width="24" height="24" strokeWidth="2" />
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
            <Link href="/careers" className="text-base font-semibold text-slate-300 hover:text-white transition-colors">
              Careers
            </Link>
            <Link href="/report" className="text-base font-semibold text-slate-300 hover:text-white transition-colors">
              Report
            </Link>
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <DiscordIcon />
              Support Server
            </a>
            <button
              onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
              className="w-full px-5 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-all shadow-md shadow-sky-900/10 text-center"
            >
              Sign In to Dashboard
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <main className="mt-20 md:mt-32 pb-20 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-slate-400 text-xs font-medium mb-10">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {latestVersion} Simple & Powerful
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-8 text-white leading-tight">
            Reliable Management for <br className="hidden sm:block" />
            <span className="text-slate-400">Roblox Communities</span>
          </h1>

          <p className="max-w-2xl text-base md:text-lg text-slate-400 mb-12 leading-relaxed px-4">
            Connect your Discord to Roblox. Moderate your game and see live server data instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center px-6">
            <a
              href={getDiscordBotInviteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-slate-900 rounded-lg font-bold text-sm hover:bg-slate-100 transition-all w-full sm:w-auto"
            >
              <DiscordIcon />
              Add to Discord
            </a>
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-8 py-3.5 border border-slate-700 bg-slate-900/60 text-white rounded-lg font-bold text-sm hover:border-slate-500 hover:bg-slate-800 transition-all w-full sm:w-auto"
            >
              <DiscordIcon />
              Join Discord
            </a>
          </div>

          {/* Social Proof / Stats */}
          <div className="motion-list mt-16 md:mt-24 pt-12 border-t border-slate-800/50 w-full grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4">
            <StatItem label="Servers" value={serverCount !== null ? serverCount.toLocaleString() : "0"} />
            <StatItem label="Commands" value={commandCount !== null ? commandCount.toLocaleString() : "0"} />
            <StatItem label="Response" value={responseTimeMs !== null ? `${responseTimeMs}ms` : "..."} />
            <StatItem label="API Status" value={serviceStatus === 'operational' ? "Live" : serviceStatus === 'degraded' ? "Issue" : "..."} />
          </div>

          {/* Features Grid */}
          <div className="motion-list grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-24 md:mt-40 w-full text-left px-2">
            <FeatureCard
              icon={<ZapIcon />}
              title="Real-time Execution"
              desc="Run moderation actions across all your game servers instantly."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Secure Setup"
              desc="Secure authentication ensures only authorized people can manage your games."
            />
            <FeatureCard
              icon={<ChartBarIcon />}
              title="Live Data"
              desc="See live data from every active server. Monitor player counts and server health."
            />
          </div>

          <section className="mt-24 md:mt-36 w-full text-left">
            <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-16 items-center">
              <div className="home-rise">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-6">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 home-pulse-dot" />
                  Built for Roblox operations
                </span>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                  Ro-Link is the control layer between your Discord team and your Roblox servers.
                </h2>
                <p className="mt-6 text-base md:text-lg text-slate-400 leading-relaxed max-w-2xl">
                  It gives community staff one place to manage live servers, review player activity, run moderation actions, and keep setup changes synced without jumping between Discord, Roblox Studio, and separate admin tools.
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoPill text="Discord slash commands" />
                  <InfoPill text="Live Roblox server data" />
                  <InfoPill text="Dashboard permissions" />
                  <InfoPill text="Studio plugin connection" />
                </div>
              </div>

              <BridgeVisual />
            </div>
          </section>

          <section className="mt-24 md:mt-36 w-full text-left">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div className="max-w-3xl">
                <span className="text-sm font-semibold text-sky-300">How it works</span>
                <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Connect once, then manage everything from the tools your staff already use.
                </h2>
              </div>
              <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-md">
                Ro-Link keeps the Discord bot, web dashboard, and Roblox plugin moving together so updates can flow both ways.
              </p>
            </div>

            <div className="motion-list grid grid-cols-1 md:grid-cols-3 gap-5">
              <WorkflowStep
                step="01"
                title="Add the Discord bot"
                desc="Bring Ro-Link into your server, then choose which staff roles can run commands or access dashboard tools."
              />
              <WorkflowStep
                step="02"
                title="Link your Roblox game"
                desc="Use the setup flow and plugin connection to register your Roblox experience with your Ro-Link dashboard."
              />
              <WorkflowStep
                step="03"
                title="Operate live servers"
                desc="Inspect active servers, view reports, run moderation actions, and keep community support moving quickly."
              />
            </div>
          </section>

          <section className="mt-24 md:mt-36 w-full text-left">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:gap-12">
              <div>
                <span className="text-sm font-semibold text-amber-300">What it helps with</span>
                <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Useful for daily moderation, support, and server visibility.
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UseCaseItem title="Moderation response" desc="Take action from Discord when a report needs attention." />
                <UseCaseItem title="Server awareness" desc="See active sessions, player counts, and server health from the dashboard." />
                <UseCaseItem title="Team access" desc="Give trusted staff the right level of control without sharing owner credentials." />
                <UseCaseItem title="Setup guidance" desc="Keep Roblox, Discord, and dashboard settings in one connected flow." />
              </div>
            </div>
          </section>

          <section className="mt-24 md:mt-36 w-full text-left">
            <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50 p-6 md:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent home-scan-line" />
              <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 items-center">
                <div>
                  <span className="text-sm font-semibold text-rose-300">Designed for growing groups</span>
                  <h2 className="mt-3 text-2xl md:text-4xl font-bold tracking-tight text-white">
                    Less tab switching. Faster decisions. Cleaner community operations.
                  </h2>
                  <p className="mt-4 text-slate-400 leading-relaxed">
                    Ro-Link focuses on the work that happens after launch: handling reports, checking servers, helping staff act with context, and keeping your Roblox community connected to your Discord team.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MetricCard value="Live" label="server snapshots" tone="sky" />
                  <MetricCard value="Role" label="based access" tone="emerald" />
                  <MetricCard value="Fast" label="staff workflows" tone="amber" />
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-24 md:mt-40 py-12 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between text-slate-500">
          <p className="text-sm font-medium">© {new Date().getFullYear()} Core Engine Solutions Management Group</p>
          <div className="flex gap-8 mt-6 md:mt-0">
            <Link href="/posts" className="text-xs hover:text-white transition-colors">Updates</Link>
            <Link href="/report" className="text-xs hover:text-white transition-colors">Report</Link>
            <Link href="/terms" className="text-xs hover:text-white transition-colors">Legal</Link>
            <Link href="/dgsu" className="text-xs hover:text-white transition-colors">DGSU</Link>
            <Link href="/privacy" className="text-xs hover:text-white transition-colors">Privacy</Link>
            <a href={STATUS_PAGE_URL} target="_blank" rel="noopener noreferrer" className="text-xs hover:text-white transition-colors">Status</a>
          </div>
        </footer>
      </div>

      <style>{`
        .home-rise {
          animation: homeRise 0.7s ease-out both;
        }

        .home-pulse-dot {
          box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.45);
          animation: homePulse 2.2s ease-out infinite;
        }

        .home-bridge-panel {
          animation: homeFloat 7s ease-in-out infinite;
        }

        .home-bridge-line {
          background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.8), rgba(52, 211, 153, 0.7), transparent);
          animation: homeLineFlow 3.6s linear infinite;
        }

        .home-packet {
          animation: homePacket 3.6s ease-in-out infinite;
        }

        .home-packet:nth-child(2) {
          animation-delay: 0.9s;
        }

        .home-packet:nth-child(3) {
          animation-delay: 1.8s;
        }

        .home-signal-card {
          animation: homeSignalFloat 5.5s ease-in-out infinite;
        }

        .home-signal-card:nth-child(2) {
          animation-delay: 0.8s;
        }

        .home-signal-card:nth-child(3) {
          animation-delay: 1.6s;
        }

        .home-workflow-card {
          transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease;
        }

        .home-workflow-card:hover {
          transform: translateY(-4px);
        }

        .home-scan-line {
          animation: homeScan 3s ease-in-out infinite;
        }

        @keyframes homeRise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes homePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.45);
          }
          75% {
            box-shadow: 0 0 0 10px rgba(52, 211, 153, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
          }
        }

        @keyframes homeFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes homeLineFlow {
          from {
            transform: translateX(-35%);
          }
          to {
            transform: translateX(35%);
          }
        }

        @keyframes homePacket {
          0% {
            opacity: 0;
            transform: translateX(-110px) scale(0.8);
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(110px) scale(1);
          }
        }

        @keyframes homeSignalFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes homeScan {
          0%, 100% {
            opacity: 0.35;
            transform: translateX(-35%);
          }
          50% {
            opacity: 1;
            transform: translateX(35%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .home-rise,
          .home-pulse-dot,
          .home-bridge-panel,
          .home-bridge-line,
          .home-packet,
          .home-signal-card,
          .home-scan-line {
            animation: none;
          }

          .home-workflow-card:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}

function StatItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold text-white mb-1">{value}</span>
      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="interactive-lift subtle-glow p-8 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all">
      <div className="text-sky-500 mb-6 bg-sky-500/10 w-10 h-10 rounded-lg flex items-center justify-center border border-sky-500/20">{icon}</div>
      <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function InfoPill({ text }: { text: string }) {
  return (
    <div className="interactive-lift flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm font-semibold text-slate-300">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
        <CheckIcon />
      </span>
      {text}
    </div>
  );
}

function BridgeVisual() {
  return (
    <div className="home-bridge-panel relative min-h-[420px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-5 md:p-7">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:34px_34px]" />
      <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-between">
        <div className="flex items-center justify-between gap-4">
          <SignalCard icon={<DiscordIcon />} title="Discord" desc="Commands, staff roles, alerts" tone="sky" />
          <SignalCard icon={<ServerIcon />} title="Roblox" desc="Servers, players, reports" tone="emerald" />
        </div>

        <div className="relative my-8 flex items-center justify-center">
          <div className="absolute h-px w-full overflow-hidden bg-slate-800">
            <div className="home-bridge-line h-full w-[160%]" />
          </div>
          <div className="absolute flex items-center justify-center">
            <span className="home-packet absolute h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_22px_rgba(56,189,248,0.85)]" />
            <span className="home-packet absolute h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.85)]" />
            <span className="home-packet absolute h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_22px_rgba(252,211,77,0.85)]" />
          </div>
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-sky-400/30 bg-slate-900 shadow-2xl shadow-sky-950/40">
            <img src="/Media/Ro-LinkIcon.png" alt="Ro-Link" className="h-12 w-12 rounded-xl object-contain" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SignalMini label="Verify" value="Members" />
          <SignalMini label="Moderate" value="Servers" />
          <SignalMini label="Review" value="Reports" />
        </div>
      </div>
    </div>
  );
}

function SignalCard({ icon, title, desc, tone }: { icon: React.ReactNode, title: string, desc: string, tone: 'sky' | 'emerald' }) {
  const toneClasses = tone === 'sky'
    ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
    : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';

  return (
    <div className="home-signal-card w-full rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg border ${toneClasses}`}>
        {icon}
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function SignalMini({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-200">{value}</div>
    </div>
  );
}

function WorkflowStep({ step, title, desc }: { step: string, title: string, desc: string }) {
  return (
    <div className="home-workflow-card subtle-glow rounded-xl border border-slate-800 bg-slate-900/40 p-6 hover:border-sky-500/40 hover:bg-slate-900/70">
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sm font-bold text-sky-300">
        {step}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function UseCaseItem({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="interactive-lift rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all hover:border-amber-400/30">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
        <UsersIcon />
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function MetricCard({ value, label, tone }: { value: string, label: string, tone: 'sky' | 'emerald' | 'amber' }) {
  const toneClasses = {
    sky: 'text-sky-300 border-sky-500/20 bg-sky-500/10',
    emerald: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10',
    amber: 'text-amber-300 border-amber-500/20 bg-amber-500/10',
  }[tone];

  return (
    <div className={`interactive-lift rounded-xl border p-5 ${toneClasses}`}>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
