import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Privacy Policy',
    description: 'Read how Ro-Link collects, uses, stores, and protects information across its Discord, Roblox, and web services.',
    path: '/privacy',
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) { return children; }
