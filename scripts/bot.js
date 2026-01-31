const { Client, GatewayIntentBits, ActivityType, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    },
    {
        name: 'shutdown',
        description: 'Immediately shut down game servers',
        options: [
            {
                name: 'job_id',
                description: 'The specific Roblox JobId to shut down (Leave empty for ALL servers)',
                type: 3, // STRING
                required: false,
            }
        ]
    },
    {
        name: 'ping',
        description: 'Check the bot response time and connection status',
    },
    {
        name: 'lookup',
        description: 'Lookup a Roblox player and see their status/actions',
        options: [
            {
                name: 'username',
                description: 'The Roblox username to lookup',
                type: 3, // STRING
                required: true,
            }
        ]
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

let statusIndex = 0;

async function syncStats() {
    const guildCount = client.guilds.cache.size;
    try {
        await supabase
            .from('bot_stats')
            .upsert({ id: 'global', guild_count: guildCount, updated_at: new Date() });
    } catch (e) {
        console.error('[STATS] Failed to sync guild count to Supabase:', e.message);
    }
}

function updateStatus() {
    const serverCount = client.guilds.cache.size;
    const supportUrl = "https://discord.gg/C3n4nAwYMw";

    const statuses = [
        `CONNECTING YOUR ROBLOX GAME TO DISCORD. JOIN OUR SUPPORT SERVER: \`\`\` ${supportUrl} \`\`\``,
        `CONNECTING ${serverCount} SERVERS TO ROBLOX. JOIN OUR SUPPORT SERVER: \`\`\` ${supportUrl} \`\`\``
    ];

    client.user.setActivity(statuses[statusIndex], { type: ActivityType.Custom });
    statusIndex = (statusIndex + 1) % statuses.length;
    syncStats();
}

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}! Bot is online.`);
    updateStatus();
    refreshCommands();
    setInterval(updateStatus, 15000); // Cycle every 15 seconds
});

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
    } else if (commandName === 'shutdown') {
        const jobId = interaction.options.getString('job_id');
        const { error } = await supabase
            .from('command_queue')
            .insert([{
                server_id: interaction.guildId,
                command: 'SHUTDOWN',
                args: { job_id: jobId, moderator: interaction.user.tag },
                status: 'PENDING'
            }]);

        if (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Failed to queue shutdown command.', ephemeral: true });
        }

        const targetMsg = jobId ? `server \`${jobId}\`` : 'all active game servers';
        await interaction.reply(`🛑 **SHUTDOWN SIGNAL SENT**! Closing ${targetMsg}.`);
    } else if (commandName === 'ping') {
        const latency = Math.abs(Date.now() - interaction.createdTimestamp);
        await interaction.reply(`🏓 **Pong!** \nLatency: \`${latency}ms\`\nStatus: \`Online (Vercel Integration Active)\``);
    } else if (commandName === 'lookup') {
        await interaction.deferReply();
        const username = interaction.options.getString('username');

        try {
            // 1. Get User ID
            const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
            });
            const searchData = await searchRes.json();

            if (!searchData.data || searchData.data.length === 0) {
                return interaction.editReply(`❌ Player \`${username}\` not found on Roblox.`);
            }

            const userId = searchData.data[0].id;

            // 2. Get Details & Thumb
            const [profileRes, thumbRes] = await Promise.all([
                fetch(`https://users.roblox.com/v1/users/${userId}`),
                fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`)
            ]);

            const profile = await profileRes.json();
            const thumb = await thumbRes.json();
            const avatarUrl = thumb.data?.[0]?.imageUrl || '';

            // 3. Check Presence
            const { data: servers } = await supabase
                .from('live_servers')
                .select('id, players')
                .eq('server_id', interaction.guildId);

            const activeServer = servers?.find((s) =>
                s.players?.some((p) => p.toLowerCase() === profile.name.toLowerCase())
            );

            // 4. Create Embed
            const embed = new EmbedBuilder()
                .setTitle(`Player Lookup: ${profile.displayName}`)
                .setURL(`https://www.roblox.com/users/${userId}/profile`)
                .setThumbnail(avatarUrl)
                .setColor(activeServer ? '#10b981' : profile.isBanned ? '#ef4444' : '#0ea5e9')
                .addFields(
                    { name: 'Username', value: `\`${profile.name}\``, inline: true },
                    { name: 'User ID', value: `\`${userId}\``, inline: true },
                    { name: 'Status', value: activeServer ? '🟢 **In-Game**' : '⚪ Offline', inline: true },
                    { name: 'Created', value: `<t:${Math.floor(new Date(profile.created).getTime() / 1000)}:R>`, inline: true },
                    { name: 'Description', value: profile.description || '*No description*', inline: false }
                )
                .setFooter({ text: 'Ro-Link Dashboard Integration' })
                .setTimestamp();

            // 5. Actions
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`kick_${userId}_${profile.name}`)
                    .setLabel('Kick')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`ban_${userId}_${profile.name}`)
                    .setLabel('Ban')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`unban_${userId}_${profile.name}`)
                    .setLabel('Unban')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Failed to fetch Roblox data.');
        }
    }
});

// Handle Button Interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, userId, username] = interaction.customId.split('_');
    const guildId = interaction.guildId;

    // Check permissions (Admin only)
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ You need Administrator permissions to use these actions.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // Queue command for Roblox
    const { error } = await supabase.from('command_queue').insert([{
        server_id: guildId,
        command: action.toUpperCase(),
        args: { username: username, reason: 'Discord Button Action', moderator: interaction.user.tag },
        status: 'PENDING'
    }]);

    if (error) {
        return interaction.editReply(`❌ Failed to queue ${action}.`);
    }

    // Log the action
    await supabase.from('logs').insert([{
        server_id: guildId,
        action: action.toUpperCase(),
        target: username,
        moderator: interaction.user.tag
    }]);

    await interaction.editReply(`✅ **${action.toUpperCase()}** command queued for \`${username}\`.`);
});

client.login(process.env.DISCORD_TOKEN);
