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
    },
    {
        name: 'setup',
        description: 'Initializes Ro-Link for this server (Owner Only)',
        options: [
            {
                name: 'place_id',
                description: 'The Roblox Place ID',
                type: 3, // STRING
                required: true,
            },
            {
                name: 'universe_id',
                description: 'The Roblox Universe ID',
                type: 3, // STRING
                required: true,
            },
            {
                name: 'api_key',
                description: 'Roblox Open Cloud API Key',
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
    let serverCount = client.guilds.cache.size;
    try {
        await supabase
            .from('bot_stats')
            .upsert({ id: 'global', guild_count: serverCount, updated_at: new Date() });
    } catch (e) {
        console.error('[STATS] Failed to sync server count:', e.message);
    }
}

async function updateStatus() {
    let serverCount = client.guilds.cache.size;
    const supportUrl = "https://discord.gg/C3n4nAwYMw";

    const statuses = [
        `CONNECTING YOUR ROBLOX GAME TO DISCORD. JOIN OUR SUPPORT SERVER: \`\`\` ${supportUrl} \`\`\``,
        `CONNECTING ${serverCount} SERVERS TO ROBLOX. JOIN OUR SUPPORT SERVER: \`\`\` ${supportUrl} \`\`\``
    ];

    try {
        // Using the raw Discord API with an Application Bearer Token
        const response = await fetch(`https://discord.com/api/v10/applications/${process.env.DISCORD_CLIENT_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${process.env.DISCORD_BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: statuses[statusIndex]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`[BOT] API Error: ${response.status} - ${err}`);
        } else {
            console.log(`[BOT] Description updated: Page ${statusIndex + 1}`);
        }
    } catch (e) {
        console.error('[BOT] Failed to patch application description:', e.message);
    }

    statusIndex = (statusIndex + 1) % statuses.length;
    syncStats();
}

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    let serverCount = client.guilds.cache.size;
    console.log(`The bot is in ${serverCount} servers.`);

    updateStatus();
    refreshCommands();
    setInterval(updateStatus, 15000); // Cycle every 15 seconds
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, user, guild } = interaction;

    // 1. Handle Setup separately (Owner Only)
    if (commandName === 'setup') {
        if (user.id !== guild?.ownerId) {
            return interaction.reply({
                content: '❌ This command can only be run by the server owner.',
                ephemeral: true
            });
        }

        const placeId = interaction.options.getString('place_id');
        const universeId = interaction.options.getString('universe_id');
        const openCloudKey = interaction.options.getString('api_key');
        const generatedKey = 'rl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        await interaction.deferReply({ ephemeral: true });

        const { error: dbError } = await supabase
            .from('servers')
            .upsert({
                id: guildId,
                place_id: placeId,
                universe_id: universeId,
                open_cloud_key: openCloudKey,
                api_key: generatedKey
            });

        if (dbError) {
            return interaction.editReply(`❌ Setup failed: ${dbError.message}`);
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Ro-Link Setup Complete')
            .setColor('#10b981')
            .setDescription('Your server has been successfully configured via Discord!')
            .addFields(
                { name: 'Security Key', value: `\`${generatedKey}\`` },
                { name: 'Place ID', value: `\`${placeId}\``, inline: true },
                { name: 'Universe ID', value: `\`${universeId}\``, inline: true },
                { name: 'Dashboard', value: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guildId}` }
            )
            .setFooter({ text: 'Keep your Security Key private!' })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }

    // 2. Handle Ping (Public)
    if (commandName === 'ping') {
        const latency = Math.abs(Date.now() - interaction.createdTimestamp);
        return interaction.reply(`🏓 **Pong!** \nLatency: \`${latency}ms\`\nStatus: \`Online (Vercel Integration Active)\``);
    }

    // 3. Check if server is setup in Ro-Link for all other commands
    const { data: server, error: serverError } = await supabase
        .from('servers')
        .select('id')
        .eq('id', guildId)
        .single();

    if (!server) {
        return interaction.reply({
            content: `❌ This server is not set up with Ro-Link yet.\n\n**Server Owners** can use \`/setup\` to initialize it directly, or visit the dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/${guildId}`,
            ephemeral: true
        });
    }

    // 4. Permission Check for Moderation Commands
    if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('BanMembers') && !interaction.member.permissions.has('KickMembers')) {
        return interaction.reply({
            content: '❌ You do not have permission to use moderation commands. (Requires Kick/Ban Members or Admin)',
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

            // 3. Check Presence, Logs & Server Info
            const [serversRes, logsRes, serverDataRes] = await Promise.all([
                supabase.from('live_servers').select('id, players').eq('server_id', interaction.guildId),
                supabase.from('logs').select('action, moderator, created_at').eq('server_id', interaction.guildId).eq('target', profile.name).order('created_at', { ascending: false }).limit(5),
                supabase.from('servers').select('place_id').eq('id', interaction.guildId).single()
            ]);

            const activeServer = serversRes.data?.find((s) =>
                s.players?.some((p) => p.toLowerCase() === profile.name.toLowerCase())
            );

            const serverInfo = serverDataRes.data;
            const logs = logsRes.data || [];
            const logField = logs.length > 0
                ? logs.map(l => `• **${l.action}** by ${l.moderator.split('#')[0]} (<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>)`).join('\n')
                : '*No previous moderation.*';

            const createdDate = new Date(profile.created);
            const accountAgeDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

            let statusText = activeServer ? `🟢 **In-Game**\n\`${activeServer.id}\`` : '⚪ Offline';
            if (profile.isBanned) statusText = '🔴 **Banned on Roblox**';

            // 4. Create Embed
            const embed = new EmbedBuilder()
                .setTitle(`Player Lookup: ${profile.displayName}`)
                .setURL(`https://www.roblox.com/users/${userId}/profile`)
                .setThumbnail(avatarUrl)
                .setColor(activeServer ? '#10b981' : profile.isBanned ? '#ef4444' : '#0ea5e9')
                .addFields(
                    { name: 'Username', value: `\`${profile.name}\``, inline: true },
                    { name: 'User ID', value: `\`${userId}\``, inline: true },
                    { name: 'Status', value: statusText, inline: true },
                    { name: 'Account Age', value: `\`${accountAgeDays.toLocaleString()} Days\``, inline: true },
                    { name: 'Created', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:D> (<t:${Math.floor(createdDate.getTime() / 1000)}:R>)`, inline: true },
                    { name: 'Description', value: profile.description ? (profile.description.length > 200 ? profile.description.substring(0, 197) + '...' : profile.description) : '*No description*', inline: false },
                    { name: '📜 Moderation History (Recent)', value: logField, inline: false }
                )
                .setFooter({ text: 'Ro-Link Dashboard Integration' })
                .setTimestamp();

            // 5. Actions
            const row = new ActionRowBuilder();

            row.addComponents(
                new ButtonBuilder()
                    .setLabel('View Profile')
                    .setURL(`https://www.roblox.com/users/${userId}/profile`)
                    .setStyle(ButtonStyle.Link)
            );

            if (activeServer && serverInfo?.place_id) {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('Join Server')
                        .setURL(`roblox://placeId=${serverInfo.place_id}&gameInstanceId=${activeServer.id}`)
                        .setStyle(ButtonStyle.Link)
                );
            }

            const row2 = new ActionRowBuilder().addComponents(
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

            await interaction.editReply({ embeds: [embed], components: [row, row2] });

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
