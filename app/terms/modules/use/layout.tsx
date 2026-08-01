import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Module Use Terms',
    description: 'Review the terms for installing and using community modules through the Ro-Link marketplace.',
    path: '/terms/modules/use',
});

export default function ModuleUseTermsLayout({ children }: { children: React.ReactNode }) { return children; }
