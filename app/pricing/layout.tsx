import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Pricing',
    description: 'Compare Ro-Link plans for Roblox community management, moderation, linked identities, and live server tools.',
    path: '/pricing',
});

export default function PricingLayout({ children }: { children: React.ReactNode }) { return children; }
