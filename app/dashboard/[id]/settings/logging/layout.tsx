import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Logging Settings', (name) => `Choose which Ro-Link activity ${name} records and where Discord logs are delivered.`);
}

export default function LoggingSettingsLayout({ children }: { children: React.ReactNode }) { return children; }
