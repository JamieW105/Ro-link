import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'New Product Update | Ro-Link Management', description: 'Draft a new Ro-Link product update.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
