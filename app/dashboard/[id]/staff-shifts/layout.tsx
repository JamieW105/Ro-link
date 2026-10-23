import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return buildDashboardSectionMetadata(
        id,
        'Staff Shifts',
        (name) => `View staff shifts and game time for ${name}.`,
    );
}
export default function StaffShiftsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
