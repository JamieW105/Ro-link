import type { Metadata } from "next";
import "./globals.css";
import "./public-theme.css";
import NextAuthProvider from "./providers";
import { PublicThemeGate } from "@/components/public/PublicThemeGate";
import { PublicHeaderGate } from "@/components/public/PublicHeaderGate";
import { SiteBannerGate } from "@/components/SiteBannerGate";
import { DgsuAppealRedirect } from "@/components/DgsuAppealRedirect";
import { getSiteUrl, SITE_DESCRIPTION } from "@/lib/seo";
import Script from "next/script";

declare global {
  interface Window {
    beTracker?: { t: (options: { hash: string }) => void };
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: "Ro-Link | Connect Discord to Roblox",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Ro-Link | Connect Discord to Roblox",
    description: SITE_DESCRIPTION,
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
    description: SITE_DESCRIPTION,
    images: ["/Media/preview.png"],
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="https://tracker.metricool.com/resources/be.js"
          strategy="afterInteractive"
          onLoad={() => {
            window.beTracker?.t({ hash: "e171d0051cc25b8a22ff002c8b992d0b" });
          }}
        />
      </head>
      <body>
        <NextAuthProvider>
          <DgsuAppealRedirect />
          <PublicThemeGate>
            <PublicHeaderGate />
            <SiteBannerGate />
            {children}
          </PublicThemeGate>
        </NextAuthProvider>
      </body>
    </html>
  );
}
