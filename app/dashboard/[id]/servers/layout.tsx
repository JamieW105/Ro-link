import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Live Servers', (name) =>
        `View and manage every active Roblox server connected to ${name} through Ro-Link.`);
}

export default function LiveServersLayout({ children }: { children: React.ReactNode }) {
    return children;
}
