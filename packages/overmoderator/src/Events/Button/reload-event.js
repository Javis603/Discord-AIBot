/**
 * @file reload-event.js
 * @description for confirm_reload_event button
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { loadEvents } = require("../../Handlers/eventHandlers");
const { getText } = require('../../Functions/i18n');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {

    if (!interaction.isButton()) return;
    if (interaction.customId === 'confirm_reload_event') {
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
        
        clearEventCache(client);
        // Then reload events
        await loadEvents(client);
        await interaction.reply({ 
            content: getText('events.eventReload', contextObj), 
            flags: MessageFlags.Ephemeral 
        });
    }
    }
};

function clearEventCache(client) {
    client.removeAllListeners();
    
    const eventFiles = fs.readdirSync('./src/Events').filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.resolve(`./src/Events/${file}`);
        delete require.cache[require.resolve(filePath)];
    }
}