import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string; reportId: string }> }) {
    const { id, reportId } = await params;
    const shortReportId = reportId.trim().slice(0, 12) || 'Details';
    return buildDashboardSectionMetadata(id, `Report ${shortReportId}`, (name) =>
        `Review report ${shortReportId}, its evidence, staff notes, and moderation outcome for ${name}.`);
}

export default function ReportDetailsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
