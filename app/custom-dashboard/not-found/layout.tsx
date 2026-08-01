import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Dashboard Not Found',
    description: 'The requested custom Ro-Link dashboard could not be found.',
    index: false,
});

export default function CustomDashboardNotFoundLayout({ children }: { children: React.ReactNode }) { return children; }
