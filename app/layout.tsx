import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NextAuthProvider from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ro-Link | Connect Discord to Roblox",
  description: "Securely bridge Discord and Roblox. Manage communities, moderate players in real-time, and monitor live game server health with Ro-Link.",
  openGraph: {
    title: "Ro-Link | Connect Discord to Roblox",
    description: "The ultimate platform for bridging Discord and Roblox. High-performance moderation tool with real-time analytics.",
    url: "https://ro-link.vercel.app", // Fallback if production
    siteName: "Ro-Link",
    images: [
      {
        url: "/icon.png", // Use the large icon for social preview
        width: 512,
        height: 512,
        alt: "Ro-Link Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ro-Link | Connect Discord to Roblox",
    description: "Connect your Discord community to your Roblox games seamlessly.",
    images: ["/icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}
