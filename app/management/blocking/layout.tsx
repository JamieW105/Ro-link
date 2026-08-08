import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Server Blocking | Ro-Link Management', description: 'Manage servers blocked from using Ro-Link.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
