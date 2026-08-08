import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'People | Ro-Link Management', description: 'Review Ro-Link users, linked accounts, and access details.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
