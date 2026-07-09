function readEnv(name: string) {
    return process.env[name]?.trim() || '';
}

export function getDiscordOAuthConfig() {
    return {
        clientId: readEnv('DISCORD_OAUTH_CLIENT_ID') || readEnv('DISCORD_CLIENT_ID'),
        clientSecret: readEnv('DISCORD_OAUTH_CLIENT_SECRET') || readEnv('DISCORD_CLIENT_SECRET'),
    };
}
