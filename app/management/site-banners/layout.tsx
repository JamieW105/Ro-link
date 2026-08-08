import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Site Banners | Ro-Link Management', description: 'Create and schedule notices shown across Ro-Link.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
