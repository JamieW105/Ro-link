import { createSeoMetadata } from '@/lib/seo';
import ManagementShell from '@/components/management/ManagementShell';

export const metadata = createSeoMetadata({
    title: 'Ro-Link Management Dashboard',
    description: 'Internal Ro-Link management for servers, users, jobs, updates, modules, messages, blocking, and site operations.',
    path: '/management',
    index: false,
});

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
    return <ManagementShell>{children}</ManagementShell>;
}
