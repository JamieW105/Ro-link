import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Careers | Ro-Link Management', description: 'Create roles and review career applications for Ro-Link.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
