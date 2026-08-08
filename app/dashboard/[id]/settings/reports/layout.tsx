import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Report Settings', (name) => `Configure player reporting and report-management options for ${name}.`);
}

export default function ReportSettingsLayout({ children }: { children: React.ReactNode }) { return children; }
