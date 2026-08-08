import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Modules', (name) =>
        `Install, configure, and manage Ro-Link modules for ${name}.`);
}

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
