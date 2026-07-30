import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { DGSU_BAN_AUTH_ERROR } from "@/lib/dgsuBanConstants";

export const metadata: Metadata = {
    title: "Dashboard | Ro-Link",
    description: "Sign in to your Ro-Link dashboard to manage your Roblox servers and communities.",
    openGraph: {
        title: "Dashboard | Ro-Link",
        description: "Access your Ro-Link dashboard. Securely manage and moderate your Roblox game servers from Discord.",
        images: [
            {
                url: "/Media/Ro-LinkIcon.png", // Ideally this should be a screenshot of the sign-in page
                width: 1200,
                height: 630,
                alt: "Ro-Link Dashboard Sign In",
            },
        ],
    },
};

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);
    if (session?.error === DGSU_BAN_AUTH_ERROR) {
        redirect("/report#appeal");
    }

    return <>{children}</>;
}
