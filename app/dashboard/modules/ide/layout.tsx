import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Module IDE | Ro-Link',
    description: 'Build and synchronize Ro-Link module projects with Roblox Studio.',
    robots: { index: false, follow: false },
};

export default function ModuleIdeLayout({ children }: { children: React.ReactNode }) {
    return children;
}
