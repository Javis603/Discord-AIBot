/**
 * @file avatar.js
 * @description avatar command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getText } = require('../../Functions/i18n');

module.exports = {
    data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("取得用戶頭像")
    .addUserOption(option =>
        option.setName("用戶")
            .setDescription("用戶")
            .setRequired(true)
        ),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     */

    execute(interaction, client) {
        const { channel, options, user, guildId } = interaction;
        
        const contextObj = {
            userId: user.id,
            guildId: guildId
        };

        const targetUser = options.getUser("用戶");
        let avatar = targetUser.displayAvatarURL({ size: 2048, dynamic: true });
        
        const authorNameText = getText('commands.avatar.messages.authorName', contextObj, { user: targetUser.tag });
        const buttonLabelText = getText('commands.avatar.messages.buttonLabel', contextObj);
        
        const m = new EmbedBuilder()
        .setAuthor({
            name: authorNameText, 
            iconURL: null
        })
        .setColor(interaction.member.displayHexColor)
        .setImage(avatar);

        const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setLabel(buttonLabelText)
            .setURL(targetUser.displayAvatarURL({ size: 2048, dynamic: true }))
            .setStyle(ButtonStyle.Link),
    );

        interaction.reply({
            embeds: [m],
            components: [row]
        });
    }
}