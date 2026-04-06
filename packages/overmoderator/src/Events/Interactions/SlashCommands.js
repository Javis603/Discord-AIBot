/**
 * @file SlashCommands.js
 * @description SlashCommands event
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ChatInputCommandInteraction, Collection, MessageFlags } = require('discord.js');
const { getText, getLanguageSafe } = require('../../Functions/i18n');
const UserSettings = require('../../Models/UserSettings');

const cooldowns = new Collection();

module.exports = {
    name: "interactionCreate",
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(interaction, client) {
        if(!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        
        try {
            const userSettings = await UserSettings.findOne({ userId: interaction.user.id });
            if (userSettings && userSettings.language) {
                interaction.userLang = userSettings.language;
            } else {
                interaction.userLang = process.env.BOT_LANG || 'zh-TW';
            }
        } catch (error) {
            console.error(`獲取用戶語言設置時出錯: ${error.message}`);
            interaction.userLang = process.env.BOT_LANG || 'zh-TW';
        }

        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId,
            userLang: interaction.userLang
        };
        
        if(!command) 
        return interaction.reply({
            content: getText('errors.commandNotFound', contextObj, { command: interaction.commandName }),
            flags: MessageFlags.Ephemeral
        });

        if(command.developer && interaction.user.id !== process.env.DEVELOPER_ID)
        return interaction.reply({
            content: getText('errors.userMissingPermissions', contextObj, { permissions: getText('permissions.administrator', contextObj) }),
            flags: MessageFlags.Ephemeral
        });

        // guildOnly: true/false
        if ((command.guildOnly !== false) && !interaction.inGuild()) {
            return interaction.reply({ 
                content: getText('errors.guildOnly', contextObj),
                flags: MessageFlags.Ephemeral 
            });
        }

        // cooldown: seconds
        if (command.cooldown) {
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const cooldownAmount = (command.cooldown || 3) * 1000;

            if (timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return interaction.reply({ 
                        content: getText('errors.cooldown', contextObj, { time: timeLeft.toFixed(1) }),
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
        }

        try {
            if (command.folder === 'Game') {
                if (!client.games) {
                    client.games = new Collection();
                }
                const game = client.games.get(interaction.channelId);
                const newGame = await command.execute(interaction, client, game);
                if (newGame) {
                    client.games.set(interaction.channelId, newGame);
                }
            } else {
                await command.execute(interaction, client);
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: getText('errors.commandError', contextObj, { 
                    command: interaction.commandName,
                    error: error.message 
                }),
                flags: MessageFlags.Ephemeral 
            }).catch(() => {});
        }
    }
}

if (interaction.commandName === 'passiar') {
    const group = interaction.options.getSubcommandGroup(false); // 'channel' | 'user'
    const sub = interaction.options.getSubcommand(false);        // 'start' | 'stop'

    if (!group || !sub) {
        await interaction.reply({
            content: '❌ Invalid passiar command.',
            ephemeral: true
        });
        return;
    }

    // Channel-level passiar
    if (group === 'channel') {
        const channelId = interaction.channel.id;

        if (sub === 'start') {
            if (!client.passiarChannels) client.passiarChannels = new Set();
            client.passiarChannels.add(channelId);

            await interaction.reply({
                content: '✅ Passiar mode enabled for this channel. I will now respond to all messages here.',
                ephemeral: true
            });
        } else if (sub === 'stop') {
            if (client.passiarChannels) client.passiarChannels.delete(channelId);

            await interaction.reply({
                content: '🛑 Passiar mode disabled for this channel.',
                ephemeral: true
            });
        }

        return;
    }

    // User-level passiar
    if (group === 'user') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;

        if (sub === 'start') {
            if (!client.passiarUsers) client.passiarUsers = new Set();
            client.passiarUsers.add(userId);

            await interaction.reply({
                content: `✅ Passiar mode enabled for <@${userId}>. I will respond to their messages automatically.`,
                ephemeral: true
            });
        } else if (sub === 'stop') {
            if (client.passiarUsers) client.passiarUsers.delete(userId);

            await interaction.reply({
                content: `🛑 Passiar mode disabled for <@${userId}>.`,
                ephemeral: true
            });
        }

        return;
    }
}