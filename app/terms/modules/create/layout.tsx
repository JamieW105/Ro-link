import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Module Creator Terms',
    description: 'Review the rules and responsibilities for creating and publishing modules through Ro-Link.',
    path: '/terms/modules/create',
});

export default function ModuleCreatorTermsLayout({ children }: { children: React.ReactNode }) { return children; }
