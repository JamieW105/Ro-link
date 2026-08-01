import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Reports', (name) =>
        `Review player reports, evidence, and moderation outcomes for ${name}.`);
}

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
