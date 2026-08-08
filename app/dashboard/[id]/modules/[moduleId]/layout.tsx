import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
    const { id, moduleId } = await params;
    const moduleLabel = moduleId.replace(/[-_]+/g, ' ').trim().slice(0, 80) || 'Module';
    return buildDashboardSectionMetadata(id, `${moduleLabel} Module`, (name) =>
        `Configure the ${moduleLabel} module for ${name}.`);
}

export default function ModuleConfigurationLayout({ children }: { children: React.ReactNode }) {
    return children;
}
