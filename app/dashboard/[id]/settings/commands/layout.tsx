import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Command Settings', (name) => `Configure Ro-Link commands and permissions for ${name}.`);
}

export default function CommandSettingsLayout({ children }: { children: React.ReactNode }) { return children; }
