/**
 * @file refresh-info.js
 * @description for refreshInfo button
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { EmbedBuilder } = require('discord.js');
const { getText } = require('../../Functions/i18n');
const moment = require("moment");
require("moment-duration-format");
const os = require("os");
const config = require('../../../config.json');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {

    if (!interaction.isButton()) return;
    if (interaction.customId === 'refreshInfo') {
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
        
        const duration = moment.duration(client.uptime).format("\`D\` [days], \`H\` [hrs], \`m\` [mins], \`s\` [secs]");
        const upvalue = (Date.now() / 1000 - client.uptime / 1000).toFixed(0);
        const memoryUsage = process.memoryUsage();
        const usedMemory = (memoryUsage.rss / 1024 / 1024).toFixed(1);
        const totalMemory = (os.totalmem() / 1024 / 1024).toFixed(1);
        //const rssMemory = (memoryUsage.rss / 1024 / 1024).toFixed(1);

        const m = new EmbedBuilder()
        .setAuthor({name:`${client.user.tag}`, 
        iconURL: `${client.user.avatarURL({dynamic: true, size: 512})}`})
        .setColor(Math.floor(Math.random() * 16777215)) 
        .addFields({name: getText('commands.info.messages.uptime', contextObj, { default: '⌛正常運作時間' }), value: `${duration}`, inline: true})
        .addFields({
            name: `${config.emojis.clock.id ? `<:clock:${config.emojis.clock.id}>` : config.emojis.clock.fallback}${getText('commands.info.messages.startTime', contextObj, { default: '開機時間' })}`, 
            value: `<t:${upvalue}>`, 
            inline: true
        })
        .addFields({
            name: `${config.emojis.memory.id ? `<:memory:${config.emojis.memory.id}>` : config.emojis.memory.fallback}${getText('commands.info.messages.memoryUsage', contextObj, { default: '記憶體狀況(已用 / 總共)' })}`, 
            value: `${usedMemory} MB / ${totalMemory} MB`, 
            inline: false
        });

        await interaction.update({embeds: [m]});
    }
    }
};
