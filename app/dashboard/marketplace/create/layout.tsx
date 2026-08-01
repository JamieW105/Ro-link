import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Publish a Module',
    description: 'Create and submit a Roblox module for review in the Ro-Link marketplace.',
    path: '/dashboard/marketplace/create',
    index: false,
});

export default function CreateMarketplaceModuleLayout({ children }: { children: React.ReactNode }) { return children; }
