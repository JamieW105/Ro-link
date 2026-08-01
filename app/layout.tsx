import type { Metadata } from "next";
import "./globals.css";
import "./public-theme.css";
import NextAuthProvider from "./providers";
import { PublicHeaderGate } from "@/components/public/PublicHeaderGate";
import { SiteBannerGate } from "@/components/SiteBannerGate";
import { DgsuAppealRedirect } from "@/components/DgsuAppealRedirect";
import { getSiteUrl, SITE_DESCRIPTION } from "@/lib/seo";

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
    <html lang="en">
      <body>
        <NextAuthProvider>
          <DgsuAppealRedirect />
          <PublicHeaderGate />
          <SiteBannerGate />
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}
