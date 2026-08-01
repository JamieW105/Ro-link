import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Player Lookup', (name) =>
        `Look up Roblox players, linked identities, and moderation history for ${name}.`);
}

export default function PlayerLookupLayout({ children }: { children: React.ReactNode }) {
    return children;
}
