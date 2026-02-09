const { Client, GatewayIntentBits, ActivityType, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { setGlobalDispatcher, Agent } = require('undici');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

setGlobalDispatcher(new Agent({
    connect: { timeout: 60_000 },
    headersTimeout: 60_000,
    bodyTimeout: 60_000,
}));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
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
        name: 'misc',
        description: 'Perform miscellaneous player actions (Fly, Noclip, etc.)',
        options: []
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
        name: 'setup',
        description: 'Initializes Ro-Link for this server (Owner Only)',
    },
    {
        name: 'help',
        description: 'Show info and list of available commands',
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

async function cleanupLiveServers() {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { error, count } = await supabase
            .from('live_servers')
            .delete({ count: 'exact' })
            .lt('updated_at', fiveMinutesAgo);

        if (!error && count && count > 0) {
            console.log(`[CLEANUP] Removed ${count} stale servers.`);
        }
    } catch (e) {
        console.error('[CLEANUP] Failed to remove stale servers:', e.message);
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
    cleanupLiveServers();
    setInterval(updateStatus, 15000); // Cycle every 15 seconds
    setInterval(cleanupLiveServers, 60000); // Cleanup every minute
});

client.on('guildCreate', guild => {
    console.log(`[GUILD] Joined new guild: ${guild.name} (${guild.id})`);
    syncStats();
    updateStatus();
});

client.on('guildDelete', guild => {
    console.log(`[GUILD] Left guild: ${guild.name} (${guild.id})`);
    syncStats();
    updateStatus();
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

        // Check if already setup
        const { data: existingServer } = await supabase
            .from('servers')
            .select('*')
            .eq('id', guildId)
            .maybeSingle();

        if (existingServer) {
            const embeds = getSetupEmbeds(guildId, existingServer.api_key);
            return interaction.reply({
                content: 'ℹ️ **This server is already set up!** Here are your integration details:',
                embeds: embeds,
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('setup_modal')
            .setTitle('Ro-Link Server Setup');

        const placeIdInput = new TextInputBuilder()
            .setCustomId('place_id')
            .setLabel("Roblox Place ID")
            .setPlaceholder('Enter your Place ID (e.g. 123456789)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const universeIdInput = new TextInputBuilder()
            .setCustomId('universe_id')
            .setLabel("Roblox Universe ID")
            .setPlaceholder('Enter your Universe ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const apiKeyInput = new TextInputBuilder()
            .setCustomId('api_key')
            .setLabel("Open Cloud API Key")
            .setPlaceholder('Enter your Roblox API Key (Hidden)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(placeIdInput),
            new ActionRowBuilder().addComponents(universeIdInput),
            new ActionRowBuilder().addComponents(apiKeyInput)
        );

        return await interaction.showModal(modal);
    }

    // 2. Handle Ping (Public)
    if (commandName === 'ping') {
        const latency = Math.abs(Date.now() - interaction.createdTimestamp);
        return interaction.reply(`🏓 **Pong!** \nLatency: \`${latency}ms\`\nStatus: \`Online (Vercel Integration Active)\``);
    }

    // 3. Handle Help (Public)
    if (commandName === 'help') {
        const infoEmbed = new EmbedBuilder()
            .setTitle('Info')
            .setColor('#0ea5e9')
            .setDescription("Welcome to Ro-Link. We are a platform that enables you to connect your Discord / cmds to Roblox. We make the connection between Discord and Roblox feel like a very small gap. We allow kick, ban and unban cmds along with an advanced dashboard to show you your servers and player count.\n\nGive us a try, we are aways looking to help all community's no matter the size. Ro-link is perfect for any game and allows you to respond to urgent reports without the bother of having to join in game.");

        const commandsEmbed = new EmbedBuilder()
            .setTitle('Commands')
            .setColor('#10b981')
            .addFields(
                { name: '/setup', value: 'Initializes Ro-Link for this server (Owner Only).' },
                { name: '/ping', value: 'Check the bot response time and connection status.' },
                { name: '/ban', value: 'Permanently ban a user from the Roblox game.' },
                { name: '/kick', value: 'Kick a user from the game server.' },
                { name: '/unban', value: 'Unban a user from the Roblox game.' },
                { name: '/update', value: 'Send a global update signal to all Roblox servers (restarts them).' },
                { name: '/shutdown', value: 'Immediately shut down game servers.' },
                { name: '/lookup', value: 'Lookup a Roblox player and see their status/actions.' },
                { name: '/help', value: 'Show info and list of available commands.' }
            );

        return interaction.reply({ embeds: [infoEmbed, commandsEmbed] });
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
        // ... (rest of simple handlers)
    } else if (commandName === 'misc') {
        const embed = new EmbedBuilder()
            .setTitle('🪄 Miscellaneous Player Actions')
            .setDescription('Select an action from the menu below to apply it to a Roblox player.')
            .setColor('#0ea5e9')
            .addFields(
                { name: '✈️ Fly', value: 'Enables hover/flight for the target player.', inline: false },
                { name: '👻 Noclip', value: 'Allows the player to pass through walls.', inline: false },
                { name: '🫥 Invis', value: 'Makes the player and their accessories fully invisible.', inline: false },
                { name: '🛡️ Ghost', value: 'Applies a ForceField material to the player character.', inline: false },
                { name: '👤 Set Char', value: 'Copies the appearance/bundle of another Roblox user.', inline: false },
                { name: '💖 Heal', value: 'Restores player health to maximum.', inline: true },
                { name: '💀 Kill', value: 'Immediately kills the target player.', inline: true },
                { name: '🔄 Reset', value: 'Resets the player character.', inline: true },
                { name: '🌪️ Refresh', value: 'Respawn the player character.', inline: true }
            )
            .setFooter({ text: 'Ro-Link Utility System' });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('misc_menu')
                    .setPlaceholder('Choose an action...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Fly')
                            .setDescription('Enable flight for the player')
                            .setValue('FLY')
                            .setEmoji('✈️'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Noclip')
                            .setDescription('Allow player to walk through walls')
                            .setValue('NOCLIP')
                            .setEmoji('👻'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Invis')
                            .setDescription('Make the player invisible')
                            .setValue('INVIS')
                            .setEmoji('🫥'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Ghost')
                            .setDescription('Apply a ForceField material')
                            .setValue('GHOST')
                            .setEmoji('🛡️'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Set Character')
                            .setDescription('Change appearance')
                            .setValue('SET_CHAR')
                            .setEmoji('👤'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Heal')
                            .setDescription('Restore health')
                            .setValue('HEAL')
                            .setEmoji('💖'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Kill')
                            .setDescription('Instant kill')
                            .setValue('KILL')
                            .setEmoji('💀'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Reset')
                            .setDescription('Reset character')
                            .setValue('RESET')
                            .setEmoji('🔄'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Refresh')
                            .setDescription('Refresh character')
                            .setValue('REFRESH')
                            .setEmoji('🌪️'),
                    ),
            );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

    } else if (commandName === 'ping') {
        const latency = Math.abs(Date.now() - interaction.createdTimestamp);
        await interaction.reply(`🏓 **Pong!** \nLatency: \`${latency}ms\`\nStatus: \`Online (Vercel Integration Active)\``);


    });

// Handle Select Menu Interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'misc_menu') {
        const action = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`misc_modal_${action}`)
            .setTitle(`Action: ${action}`);

        const targetUserInput = new TextInputBuilder()
            .setCustomId('target_user')
            .setLabel("Target Username")
            .setPlaceholder('Enter the Roblox username')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const rows = [new ActionRowBuilder().addComponents(targetUserInput)];

        if (action === 'SET_CHAR') {
            const charUserInput = new TextInputBuilder()
                .setCustomId('char_user')
                .setLabel("Character Username")
                .setPlaceholder('Username of appearance to copy')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            rows.push(new ActionRowBuilder().addComponents(charUserInput));
        }

        modal.addComponents(...rows);
        await interaction.showModal(modal);
    }
});

// Handle Modal Submissions (Misc)
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('misc_modal_')) {
        const action = interaction.customId.replace('misc_modal_', '');
        const targetUser = interaction.fields.getTextInputValue('target_user');

        let args = { username: targetUser, moderator: interaction.user.tag };
        let msgContent = `✅ Queuing **${action}** for **${targetUser}**...`;

        if (action === 'SET_CHAR') {
            const charUser = interaction.fields.getTextInputValue('char_user');
            args.char_user = charUser;
            msgContent = `✅ Queuing **Set Character** (to ${charUser}) for **${targetUser}**...`;
        }

        await interaction.reply({ content: msgContent, ephemeral: true });

        await supabase.from('command_queue').insert([{
            server_id: interaction.guildId,
            command: action,
            args: args,
            status: 'PENDING'
        }]);
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

// Handle Modal Submissions
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'setup_modal') {
        const placeId = interaction.fields.getTextInputValue('place_id');
        const universeId = interaction.fields.getTextInputValue('universe_id');
        const openCloudKey = interaction.fields.getTextInputValue('api_key');
        const generatedKey = 'rl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        await interaction.deferReply({ ephemeral: true });

        const { error: dbError } = await supabase
            .from('servers')
            .upsert({
                id: interaction.guildId,
                linked_place_id: placeId,
                universe_id: universeId,
                open_cloud_key: openCloudKey,
                api_key: generatedKey
            });

        if (dbError) {
            return interaction.editReply(`❌ Setup failed: ${dbError.message}`);
        }

        const embeds = getSetupEmbeds(interaction.guildId, generatedKey);
        await interaction.editReply({
            content: '✅ **Setup Successful!** Please follow the instructions below to complete the integration:',
            embeds: embeds
        });
    }
});

// Helper for Setup Instructions
function getSetupEmbeds(guildId, apiKey) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const embed1 = new EmbedBuilder()
        .setTitle('🛠️ Studio Setup Instructions')
        .setColor('#0ea5e9')
        .addFields(
            { name: '1. ModuleScript', value: "Create a `ModuleScript` in `ReplicatedStorage` named `RoLink`." },
            { name: '2. Paste Code', value: "Copy the code from the next message/box and paste it into that script." },
            { name: '3. Starter Script', value: "Create a `Script` in `ServerScriptService` with:\n```lua\nlocal RoLink = require(game.ReplicatedStorage:WaitForChild('RoLink'))\nRoLink:Initialize()\n```" },
            { name: '4. Permissions', value: "Enable **HTTP Requests** and **API Services** in Game Settings." },
            { name: 'Dashboard', value: `${baseUrl}/dashboard/${guildId}` }
        );

    const luaCode = `-- RoLink Core Bridge
local RoLink = {}
local Http = game:GetService("HttpService")
local Players = game:GetService("Players")
local MS = game:GetService("MessagingService")

local URL = "${baseUrl}"
local KEY = "${apiKey}"
local POLL_INTERVAL = 5

function RoLink:Initialize()
	task.spawn(function()
		pcall(function()
			MS:SubscribeAsync("AdminActions", function(msg)
				local d = msg.Data
				if typeof(d) == "string" then d = Http:JSONDecode(d) end
				self:Execute(d)
			end)
		end)
	end)
	task.spawn(function()
		while true do
			local id = game.JobId ~= "" and game.JobId or "STUDIO"
			local s, r = pcall(function()
				return Http:RequestAsync({
					Url = URL .. "/api/roblox/poll",
					Method = "POST",
					Headers = { ["Content-Type"] = "application/json", ["Authorization"] = "Bearer " .. KEY },
					Body = Http:JSONEncode({ jobId = id, playerCount = #Players:GetPlayers(), players = (function() local l = {} for _, p in ipairs(Players:GetPlayers()) do table.insert(l, p.Name) end return l end)() })
				})
			end)
			if s and r.StatusCode == 200 then
				local d = Http:JSONDecode(r.Body)
				for _, c in ipairs(d.commands or {}) do self:Execute(c) end
			end
			task.wait(POLL_INTERVAL)
		end
	end)
end

function RoLink:Execute(cmd)
	local u, r = cmd.args.username, cmd.args.reason or "No reason"
	local p = Players:FindFirstChild(u) 
    
    if not p and cmd.command ~= "UPDATE" and cmd.command ~= "SHUTDOWN" then return end

	if cmd.command == "KICK" then
		p:Kick(r)
	elseif cmd.command == "BAN" then
		task.spawn(function()
			local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(u) end)
			if s and uid then pcall(function() Players:BanAsync({UserIds={uid},Duration=-1,DisplayReason=r,PrivateReason="RoLink"}) end) end
            if p then p:Kick("Banned: "..r) end
		end)
	elseif cmd.command == "UNBAN" then
		task.spawn(function()
			local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(u) end)
			if s and uid then pcall(function() Players:UnbanAsync({UserIds={uid}}) end) end
		end)
    elseif cmd.command == "FLY" then
        if p and p.Character then
            local hrp = p.Character:FindFirstChild("HumanoidRootPart")
            if hrp and not hrp:FindFirstChild("RoLinkFly") then
                local bv = Instance.new("BodyVelocity", hrp)
                bv.Name = "RoLinkFly"
                bv.MaxForce = Vector3.new(1,1,1) * 100000
                bv.Velocity = Vector3.new(0,0,0) -- Hover
                -- Simple hover/fly. Real fly requires client input.
            end
        end
    elseif cmd.command == "NOCLIP" then
         if p and p.Character then
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") then v.CanCollide = false end
            end
         end
    elseif cmd.command == "INVIS" then
         if p and p.Character then
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") or v:IsA("Decal") then v.Transparency = 1 end
            end
            p.Character.Head.Transparency = 1
         end
    elseif cmd.command == "GHOST" then
        if p and p.Character then
            for _, v in pairs(p.Character:GetDescendants()) do
                if v:IsA("BasePart") or v:IsA("MeshPart") then
                    v.Material = Enum.Material.ForceField
                end
            end
        end
    elseif cmd.command == "SET_CHAR" then
        if p and cmd.args.char_user then
            task.spawn(function()
                 local s, uid = pcall(function() return Players:GetUserIdFromNameAsync(cmd.args.char_user) end)
                 if s and uid then
                     p:LoadCharacterWithHumanoidDescription(Players:GetHumanoidDescriptionFromUserId(uid))
                 end
            end)
        end
    elseif cmd.command == "HEAL" then
        if p and p.Character and p.Character:FindFirstChild("Humanoid") then
            p.Character.Humanoid.Health = p.Character.Humanoid.MaxHealth
        end
    elseif cmd.command == "KILL" then
        if p and p.Character and p.Character:FindFirstChild("Humanoid") then
            p.Character.Humanoid.Health = 0
        end
    elseif cmd.command == "RESET" or cmd.command == "REFRESH" then
        if p then p:LoadCharacter() end
	elseif cmd.command == "UPDATE" then
		for _, p in ipairs(Players:GetPlayers()) do p:Kick("Updating...") end
	elseif cmd.command == "SHUTDOWN" then
		if not cmd.args.job_id or cmd.args.job_id == game.JobId then
			for _, p in ipairs(Players:GetPlayers()) do p:Kick("Shutdown.") end
		end
	end
end
return RoLink`;

    const embed2 = new EmbedBuilder()
        .setTitle('📄 Core Bridge Code (RoLink Module)')
        .setColor('#10b981')
        .setDescription('```lua\n' + luaCode + '\n```')
        .setFooter({ text: 'Keep your Security Key private!' });

    return [embed1, embed2];
}

console.log('Attempting to log in to Discord...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('FAILED TO LOGIN:', err);
    if (err.rawError) {
        const decoder = new TextDecoder();
        const body = decoder.decode(err.rawError);
        console.error('--- ERROR BODY START ---');
        console.error(body);
        console.error('--- ERROR BODY END ---');
    }
});
