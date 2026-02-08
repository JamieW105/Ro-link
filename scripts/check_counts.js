const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require('dotenv').config({ path: '.env.local' });

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function checkCounts() {
    try {
        const app = await rest.get(Routes.currentApplication());
        console.log(`[DATA] Guilds: ${app.approximate_guild_count} | Users: ${app.approximate_user_install_count}`);

    } catch (error) {
        console.error(error);
    }
}
checkCounts();
