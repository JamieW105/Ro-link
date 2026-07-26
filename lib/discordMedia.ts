const DISCORD_MEDIA_HOSTS = new Set([
    'cdn.discordapp.com',
    'media.discordapp.net',
]);

const DISCORD_MEDIA_PATH = /^\/(?:icons|avatars|embed\/avatars)\//;

export function parseAllowedDiscordMediaUrl(input: unknown) {
    try {
        const url = new URL(String(input || ''));
        if (
            url.protocol !== 'https:'
            || !DISCORD_MEDIA_HOSTS.has(url.hostname.toLowerCase())
            || !DISCORD_MEDIA_PATH.test(url.pathname)
        ) {
            return null;
        }

        return url;
    } catch {
        return null;
    }
}

export function getDiscordMediaProxyUrl(input: unknown) {
    const url = parseAllowedDiscordMediaUrl(input);
    return url ? `/api/discord/media?url=${encodeURIComponent(url.toString())}` : '';
}

export function getDiscordGuildIconProxyUrl(guildId: string, icon: string, size = 128) {
    const url = new URL(`https://cdn.discordapp.com/icons/${encodeURIComponent(guildId)}/${encodeURIComponent(icon)}.png`);
    url.searchParams.set('size', String(size));
    return getDiscordMediaProxyUrl(url);
}

export function getDiscordAvatarProxyUrl(userId: string, avatar: string, size = 128) {
    const extension = avatar.startsWith('a_') ? 'gif' : 'png';
    const url = new URL(`https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatar)}.${extension}`);
    url.searchParams.set('size', String(size));
    return getDiscordMediaProxyUrl(url);
}

export function getDiscordDefaultAvatarProxyUrl(index = 0) {
    return getDiscordMediaProxyUrl(`https://cdn.discordapp.com/embed/avatars/${index}.png`);
}
