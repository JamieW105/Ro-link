'use client';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stat, StatValue, StatLabel } from "@/components/ui/stat";
import { ArrowRight, Check, Server, ShieldCheck, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
import { getDiscordBotInviteUrl } from '@/lib/discordInvite';

const coreFeatures = [
    {
        href: '/features#servers',
        icon: Server,
        title: 'Live servers',
        description: 'See active game servers and player presence.',
    },
    {
        href: '/features#moderation',
        icon: ShieldCheck,
        title: 'Moderation',
        description: 'Run supported staff actions from Discord.',
    },
    {
        href: '/features#permissions',
        icon: UserRoundCheck,
        title: 'Staff access',
        description: 'Match dashboard tools to Discord roles.',
    },
];

const setupSteps = [
    {
        number: '01',
        title: 'Install the bot',
        description: 'Add Ro-Link to your Discord server and choose the community you want to manage.',
    },
    {
        number: '02',
        title: 'Connect Roblox',
        description: 'Use the guided setup and Studio plugin to link your Roblox experience.',
    },
    {
        number: '03',
        title: 'Assign staff',
        description: 'Control which Discord roles can access commands and dashboard tools.',
    },
];

export default function Home() {
    const [stats, setStats] = useState<{
        guildCount: number | null;
        commandCount: number | null;
        latency: number | null;
    }>({ guildCount: null, commandCount: null, latency: null });

    useEffect(() => {
        let cancelled = false;

        async function redirectCustomDashboardHost() {
            try {
                const hostname = window.location.hostname;
                const response = await fetch(`/api/custom-dashboard/resolve?hostname=${encodeURIComponent(hostname)}`, {
                    cache: 'no-store',
                });

                if (!response.ok || cancelled) return;

                const data = await response.json() as { found?: boolean; serverId?: string; subdomain?: string };

                if (data.found && data.serverId) {
                    window.location.replace(`/custom-dashboard/${encodeURIComponent(data.serverId)}`);
                } else if (data.subdomain) {
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
        let cancelled = false;

        async function fetchStats() {
            const startedAt = performance.now();

            try {
                const response = await fetch('/api/stats', { cache: 'no-store' });

                if (!response.ok) throw new Error(`Stats request failed with ${response.status}`);

                const data = await response.json() as { guild_count?: number | null; command_count?: number | null };
                if (cancelled) return;

                setStats({
                    guildCount: data.guild_count ?? null,
                    commandCount: data.command_count ?? null,
                    latency: Math.round(performance.now() - startedAt),
                });
            } catch (error) {
                console.error('Failed to load public stats', error);
                if (!cancelled) {
                    setStats((current) => ({ ...current, latency: null }));
                }
            }
        }

        void fetchStats();
        const interval = window.setInterval(fetchStats, 10_000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    const formatStat = (value: number | null) => value === null ? '—' : value.toLocaleString();

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-landing-hero" aria-labelledby="home-title">
                    <PublicHeroBackdrop />
                    <div className="rl-shell">
                        <div className="rl-hero-content">
                            <p className="rl-eyebrow">Roblox game management</p>
                            <h1 className="rl-hero-title" id="home-title">
                                Manage your Roblox game <span>from Discord.</span>
                            </h1>
                            <p className="rl-hero-copy">
                                Give staff one direct place to inspect live servers, identify players, review reports, and run supported moderation actions.
                            </p>
                            <div className="rl-hero-actions">
                                <Button asChild variant="default"><a href={getDiscordBotInviteUrl()} target="_blank" rel="noopener noreferrer">
                                    Install Ro-Link
                                    <ArrowRight aria-hidden="true" width={14} height={14} />
                                </a></Button>
                                <Button asChild variant="outline"><Link href="/features">Explore features</Link></Button>
                            </div>
                            <div className="rl-hero-note" aria-label="Platform highlights">
                                <span><Check aria-hidden="true" /> Discord staff roles</span>
                                <span><Check aria-hidden="true" /> Live Roblox operations</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rl-feature-strip rl-shell" aria-label="Core Ro-Link features">
                    <div className="rl-feature-strip-inner">
                        {coreFeatures.map(({ href, icon: Icon, title, description }) => (
                            <Card className="rl-feature-summary" key={href}>
                                <span className="rl-feature-icon"><Icon aria-hidden="true" /></span>
                                <CardHeader className="gap-2 p-0"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription><Button asChild variant="link" className="h-auto justify-start p-0"><Link href={href}>Learn more <ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button></CardHeader>
                            </Card>
                        ))}
                    </div>
                </section>

                <section className="rl-stats-strip rl-shell" aria-label="Ro-Link live statistics">
                    <Stat className="rl-stat-item">
                        <StatValue>{formatStat(stats.guildCount)}</StatValue>
                        <StatLabel>Servers using Ro-Link</StatLabel>
                    </Stat>
                    <Stat className="rl-stat-item">
                        <StatValue>{formatStat(stats.commandCount)}</StatValue>
                        <StatLabel>All-time commands run</StatLabel>
                    </Stat>
                    <Stat className="rl-stat-item">
                        <StatValue>{stats.latency === null ? '—' : `${stats.latency} ms`}</StatValue>
                        <StatLabel>Latency</StatLabel>
                    </Stat>
                </section>

                <section className="rl-setup-section rl-shell" id="setup" aria-labelledby="setup-title">
                    <div className="rl-section-head">
                        <div>
                            <p className="rl-eyebrow">Simple setup</p>
                            <h2 className="rl-section-title" id="setup-title">Connect the tools your staff already use.</h2>
                        </div>
                        <p className="rl-section-copy">
                            Ro-Link sits between your Discord team and Roblox experience. Connect each side once, then assign the right staff access.
                        </p>
                    </div>
                    <div className="rl-setup-grid">
                        {setupSteps.map((step) => (
                            <Card className="rl-setup-step" key={step.number}>
                                <CardHeader className="gap-3 p-0"><span className="rl-step-number">{step.number}</span><CardTitle>{step.title}</CardTitle><CardDescription>{step.description}</CardDescription></CardHeader>
                            </Card>
                        ))}
                    </div>
                </section>

                <Card className="rl-compact-cta rl-shell" aria-labelledby="home-cta-title">
                    <CardHeader className="p-0"><CardTitle id="home-cta-title">Ready to connect your game?</CardTitle><CardDescription>Install Ro-Link and begin the guided setup.</CardDescription></CardHeader>
                    <Button asChild variant="default"><a href={getDiscordBotInviteUrl()} target="_blank" rel="noopener noreferrer">Install Ro-Link</a></Button>
                </Card>
            </main>
            <PublicFooter />
        </>
    );
}
