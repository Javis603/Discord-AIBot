/**
 * @file clear.js
 * @description clear command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getText } = require("../../Functions/i18n");

module.exports = {
    data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("批量刪除訊息")
    .addNumberOption(options => options
        .setName("數量")
        .setDescription("想要刪除多少則訊息")
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(true)
    )
    .addStringOption(options => options
        .setName("原因")
        .setDescription("刪除信息的原因")
    )
    .addUserOption(options => options
        .setName("用戶")
        .setDescription("只刪除特定用戶的信息")
    ),
    async execute(interaction) {
        const { channel, options } = interaction;
        const Amount = options.getNumber("數量");
        const Target = options.getUser("用戶");
        const Reason = options.getString("原因");

        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
        };

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            let deletedTotal = 0;
            
            async function bulkDelete(remaining) {
                if (remaining <= 0) return;
                
                const amount = Math.min(remaining, 100);
                const messages = await interaction.channel.messages.fetch({ limit: amount });
                const filtered = Target ? messages.filter(m => m.author.id === Target.id) : messages;
                
                if (filtered.size === 0) return;

                await interaction.channel.bulkDelete(filtered, true);
                deletedTotal += filtered.size;

                await new Promise(resolve => setTimeout(resolve, 1500));
                
                await bulkDelete(remaining - amount);
            }

            await bulkDelete(Amount);

            const responseEmbed = new EmbedBuilder()
                .setColor("DarkNavy")
                .setDescription(getText("commands.clear.messages.cleared", contextObj, { count: deletedTotal }));
            
            await interaction.editReply({ embeds: [responseEmbed] });

            const logEmbed = new EmbedBuilder()
                .setColor('DarkAqua')
                .setAuthor({ name: getText("commands.clear.messages.logEmbed.author", contextObj) })
                .setDescription([
                    getText("commands.clear.messages.logEmbed.mod", contextObj, { mod: interaction.member }),
                    getText("commands.clear.messages.logEmbed.targetUser", contextObj, { user: Target || "None" }),
                    getText("commands.clear.messages.logEmbed.channel", contextObj, { channel: interaction.channel }),
                    getText("commands.clear.messages.logEmbed.amount", contextObj, { amount: deletedTotal }),
                    getText("commands.clear.messages.logEmbed.reason", contextObj, { reason: Reason || "None" })
                ].join("\n"));

            //const webhook = new WebhookClient({ url: process.env.LOG_WEBHOOK_URL });
            //webhook.send({ embeds: [logEmbed] });

        } catch (error) {
            console.error("清除訊息時發生錯誤:", error);
            await interaction.editReply({ 
                content: getText("commands.clear.messages.error", contextObj), 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
};