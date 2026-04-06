"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsCommand = void 0;
const discord_js_1 = require("discord.js");
exports.statsCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('stats')
        .setDescription('📊 View your Grand Theft Aura 6 statistics')
        .addUserOption(option => option
        .setName('user')
        .setDescription('User to view stats for (leave empty for yourself)')
        .setRequired(false)),
    async execute(interaction, gameManager) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const stats = gameManager.getPlayerStats(targetUser.id);
        if (!stats) {
            return interaction.reply({
                content: `📊 **${targetUser.username}** hasn't played any games yet!`,
                ephemeral: true,
            });
        }
        const kd = stats.totalDeaths > 0 ? (stats.totalKills / stats.totalDeaths).toFixed(2) : stats.totalKills.toFixed(2);
        const avgAura = Math.floor(stats.totalAura / stats.gamesPlayed);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`📊 ${targetUser.username}'s Grand Theft Aura 6 Stats`)
            .setDescription(`**CAREER STATISTICS**\n\n` +
            `🎮 Games Played: **${stats.gamesPlayed}**\n` +
            `🔪 Total Kills: **${stats.totalKills}**\n` +
            `💀 Total Deaths: **${stats.totalDeaths}**\n` +
            `📈 K/D Ratio: **${kd}**\n` +
            `💫 Total Aura Earned: **${stats.totalAura}**\n` +
            `⭐ Average Aura: **${avgAura}**\n\n` +
            `*"In San Andreas, your aura is your legacy..."*`)
            .setColor('#FFD700')
            .setThumbnail(targetUser.displayAvatarURL())
            .setFooter({ text: 'Grand Theft Aura 6 | Stats' })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },
};
