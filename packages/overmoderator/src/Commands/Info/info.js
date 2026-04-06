/**
 * @file info.js
 * @description info command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require("moment");
require("moment-duration-format");
const os = require("os");
const config = require('../../../config.json');
const { getText } = require('../../Functions/i18n');

module.exports = {
    data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("查詢機器的資訊"),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     */
    execute(interaction, client, args) {
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
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

        const refreshButton = new ButtonBuilder()
        .setCustomId('refreshInfo')
        .setLabel(getText('commands.info.messages.refreshButton', contextObj, { default: '更新' }))
        .setStyle(ButtonStyle.Success)
        .setEmoji(`${config.emojis.update.id ? `<:update:${config.emojis.update.id}>` : config.emojis.update.fallback}`);

        const restartButton = new ButtonBuilder()
        .setCustomId('restartBot')
        .setLabel(getText('commands.info.messages.restartButton', contextObj, { default: '重新啟動' }))
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔄');

        const row = new ActionRowBuilder().addComponents(refreshButton, restartButton);

        interaction.reply({embeds: [m], components: [row]});
    }
}