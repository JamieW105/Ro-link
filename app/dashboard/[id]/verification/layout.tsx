import { buildDashboardSectionMetadata } from '@/lib/dashboardSeo';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return buildDashboardSectionMetadata(id, 'Verification Settings', (name) =>
        `Configure Discord-to-Roblox account verification for ${name}.`);
}

export default function VerificationLayout({ children }: { children: React.ReactNode }) {
    return children;
}
