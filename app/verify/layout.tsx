import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Link Your Roblox Account',
    description: 'Securely link your Discord identity to your Roblox account for Ro-Link verification and community features.',
    path: '/verify',
    index: false,
});

export default function VerifyLayout({ children }: { children: React.ReactNode }) { return children; }
