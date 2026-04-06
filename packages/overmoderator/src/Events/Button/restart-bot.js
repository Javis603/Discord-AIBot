/**
 * @file restart-bot.js
 * @description for restartBot button
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getText } = require('../../Functions/i18n');
const moment = require("moment");
require("moment-duration-format");
const os = require("os");

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        if (interaction.customId === 'restartBot') {
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
            
            if (interaction.user.id !== process.env.DEVELOPER_ID) {
                await interaction.reply({ 
                    content: getText('errors.userMissingPermissions', contextObj, { permissions: getText('permissions.administrator', contextObj) }), 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }
    
            const em = new EmbedBuilder()
                .setTitle(`🔄 ${getText('events.botStartup', contextObj)}`);
    
            await interaction.update({ embeds: [em] });
            
            client.destroy();

            setTimeout(() => {
                process.exit(990);
            }, 2000);
        }
    }
}