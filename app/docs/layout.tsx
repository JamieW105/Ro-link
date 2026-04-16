import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Documentation | Ro-Link",
    description: "Professional setup, operations, troubleshooting, and API docs for connecting Discord staff workflows to Roblox through Ro-Link.",
    openGraph: {
        title: "Documentation | Ro-Link",
        description: "Ro-Link documentation for setup, live operations, Roblox configuration, troubleshooting, and external API usage.",
        images: [
            {
                url: "/Media/Ro-LinkIcon.png",
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
