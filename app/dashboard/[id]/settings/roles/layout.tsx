import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Role Settings', (name) => `Manage Discord role access and staff permissions for ${name}.`);
}

export default function RoleSettingsLayout({ children }: { children: React.ReactNode }) { return children; }
