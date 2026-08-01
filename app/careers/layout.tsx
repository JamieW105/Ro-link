import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Careers',
    description: 'View open roles and apply to help build and support Ro-Link for Discord and Roblox communities.',
    path: '/careers',
});

export default function CareersLayout({ children }: { children: React.ReactNode }) { return children; }
