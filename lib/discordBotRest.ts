import { REST } from '@discordjs/rest';

export function createDiscordBotRest() {
    const token = process.env.DISCORD_TOKEN?.trim();
    if (!token || !/^[A-Za-z0-9._-]+$/.test(token)) {
        return null;
    }

    return new REST({ version: '10' }).setToken(token);
}
