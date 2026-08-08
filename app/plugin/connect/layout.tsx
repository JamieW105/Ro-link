import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Connect Studio Plugin',
    description: 'Authorize the Ro-Link Roblox Studio plugin and connect it to your Discord server configuration.',
    path: '/plugin/connect',
    index: false,
});

export default function PluginConnectLayout({ children }: { children: React.ReactNode }) { return children; }
