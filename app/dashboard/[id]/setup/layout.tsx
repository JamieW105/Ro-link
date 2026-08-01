import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Roblox Setup', (name) =>
        `Connect ${name} to Roblox and complete the guided Ro-Link server setup.`);
}

export default function SetupLayout({ children }: { children: React.ReactNode }) {
    return children;
}
