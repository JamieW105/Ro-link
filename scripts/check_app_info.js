const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require('dotenv').config({ path: '.env.local' });

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function checkAppInfo() {
    try {
        console.log('Fetching Application Info...');
        // We use the current bot application endpoint
        const app = await rest.get(Routes.currentApplication());
        console.log(JSON.stringify(app, null, 2));

        console.log('\nFetching Bot User Info...');
        const user = await rest.get(Routes.user('@me'));
        console.log(JSON.stringify(user, null, 2));

    } catch (error) {
        console.error(error);
    }
}

checkAppInfo();
