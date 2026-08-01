import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Servers | Ro-Link Management', description: 'Review connected Discord servers and their Ro-Link status.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
