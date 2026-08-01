import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Testing Site Access',
    description: 'Request and verify access to the restricted Ro-Link testing environment.',
    path: '/site-testing-access',
    index: false,
});

export default function TestingAccessLayout({ children }: { children: React.ReactNode }) { return children; }
