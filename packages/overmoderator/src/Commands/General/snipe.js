/**
 * @file snipe.js
 * @description snipe command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { SlashCommandBuilder, ButtonStyle, ButtonBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getText } = require('../../Functions/i18n');
const config = require('../../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('狙擊該頻道最近10則已刪除的信息/照片'),

    async execute(interaction, client) {
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
        };
        
        const snipes = client.snipes.get(interaction.channel.id);
        const m = new EmbedBuilder()
            .setColor("Red")
            .setTitle(`**${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} | ${getText('commands.snipe.messages.noMessage', contextObj)}** `) 
            
        if(!snipes) return interaction.reply({embeds: [m]})

        let index = snipes.length - 1;
        
        const embeds = snipes.map((snipe, i) => {
            const secondsAgo = (interaction.createdTimestamp/1000 - snipe.date) | 0;
            
            const timeText = getText('time.seconds', contextObj, { count: secondsAgo });
            const timeAgoText = getText('time.ago', contextObj, { time: timeText });
            
            return new EmbedBuilder()
                .setColor(interaction.member.displayHexColor)
                .setAuthor({
                    name: `${snipe.author.tag}`, 
                    iconURL: `${snipe.avatarURL}`
                })
                .setDescription(snipe.content)
                .setFooter({ text: ` 🗑 ${timeAgoText} • ${i + 1}/${snipes.length} ` })
                .setImage(snipe.image)
                .toJSON()
        });
        
        const previousLabel = getText('components.buttons.previous', contextObj);
        const nextLabel = getText('components.buttons.next', contextObj);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previoussnipe')
                    .setLabel(previousLabel)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('nextsnipe')
                    .setLabel(nextLabel)
                    .setStyle(ButtonStyle.Secondary),
            );

        //const message = await interaction.reply({ embeds: [embeds[index]], components: [buttons], fetchReply: true });
        await interaction.reply({ 
            embeds: [embeds[index]], 
            components: [buttons]
        });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'previoussnipe') index = index > 0 ? --index : snipes.length - 1;
            if (interaction.customId === 'nextsnipe') index = index + 1 < snipes.length ? ++index : 0;
            
            interaction.update({ embeds: [embeds[index]] });
        });

        collector.on('end', () => {
            message.edit({ components: [] });
        });
    },
};
