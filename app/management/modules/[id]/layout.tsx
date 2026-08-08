import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Module Review | Ro-Link Management', description: 'Inspect, test, approve, or reject a submitted Ro-Link module.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
