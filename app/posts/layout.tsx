import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Product Updates',
    description: 'Read the latest Ro-Link product updates, feature releases, improvements, and plugin changes.',
    path: '/posts',
});

export default function PostsLayout({ children }: { children: React.ReactNode }) { return children; }
