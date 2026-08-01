import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string; username: string }> }) {
    const { id, username } = await params;
    const playerName = username.trim().slice(0, 80) || 'Roblox Player';
    return buildDashboardSectionMetadata(id, `${playerName} Player Profile`, (name) =>
        `View ${playerName}'s Roblox profile, live-server presence, and permitted moderation tools for ${name}.`);
}

export default function PlayerProfileLayout({ children }: { children: React.ReactNode }) {
    return children;
}
