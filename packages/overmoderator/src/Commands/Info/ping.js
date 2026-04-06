/**
 * @file ping.js
 * @description ping command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getText } = require('../../Functions/i18n');

module.exports = {
    data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("取得機器人延遲"),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client, args) {
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
        };
        
        const loadingText = getText('commands.ping.messages.pinging', contextObj);

        const m = new EmbedBuilder()
        .setColor(interaction.member.displayHexColor)
        .setTitle(`🔄️ ${loadingText}`);
        await interaction.reply({ embeds: [m] });
        
        const ping = Date.now() - interaction.createdTimestamp;
        
        const pingSeconds = ((ping % 60000) / 1000).toFixed(2);
        const apiSeconds = ((client.ws.ping % 60000) / 1000).toFixed(2);

        const embed = new EmbedBuilder()
        .setColor(interaction.member.displayHexColor)
        .setTitle(`🏓 **Pong**`)
        .setThumbnail('https://cdn.discordapp.com/attachments/1231229589917794435/1344115518562373662/562592178204049408.png?ex=67bfbca0&is=67be6b20&hm=010736fde01349d0012993a1e55c8db44761bf4bd03847d54c9eda310126dc0c&')
        .addFields(
            { name: "🤖 " + getText('commands.ping.messages.botLatency', contextObj, { time: `${ping}ms (${pingSeconds}s)` }), value: `${ping}ms (${pingSeconds}s)`, inline: true },
            { name: "💻 " + getText('commands.ping.messages.apiLatency', contextObj, { time: `${client.ws.ping}ms (${apiSeconds}s)` }), value: `${client.ws.ping}ms (${apiSeconds}s)`, inline: true }
        );

        interaction.editReply({ embeds: [embed] });
    }
}