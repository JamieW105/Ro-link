import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Roblox Setup', (name) => `Connect ${name} to Roblox and update its Ro-Link setup.`);
}

export default function SettingsSetupLayout({ children }: { children: React.ReactNode }) { return children; }
