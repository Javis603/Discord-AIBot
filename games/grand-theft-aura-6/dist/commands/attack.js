"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attackCommand = void 0;
const discord_js_1 = require("discord.js");
exports.attackCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('attack')
        .setDescription('⚔️ Attack another player')
        .addUserOption(option => option
        .setName('target')
        .setDescription('The player to attack')
        .setRequired(true)),
    async execute(interaction, gameManager) {
        const channel = interaction.channel;
        const target = interaction.options.getUser('target', true);
        const error = await gameManager.attackPlayer(channel.id, interaction.user.id, target.id, channel);
        if (error) {
            return interaction.reply({
                content: `⚠️ ${error}`,
                ephemeral: true,
            });
        }
        await interaction.reply({
            content: '⚔️ Attack executed...',
            ephemeral: true,
        });
    },
};
