import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Module Creator',
    description: 'Build, edit, test, and submit reusable Roblox modules through the Ro-Link module creator.',
    path: '/dashboard/creator/modules',
    index: false,
});

export default function ModuleCreatorLayout({ children }: { children: React.ReactNode }) { return children; }
