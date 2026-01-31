'use client';

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// SVGs
const RocketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.5-1 1-4c2 0 3 .5 3 .5L12 11Z" /><path d="M15 9h5s1 .5 4 1c0 2-.5 3-.5 3L11 12Z" /></svg>
);

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);

const ChartBarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>
);

const DiscordIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.076.076 0 0 0-.041.107a14.314 14.314 0 0 0 1.226 1.994a.075.075 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.175 1.086 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z" /></svg>
);

export default function Home() {
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [commandCount, setCommandCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchStats() {
      // Real-time Bot Server Count (Initial Fetch)
      const { data: bStats } = await supabase
        .from('bot_stats')
        .select('guild_count')
        .eq('id', 'global')
        .single();
      if (bStats) setServerCount(bStats.guild_count);

      // Commands
      const { count: cCount } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true });
      if (cCount !== null) setCommandCount(cCount);
    }

    fetchStats();

    // 1. Subscribe to Realtime Updates (Based off the bot's sync)
    const channel = supabase
      .channel('bot_stats_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bot_stats',
        filter: 'id=eq.global'
      }, (payload) => {
        if (payload.new && payload.new.guild_count !== undefined) {
          setServerCount(payload.new.guild_count);
        }
      })
      .subscribe();

    // 2. Fallback Polling (Every 60s)
    const interval = setInterval(fetchStats, 60000);

    return () => {
      supabase.removeChannel(channel);
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
          <div className="flex items-center gap-6">
            <a href="/docs" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Documentation
            </a>
            <button
              onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
              className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-all shadow-md shadow-sky-900/20"
            >
              Sign In
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="mt-32 pb-20 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-slate-400 text-xs font-medium mb-10">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            V1.0 Simple & Powerful
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-white leading-[1.1]">
            Reliable Management for <br />
            <span className="text-slate-400">Roblox Communities</span>
          </h1>

          <p className="max-w-2xl text-lg text-slate-400 mb-12 leading-relaxed">
            Connect your Discord to Roblox. Moderate your game and see live server data instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <a
              href="https://discord.com/api/oauth2/authorize?client_id=1466340007940722750&permissions=8&scope=bot%20applications.commands"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-slate-900 rounded-lg font-bold text-sm hover:bg-slate-100 transition-all"
            >
              <DiscordIcon />
              Add to Discord
            </a>
          </div>

          {/* Social Proof / Stats */}
          <div className="mt-24 pt-12 border-t border-slate-800/50 w-full grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem label="Servers" value={serverCount !== null ? serverCount.toLocaleString() : "0"} />
            <StatItem label="Commands" value={commandCount !== null ? commandCount.toLocaleString() : "0"} />
            <StatItem label="Response" value="< 45ms" />
            <StatItem label="Uptime" value="100%" />
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 w-full text-left">
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
        </main>

        <footer className="mt-40 py-12 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between text-slate-500">
          <p className="text-sm font-medium">© {new Date().getFullYear()} Ro-Link Systems Group</p>
          <div className="flex gap-8 mt-6 md:mt-0">
            <a href="#" className="text-xs hover:text-white transition-colors">Legal</a>
            <a href="#" className="text-xs hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-xs hover:text-white transition-colors">Status</a>
          </div>
        </footer>
      </div>
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
    <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all">
      <div className="text-sky-500 mb-6 bg-sky-500/10 w-10 h-10 rounded-lg flex items-center justify-center border border-sky-500/20">{icon}</div>
      <h3 className="text-lg font-semibold mb-3 text-white tracking-tight">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
