'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import styles from '@/components/dashboard/theme.module.css';
import { isPublicSiteRoute } from '@/lib/siteRoutes';

export function PublicThemeGate({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const publicPage = isPublicSiteRoute(pathname) && !pathname.startsWith('/custom-dashboard');
    return publicPage ? <div data-public-theme className={`dice-ui-public dice-ui-dashboard min-h-dvh bg-background text-foreground ${styles.theme}`}>{children}</div> : children;
}
