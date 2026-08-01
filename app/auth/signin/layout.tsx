import { createSeoMetadata } from '@/lib/seo';

export const metadata = createSeoMetadata({
    title: 'Sign In',
    description: 'Sign in with Discord to access your Ro-Link dashboard and connected Roblox communities.',
    path: '/auth/signin',
    index: false,
});

export default function SignInLayout({ children }: { children: React.ReactNode }) { return children; }
