import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Dashboard Settings', (name) => `Customize the Ro-Link dashboard experience for ${name}.`);
}

export default function DashboardSettingsLayout({ children }: { children: React.ReactNode }) { return children; }
