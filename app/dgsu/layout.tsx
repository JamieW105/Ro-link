import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Discord Global Server Unban',
    description: 'Learn how Ro-Link global server bans work, what they cover, and how eligible users can submit an appeal.',
    path: '/dgsu',
});

export default function DgsuLayout({ children }: { children: React.ReactNode }) { return children; }
