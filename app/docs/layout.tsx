import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Documentation | Ro-Link",
    description: "Learn how to set up Ro-Link, get your Place IDs, and integrate Discord with your Roblox game.",
    openGraph: {
        title: "Documentation | Ro-Link",
        description: "Ro-Link Setup Guide & Knowledge Base. Step-by-step instructions for Roblox developers.",
        images: [
            {
                url: "/Media/Ro-LinkIcon.png", // Replace with a screenshot of the docs page for a better preview
                width: 1200,
                height: 630,
                alt: "Ro-Link Documentation",
            },
        ],
    },
};

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
