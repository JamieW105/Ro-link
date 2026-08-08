import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Live Panel', (name) =>
        `Monitor live Roblox servers and players for ${name}, run moderation actions, and view real-time console activity.`);
}

export default function LivePanelLayout({ children }: { children: React.ReactNode }) {
    return children;
}
