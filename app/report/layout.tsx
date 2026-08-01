import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Submit a Public Report',
    description: 'Submit evidence-backed reports about users, Discord servers, or Roblox experiences to the Ro-Link safety team.',
    path: '/report',
});

export default function ReportLayout({ children }: { children: React.ReactNode }) { return children; }
