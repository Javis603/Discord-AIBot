/**
 * @file restart.js
 * @description restart command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getText } = require('../../Functions/i18n');

module.exports = {
    developer: true,
    data: new SlashCommandBuilder()
    .setName("restart")
    .setDescription("𝒹𝑒𝓋𝑒𝓁𝑜𝓅𝑒𝓇 𝑜𝓃𝓁𝓎 • 重啟機器人")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client, args) {
        try {
            const contextObj = {
                userId: interaction.user.id,
                guildId: interaction.guildId
            };
            
            const m = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(getText('commands.restart.messages.restarting', contextObj))
                .setDescription(getText('commands.restart.messages.description', contextObj))
                .setTimestamp();

            await interaction.reply({ 
                embeds: [m], 
                withResponse: true 
            });
            
            client.destroy();
            setTimeout(() => {
                process.exit(990);
            }, 2000);

        } catch (error) {
            console.error('重啟命令執行錯誤:', error);
            
            const contextObj = {
                userId: interaction.user.id,
                guildId: interaction.guildId
            };
            
            await interaction.reply({ 
                content: getText('commands.restart.messages.error', contextObj, { error: error.message }), 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
}