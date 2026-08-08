import type { Metadata } from 'next';
import { cache } from 'react';

type DiscordGuildMetadata = {
    name?: string | null;
};

const DEFAULT_SERVER_NAME = 'Server';

function cleanServerName(value: unknown) {
    if (typeof value !== 'string') return DEFAULT_SERVER_NAME;
    return value.trim().slice(0, 100) || DEFAULT_SERVER_NAME;
}

export const getDashboardServerName = cache(async (serverId: string) => {
    const discordToken = process.env.DISCORD_TOKEN?.trim();
    if (!discordToken || !serverId) return DEFAULT_SERVER_NAME;

    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(serverId)}`, {
            headers: { Authorization: `Bot ${discordToken}` },
            next: { revalidate: 300 },
        });

        if (!response.ok) return DEFAULT_SERVER_NAME;

        const guild = await response.json() as DiscordGuildMetadata;
        return cleanServerName(guild.name);
    } catch (error) {
        console.warn('[SEO] Failed to load Discord server name', {
            serverId,
            error: error instanceof Error ? error.message : error,
        });
        return DEFAULT_SERVER_NAME;
    }
});

export async function buildServerDashboardMetadata(serverId: string): Promise<Metadata> {
    const serverName = await getDashboardServerName(serverId);
    const title = `${serverName} | Ro-Link Management Dashboard`;
    const description = `Manage ${serverName} with Ro-Link, including live Roblox servers, players, reports, modules, moderation tools, and server settings.`;

    return {
        title: {
            default: title,
            template: `${serverName} | Ro-Link %s`,
        },
        description,
        robots: {
            index: false,
            follow: false,
        },
        openGraph: {
            title,
            description,
            siteName: 'Ro-Link',
            type: 'website',
            images: [{
                url: '/Media/Ro-LinkIcon.png',
                width: 512,
                height: 512,
                alt: 'Ro-Link',
            }],
        },
        twitter: {
            card: 'summary',
            title,
            description,
            images: ['/Media/Ro-LinkIcon.png'],
        },
    };
}

export async function buildDashboardSectionMetadata(
    serverId: string,
    sectionTitle: string,
    description: (serverName: string) => string,
): Promise<Metadata> {
    const serverName = await getDashboardServerName(serverId);
    const pageTitle = `${serverName} | Ro-Link ${sectionTitle}`;
    const pageDescription = description(serverName);

    return {
        title: sectionTitle,
        description: pageDescription,
        openGraph: {
            title: pageTitle,
            description: pageDescription,
            siteName: 'Ro-Link',
            type: 'website',
            images: [{
                url: '/Media/Ro-LinkIcon.png',
                width: 512,
                height: 512,
                alt: 'Ro-Link',
            }],
        },
        twitter: {
            card: 'summary',
            title: pageTitle,
            description: pageDescription,
            images: ['/Media/Ro-LinkIcon.png'],
        },
    };
}
