"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGameCommand = void 0;
const discord_js_1 = require("discord.js");
exports.startGameCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('startgame')
        .setDescription('🔪 Start a new Grand Theft Aura 6 slasher game'),
    async execute(interaction, gameManager) {
        const channel = interaction.channel;
        const game = gameManager.getGame(channel.id);
        if (game && game.isActive) {
            return interaction.reply({
                content: '⚠️ A game is already in progress in this channel!',
                ephemeral: true,
            });
        }
        if (game && game.players.size < 2) {
            return interaction.reply({
                content: '⚠️ Need at least 2 players to start! Use `/join` to join the game.',
                ephemeral: true,
            });
        }
        if (!game) {
            gameManager.createGame(channel.id);
            gameManager.addPlayer(channel.id, interaction.user);
            return interaction.reply({
                content: `🎮 **Grand Theft Aura 6** lobby created by ${interaction.user.username}!\n\n` +
                    `👻 Use \`/join\` to enter the game!\n` +
                    `🔪 Need at least 2 players to start.\n` +
                    `⏰ Game starts in 30 seconds or when ready!`,
            });
        }
        const started = await gameManager.startGame(channel.id, channel);
        if (started) {
            await interaction.reply('🎮 **Game starting...**');
        }
        else {
            await interaction.reply({
                content: '❌ Failed to start game! Make sure you have enough players.',
                ephemeral: true,
            });
        }
    },
};
