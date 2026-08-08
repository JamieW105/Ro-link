import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Modules | Ro-Link Management', description: 'Review and manage Ro-Link marketplace modules.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
