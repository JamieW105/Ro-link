function readEnv(name: string) {
    return process.env[name]?.trim() || '';
}

export function getDiscordOAuthConfig() {
    return {
        // Discord includes this issuer in OAuth callbacks (RFC 9207).
        issuer: 'https://discord.com',
        clientId: readEnv('DISCORD_OAUTH_CLIENT_ID') || readEnv('DISCORD_CLIENT_ID'),
        clientSecret: readEnv('DISCORD_OAUTH_CLIENT_SECRET') || readEnv('DISCORD_CLIENT_SECRET'),
    };
}
