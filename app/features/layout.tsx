import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Features',
    description: 'Explore Ro-Link features for live Roblox server visibility, Discord moderation, linked player identities, reports, and role-based staff access.',
    path: '/features',
});

export default function FeaturesLayout({ children }: { children: React.ReactNode }) { return children; }
