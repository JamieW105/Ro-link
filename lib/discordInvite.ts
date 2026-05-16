const DISCORD_CLIENT_ID = '1466340007940722750';

const REQUIRED_BOT_PERMISSIONS = [
    0x2, // Kick Members
    0x4, // Ban Members
    0x400, // View Channels
    0x800, // Send Messages
    0x4000, // Embed Links
    0x8000000, // Manage Nicknames
    0x10000000, // Manage Roles
];

export const DISCORD_BOT_INVITE_PERMISSIONS = REQUIRED_BOT_PERMISSIONS.reduce(
    (total, permission) => total + permission,
    0,
);

export function getDiscordBotInviteUrl(guildId?: string) {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        permissions: String(DISCORD_BOT_INVITE_PERMISSIONS),
        scope: 'bot applications.commands',
    });

    if (guildId) {
        params.set('guild_id', guildId);
        params.set('disable_guild_select', 'true');
    }

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}
