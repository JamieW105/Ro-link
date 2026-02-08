const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require('dotenv').config({ path: '.env.local' });

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function checkGuilds() {
    try {
        console.log('Fetching guilds via REST API...');
        const guilds = await rest.get(Routes.userGuilds());
        console.log(`API reports ${guilds.length} guilds.`);
        guilds.forEach(g => console.log(`- ${g.name} (${g.id})`));
    } catch (error) {
        console.error(error);
    }
}

checkGuilds();
