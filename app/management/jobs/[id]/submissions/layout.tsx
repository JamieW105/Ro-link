import { createSeoMetadata } from '@/lib/seo';
export const metadata = createSeoMetadata({ title: 'Career Submissions | Ro-Link Management', description: 'Review submissions for a Ro-Link career role.', index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
