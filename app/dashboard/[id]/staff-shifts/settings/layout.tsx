import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return buildDashboardSectionMetadata(
        id,
        'Staff Shift Settings',
        (name) => `Manage staff shift settings for ${name}.`,
    );
}
export default function StaffShiftSettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
