import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NextAuthProvider from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ro-Link | Connect Discord to Roblox",
  description: "The ultimate platform for bridging Discord and Roblox. High-performance moderation tool with real-time analytics.",
  openGraph: {
    title: "Ro-Link | Connect Discord to Roblox",
    description: "The ultimate platform for bridging Discord and Roblox. High-performance moderation tool with real-time analytics.",
    url: "https://rolink.cloud",
    siteName: "Ro-Link",
    images: [
      {
        url: "/Media/Ro-LinkIcon.png",
        width: 512,
        height: 512,
        alt: "Ro-Link Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Ro-Link | Connect Discord to Roblox",
    description: "The ultimate platform for bridging Discord and Roblox. High-performance moderation tool with real-time analytics.",
    images: ["/Media/Ro-LinkIcon.png"],
  },
};

export const viewport = {
  themeColor: "#0ea5e9",
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
