"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinGameCommand = void 0;
const discord_js_1 = require("discord.js");
exports.joinGameCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('join')
        .setDescription('👥 Join the Grand Theft Aura 6 game in this channel'),
    async execute(interaction, gameManager) {
        const channel = interaction.channel;
        const game = gameManager.getGame(channel.id);
        if (!game) {
            // Create a new game and add the player
            gameManager.createGame(channel.id);
            const added = gameManager.addPlayer(channel.id, interaction.user);
            if (added) {
                return interaction.reply({
                    content: `🎮 **${interaction.user.username}** has created a new game lobby!\n\n` +
                        `👻 Waiting for more players...\n` +
                        `🔪 Use \`/startgame\` when ready (min 2 players)`,
                });
            }
            return interaction.reply({
                content: '⚠️ Failed to create game. Please try again.',
                ephemeral: true,
            });
        }
        if (game.isActive) {
            return interaction.reply({
                content: '⚠️ Game already in progress! Wait for the next round.',
                ephemeral: true,
            });
        }
        const added = gameManager.addPlayer(channel.id, interaction.user);
        if (!added) {
            return interaction.reply({
                content: '⚠️ You are already in the game!',
                ephemeral: true,
            });
        }
        const playerCount = game.players.size;
        await interaction.reply(`✅ **${interaction.user.username}** has joined the hunt!\n\n` +
            `👥 Players: ${playerCount}\n` +
            `${playerCount >= 2 ? '🔥 Ready to start! Use `/startgame`' : '⏰ Waiting for more players...'}`);
    },
};
