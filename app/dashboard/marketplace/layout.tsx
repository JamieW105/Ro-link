import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Module Marketplace',
    description: 'Discover published modules that extend connected Roblox experiences through Ro-Link.',
    path: '/dashboard/marketplace',
    index: false,
});

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) { return children; }
