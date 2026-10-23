'use client';

import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DashboardTheme } from '@/components/dashboard/DashboardTheme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { SiteBanner } from '@/lib/siteBanners';
import { isPublicSiteRoute } from '@/lib/siteRoutes';

const toneIcons = {
    INFO: Info,
    SUCCESS: CheckCircle2,
    WARNING: AlertTriangle,
    CRITICAL: CircleAlert,
};

function isExternalUrl(url: string) {
    return /^https?:\/\//i.test(url);
}

export function SiteBannerGate() {
    const pathname = usePathname();
    const [banners, setBanners] = useState<SiteBanner[]>([]);
    const isPublic = isPublicSiteRoute(pathname);
    const isLivePanel = /^\/dashboard\/[^/]+\/live-panel(?:\/|$)/.test(pathname);

    useEffect(() => {
        if (isLivePanel) return;

        const controller = new AbortController();

        fetch('/api/site-banners', { cache: 'no-store', signal: controller.signal })
            .then((response) => response.ok ? response.json() : [])
            .then((payload) => setBanners(Array.isArray(payload) ? payload : []))
            .catch((error) => {
                if (error instanceof Error && error.name !== 'AbortError') setBanners([]);
            });

        return () => controller.abort();
    }, [pathname, isLivePanel]);

    const visibleBanners = banners.filter((banner) => (
        banner.placement === 'ALL'
        || (banner.placement === 'PUBLIC' && isPublic)
        || (banner.placement === 'DASHBOARD' && !isPublic)
    ));

    if (isLivePanel || visibleBanners.length === 0) return null;

    return (
        <DashboardTheme>
            <section className="relative z-35 bg-background text-foreground" aria-label="Site notices">
                {visibleBanners.map((banner) => {
                    const Icon = toneIcons[banner.tone];
                    const external = banner.linkUrl ? isExternalUrl(banner.linkUrl) : false;

                    return (
                        <Card className="rounded-none border-x-0 border-t-0 shadow-none" data-tone={banner.tone.toLowerCase()} key={banner.id}>
                            <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] md:px-8">
                                <Icon aria-hidden="true" className={cn("size-4 self-start mt-0.5 text-muted-foreground", {
                                    'text-emerald-600 dark:text-emerald-400': banner.tone === 'SUCCESS',
                                    'text-amber-600 dark:text-amber-400': banner.tone === 'WARNING',
                                    'text-destructive': banner.tone === 'CRITICAL',
                                })} />
                                <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
                                    <strong className="font-medium text-foreground">{banner.title}</strong>
                                    <span className="break-words text-muted-foreground">{banner.message}</span>
                                </div>
                                {banner.linkLabel && banner.linkUrl && (
                                    <Button asChild variant="ghost" size="sm" className="col-start-2 h-8 w-fit justify-self-start sm:col-start-auto sm:justify-self-end">
                                        <Link
                                            href={banner.linkUrl}
                                            target={external ? '_blank' : undefined}
                                            rel={external ? 'noopener noreferrer' : undefined}
                                        >
                                            {banner.linkLabel}
                                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </section>
        </DashboardTheme>
    );
}
