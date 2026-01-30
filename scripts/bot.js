const { Client, GatewayIntentBits, ActivityType, REST, Routes } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});

const commands = [
    {
        name: 'ban',
        description: 'Permanently ban a user from the Roblox game',
        options: [
            {
                name: 'username',
                description: 'The Roblox username to ban',
                type: 3, // STRING
                required: true,
            },
            {
                name: 'reason',
                description: 'Reason for the ban',
                type: 3,
                required: false,
            }
        ]
    },
    {
        name: 'kick',
        description: 'Kick a user from the game server',
        options: [
            {
                name: 'username',
                description: 'The Roblox username',
                type: 3,
                required: true,
            },
            {
                name: 'reason',
                description: 'Reason for the kick',
                type: 3,
                required: false,
            }
        ]
    },
    {
        name: 'unban',
        description: 'Unban a user from the Roblox game',
        options: [
            {
                name: 'username',
                description: 'The Roblox username to unban',
                type: 3,
                required: true,
            }
        ]
    },
    {
        name: 'update',
        description: 'Send a global update signal to all Roblox servers (restarts them)',
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function refreshCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    updateStatus();
    refreshCommands();
    setInterval(updateStatus, 600000);
});

function updateStatus() {
    const serverCount = client.guilds.cache.size;
    client.user.setActivity(`Connecting ${serverCount} servers to Roblox`, { type: ActivityType.Custom });
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, user } = interaction;

    // 1. Check if server is setup in Ro-Link
    const { data: server, error: serverError } = await supabase
        .from('servers')
        .select('id')
        .eq('id', guildId)
        .single();

    if (!server) {
        return interaction.reply({
            content: `❌ This server is not set up with Ro-Link yet. Please visit the dashboard to initialize it: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guildId}`,
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getString('username');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // 2. Add to Audit Logs
    await supabase.from('logs').insert([{
        server_id: guildId,
        action: commandName.toUpperCase(),
        target: targetUser,
        moderator: user.tag
    }]);

    // 3. Add to Command Queue for Roblox
    await supabase.from('command_queue').insert([{
        server_id: guildId,
        command: commandName.toUpperCase(),
        args: { username: targetUser, reason: reason, moderator: user.tag }
    }]);

    if (commandName === 'ban') {
        await interaction.reply(`🔨 **Banned** \`${targetUser}\` from Roblox game. Reason: ${reason}`);
    } else if (commandName === 'kick') {
        await interaction.reply(`🥾 **Kicked** \`${targetUser}\` from Roblox server. Reason: ${reason}`);
    } else if (commandName === 'unban') {
        const targetUser = interaction.options.getString('username');

        const { error } = await supabase
            .from('command_queue')
            .insert([{
                server_id: interaction.guildId,
                command: 'UNBAN',
                args: { username: targetUser, moderator: interaction.user.tag },
                status: 'PENDING'
            }]);

        if (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Failed to queue unban command.', ephemeral: true });
        }

        await interaction.reply(`🔓 **Unbanned** \`${targetUser}\` from Roblox. Command sent to game servers.`);
    } else if (commandName === 'update') {
        const { error } = await supabase
            .from('command_queue')
            .insert([{
                server_id: interaction.guildId,
                command: 'UPDATE',
                args: { moderator: interaction.user.tag },
                status: 'PENDING'
            }]);

        if (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Failed to queue update command.', ephemeral: true });
        }

        await interaction.reply(`🚀 **Update Signal Sent**! All game servers will restart shortly.`);
    }
});

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}! Bot is online.`);
});

client.login(process.env.DISCORD_TOKEN);
