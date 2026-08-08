import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Player Tools', (name) =>
        `Use permitted Roblox player and character tools for ${name} through the Ro-Link dashboard.`);
}

export default function PlayerToolsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
