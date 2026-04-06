/**
 * @file reload-command.js
 * @description for confirm_reload_command button
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { loadCommands } = require("../../Handlers/commandHandler");
const { getText } = require('../../Functions/i18n');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        
        const UserSettings = require('../../Models/UserSettings');
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
        
        if (interaction.customId === 'confirm_reload_command') {
            clearCommandCache();
            await loadCommands(client);
            await interaction.reply({ 
                content: getText('events.commandReload', contextObj), 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
};

function clearCommandCache() {
    const commandFolders = fs.readdirSync('./src/Commands').filter(file => fs.statSync(path.join('./src/Commands', file)).isDirectory());
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(`./src/Commands/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.resolve(`./src/Commands/${folder}/${file}`);
            delete require.cache[require.resolve(filePath)];
        }
    }
}