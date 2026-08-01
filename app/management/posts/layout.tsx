import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Product Updates | Ro-Link Management', description: 'Create and manage Ro-Link product update posts.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
