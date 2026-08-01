import type { Metadata } from 'next';

import ServerDashboardShell from '@/components/dashboard/ServerDashboardShell';
import { buildServerDashboardMetadata } from '@/lib/dashboardSeo';

type DashboardLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DashboardLayoutProps): Promise<Metadata> {
    const { id } = await params;
    return buildServerDashboardMetadata(id);
}

export default function DashboardServerLayout({ children }: DashboardLayoutProps) {
    return <ServerDashboardShell>{children}</ServerDashboardShell>;
}
