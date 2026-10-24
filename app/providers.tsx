'use client';

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";

export default function NextAuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="rolink-theme" disableTransitionOnChange enableColorScheme={false}>
        <SessionProvider refetchOnWindowFocus={false}>
            {children}
        </SessionProvider>
        </ThemeProvider>
    );
}
