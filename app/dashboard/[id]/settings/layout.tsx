import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Settings', (name) =>
        `Configure dashboard access, commands, logging, reports, roles, and Roblox setup for ${name}.`);
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
