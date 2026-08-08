import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Direct Messages | Ro-Link Management', description: 'Send and review authorized Ro-Link service messages.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
