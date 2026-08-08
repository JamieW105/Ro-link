import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Audit Logs', (name) => `Search dashboard activity and moderation audit logs for ${name}.`);
}

export default function AuditLogsLayout({ children }: { children: React.ReactNode }) { return children; }
