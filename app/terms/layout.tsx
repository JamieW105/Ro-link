import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Terms of Service',
    description: 'Read the terms that apply when using Ro-Link, its Discord bot, Roblox integration, dashboard, and modules.',
    path: '/terms',
});

export default function TermsLayout({ children }: { children: React.ReactNode }) { return children; }
