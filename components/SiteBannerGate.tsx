'use client';

import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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

    useEffect(() => {
        const controller = new AbortController();

        fetch('/api/site-banners', { cache: 'no-store', signal: controller.signal })
            .then((response) => response.ok ? response.json() : [])
            .then((payload) => setBanners(Array.isArray(payload) ? payload : []))
            .catch((error) => {
                if (error instanceof Error && error.name !== 'AbortError') setBanners([]);
            });

        return () => controller.abort();
    }, [pathname]);

    const visibleBanners = banners.filter((banner) => (
        banner.placement === 'ALL'
        || (banner.placement === 'PUBLIC' && isPublic)
        || (banner.placement === 'DASHBOARD' && !isPublic)
    ));

    if (visibleBanners.length === 0) return null;

    return (
        <section className="rl-site-banners" aria-label="Site notices">
            {visibleBanners.map((banner) => {
                const Icon = toneIcons[banner.tone];
                const external = banner.linkUrl ? isExternalUrl(banner.linkUrl) : false;

                return (
                    <div className="rl-site-banner" data-tone={banner.tone.toLowerCase()} key={banner.id}>
                        <div className="rl-site-banner-inner">
                            <span className="rl-site-banner-icon"><Icon aria-hidden="true" /></span>
                            <div className="rl-site-banner-copy">
                                <strong>{banner.title}</strong>
                                <span>{banner.message}</span>
                            </div>
                            {banner.linkLabel && banner.linkUrl && (
                                <Link
                                    className="rl-site-banner-link"
                                    href={banner.linkUrl}
                                    target={external ? '_blank' : undefined}
                                    rel={external ? 'noopener noreferrer' : undefined}
                                >
                                    {banner.linkLabel}
                                    <ArrowUpRight aria-hidden="true" />
                                </Link>
                            )}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
